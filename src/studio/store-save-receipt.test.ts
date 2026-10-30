/**
 * A save's receipt is the whole Library row. The client replaces a piece's row with the receipt it
 * gets back, so a receipt carrying only a name and a version dropped `hasPortrait`, tags and the
 * peek facts until the next full reload: art added in the Workbench appeared only after a restart.
 */
import { expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { hashHex } from "../core/sha256";
import type { PartBlob } from "../stage/contracts/content-store";
import { createContentStore } from "../stage/store/content-store";
import { memoryDocumentBackend } from "../stage/store/memory/document-backend";
import { StudioStore } from "./store";

const PNG = new Uint8Array(2048).map((_, i) => (i * 7 + 3) % 251);
const SHA = hashHex(PNG);
const upload: PartBlob = { key: SHA, payload: { kind: "bytes", bytes: PNG } };
const character = (media: Record<string, unknown>) => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "character", id: "vera",
  body: { identity: { name: "Vera", description: "A keeper." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media, attribution: {}, discovery: { tags: ["fantasy"] } },
});

test("a patch that adds art answers with the full row: the portrait flag, tags and facts", async () => {
  const content = createContentStore(memoryDocumentBackend());
  const store = new StudioStore("/unused", () => content);
  const created = await store.save(character({}));
  const portrait = { portrait: { role: "portrait", ref: `\u0000b:u:image/png:${SHA}`, primary: true, mime: "image/png" } };
  const result = await store.comparePatch("character", "vera", created.revision!, { head: character(portrait) }, [upload]);
  if (result.status !== "saved") throw new Error(`patch: ${result.status}`);
  expect((await store.summary("character", "vera"))!.hasPortrait).toBe(true);
  expect(result.summary.hasPortrait).toBe(true);
  expect(result.summary.tags).toEqual(["fantasy"]);
  expect(result.summary.facts?.description).toBe("A keeper.");
  expect(result.summary).toEqual((await store.summary("character", "vera"))!);
});

test("a whole-entity save answers with the full row too", async () => {
  const content = createContentStore(memoryDocumentBackend());
  const store = new StudioStore("/unused", () => content);
  const created = await store.save(character({}));
  expect(created.tags).toEqual(["fantasy"]);
  const read = await store.readVersioned("character", "vera");
  const result = await store.compareAndSave({ ...read!.entity, body: { ...read!.entity.body as object, discovery: { tags: ["noir"] } } }, created.revision!);
  if (result.status !== "saved") throw new Error(`save: ${result.status}`);
  expect(result.summary.tags).toEqual(["noir"]);
});

test("a newer write after commit cannot replace the first write's receipt metadata", async () => {
  const backend = memoryDocumentBackend();
  const content = createContentStore(backend);
  const store = new StudioStore("/unused", () => content);
  const write = backend.write.bind(backend);
  let race = false;
  backend.write = async (...args: Parameters<typeof backend.write>) => {
    const saved = await write(...args);
    if (race && saved) {
      race = false;
      const later = character({});
      later.body.discovery.tags = ["storm"];
      await store.save(later, { overwrite: true });
    }
    return saved;
  };
  const created = await store.save(character({}));
  race = true;
  const portrait = { portrait: { role: "portrait", ref: `\u0000b:u:image/png:${SHA}`, primary: true, mime: "image/png" } };
  const result = await store.comparePatch("character", "vera", created.revision!, { head: character(portrait) }, [upload]);
  if (result.status !== "saved") throw new Error(`patch: ${result.status}`);
  expect(result.summary.hasPortrait).toBe(true);
  expect(result.summary.tags).toEqual(["fantasy"]);
  const latest = (await store.summary("character", "vera"))!;
  expect(latest.writeId).toBe(result.summary.writeId! + 1);
  expect(latest.tags).toEqual(["storm"]);
  expect(latest.hasPortrait).toBe(false);
});

test("returning a complete write receipt needs no fallible post-commit summary lookup", async () => {
  const content = createContentStore(memoryDocumentBackend());
  let reads = 0;
  content.summary = async () => { reads++; throw new Error("fixture summary read unavailable"); };
  const store = new StudioStore("/unused", () => content);
  const saved = await store.save(character({}));
  expect(saved.tags).toEqual(["fantasy"]);
  expect(saved.facts?.description).toBe("A keeper.");
  expect(reads).toBe(0);
});

test("an unchanged patch keeps its committed portrait metadata without another write", async () => {
  const content = createContentStore(memoryDocumentBackend());
  const store = new StudioStore("/unused", () => content);
  const created = await store.save(character({}));
  const portrait = { portrait: { role: "portrait", ref: `\u0000b:u:image/png:${SHA}`, primary: true, mime: "image/png" } };
  const first = await store.comparePatch("character", "vera", created.revision!, { head: character(portrait) }, [upload]);
  if (first.status !== "saved") throw new Error(`patch: ${first.status}`);
  const again = await store.comparePatch("character", "vera", first.revision, { head: character(portrait) });
  if (again.status !== "saved") throw new Error(`patch: ${again.status}`);
  expect(again.summary.hasPortrait).toBe(true);
  expect(again.summary.writeId).toBe(first.summary.writeId);
});

test("restoring a portrait version and repeating that restore retain owned media metadata", async () => {
  const content = createContentStore(memoryDocumentBackend());
  const store = new StudioStore("/unused", () => content);
  const created = await store.save(character({}));
  const portrait = { portrait: { role: "portrait", ref: `\u0000b:u:image/png:${SHA}`, primary: true, mime: "image/png" } };
  const withArt = await store.comparePatch("character", "vera", created.revision!, { head: character(portrait) }, [upload]);
  if (withArt.status !== "saved") throw new Error(`patch: ${withArt.status}`);
  await store.save(character({}), { overwrite: true });
  const restored = await content.restoreVersion("character", "vera", withArt.summary.version!);
  expect(restored!.hasPortrait).toBe(true);
  expect((await store.summary("character", "vera"))!.hasPortrait).toBe(true);
  const unchanged = await content.restoreVersion("character", "vera", withArt.summary.version!);
  expect(unchanged!.hasPortrait).toBe(true);
  expect(unchanged!.writeId).toBe(restored!.writeId);
});
