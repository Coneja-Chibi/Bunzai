/**
 * What an editor patch may put into an art or blob reference slot. Every slot the canonical media
 * classifier names (`isCanonicalMediaReference`) must hold an authorized blob sentinel, a well-formed
 * embedded data URI, an empty value, or exactly what is already stored. Anything else (an opaque
 * upload-grant string, a URL, a path, a forged sentinel) is refused before a write.
 */
import { describe, expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import { bytesToBase64 } from "../../core/base64";
import { hashHex } from "../../core/sha256";
import { StudioValidationError } from "../../studio/errors";
import type { PartBlob } from "../contracts/content-store";
import { createContentStore } from "./content-store";
import { memoryDocumentBackend } from "./memory/document-backend";

const PNG = new Uint8Array(2048).map((_, i) => (i * 7 + 3) % 251);
const PNG_SHA = hashHex(PNG);
const upload: PartBlob = { key: PNG_SHA, payload: { kind: "bytes", bytes: PNG } };
const SENTINEL = `\u0000b:u:image/png:${PNG_SHA}`;
const DATA_URI = `data:image/png;base64,${bytesToBase64(PNG)}`;
const GRANT = "g_6f1c2b9d-grant-looking-opaque-string";

const personaHead = (body: Record<string, unknown>) => ({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "persona", id: "ony", body: { name: "Ony", content: "hi", ...body } });
const characterBody = (extra: Record<string, unknown>) => ({
  identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {}, ...extra,
});
const characterHead = (extra: Record<string, unknown>) => ({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "character", id: "vera", body: characterBody(extra) });
const packHead = (items: unknown[]) => ({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "pack", id: "faces", body: { name: "Faces", pack: { defaultLabel: "a", items }, groups: {} } });

async function fixture(entity: { kind: string; id: string }) {
  const store = createContentStore(memoryDocumentBackend());
  const saved = await store.save(entity);
  return { store, revision: saved.revision, kind: entity.kind, id: entity.id };
}

async function refused(run: () => Promise<unknown>): Promise<void> {
  await expect(run()).rejects.toBeInstanceOf(StudioValidationError);
}

describe("patch art refs: a persona portrait", () => {
  test("an uploaded asset sentinel is stored and served as the portrait", async () => {
    const { store, revision } = await fixture(personaHead({}));
    const head = personaHead({ media: { portrait: { role: "portrait", ref: SENTINEL, primary: true, mime: "image/png" } } });
    const result = await store.patch("persona", "ony", revision, { head }, [upload]);
    expect(result.status).toBe("saved");
    const read = await store.read("persona", "ony");
    expect((read!.entity.body as { media: { portrait: { ref: string } } }).media.portrait.ref).toBe(DATA_URI);
  });

  test("a raw upload-grant string is refused and nothing is written", async () => {
    const { store, revision } = await fixture(personaHead({}));
    const head = personaHead({ media: { portrait: { role: "portrait", ref: GRANT, primary: true } } });
    await refused(() => store.patch("persona", "ony", revision, { head }, [upload]));
    const row = await store.read("persona", "ony");
    expect(row!.revision).toBe(revision);
    expect((row!.entity.body as { media?: unknown }).media).toBeUndefined();
  });

  test.each([
    ["an http url", "https://evil.example/x.png"],
    ["a file url", "file:///C:/Users/me/secrets.txt"],
    ["a script url", "javascript:alert(1)"],
    ["a path", "../../library.db"],
    ["a sentinel for bytes nobody uploaded", `\u0000b:u:image/png:${"ab".repeat(32)}`],
    ["a text-blob sentinel in an art slot", `\u0000b:t:${PNG_SHA}`],
    ["a malformed sentinel", "\u0000b:u:image/png:nothex"],
    ["a data uri with broken base64", "data:image/png;base64,%%%not-b64"],
    ["a data uri that is not base64", "data:image/png,plain"],
  ])("%s is refused", async (_name, ref) => {
    const { store, revision } = await fixture(personaHead({}));
    const head = personaHead({ media: { portrait: { role: "portrait", ref, primary: true } } });
    await refused(() => store.patch("persona", "ony", revision, { head }, [upload]));
    expect((await store.read("persona", "ony"))!.revision).toBe(revision);
  });

  test("a stored ref that is not an asset (a legacy URL) can stay while other fields change", async () => {
    const { store, revision } = await fixture(personaHead({ media: { portrait: { role: "portrait", ref: "https://cdn.example/legacy.png", primary: true } } }));
    const head = personaHead({ media: { portrait: { role: "portrait", ref: "https://cdn.example/legacy.png", primary: true } }, brief: "changed" });
    const result = await store.patch("persona", "ony", revision, { head });
    expect(result.status).toBe("saved");
  });

  test("an empty ref clears the slot", async () => {
    const { store, revision } = await fixture(personaHead({}));
    const head = personaHead({ media: { portrait: { role: "portrait", ref: "", primary: true } } });
    expect((await store.patch("persona", "ony", revision, { head })).status).toBe("saved");
  });

  test("presentation.imageUrl takes the same rule", async () => {
    const { store, revision } = await fixture(personaHead({}));
    await refused(() => store.patch("persona", "ony", revision, { head: personaHead({ presentation: { imageUrl: GRANT } }) }, [upload]));
    await refused(() => store.patch("persona", "ony", revision, { head: personaHead({ presentation: { imageUrl: "file:///etc/passwd" } }) }));
  });
});

describe("patch art refs: every other slot the classifier names", () => {
  const slots: [string, (ref: string) => Record<string, unknown>][] = [
    ["media.portrait.ref", (ref) => ({ media: { portrait: { role: "portrait", ref } } })],
    ["media.assets[0].ref", (ref) => ({ media: { assets: [{ role: "emotion", ref }] } })],
    ["presentation.background.ref", (ref) => ({ presentation: { background: { ref } } })],
    ["variants[0].overrides.media.portrait.ref", (ref) => ({ variants: [{ id: "v1", label: "V", overrides: { media: { portrait: { role: "portrait", ref } } } }] })],
    ["variants[0].overrides.media.assets[0].ref", (ref) => ({ variants: [{ id: "v1", label: "V", overrides: { media: { assets: [{ role: "emotion", ref }] } } }] })],
    ["variants[0].overrides.presentation.background.ref", (ref) => ({ variants: [{ id: "v1", label: "V", overrides: { presentation: { background: { ref } } } }] })],
  ];

  for (const [path, build] of slots) {
    test(`character ${path}: an authorized sentinel saves, a grant string is refused`, async () => {
      const ok = await fixture(characterHead({}));
      expect((await ok.store.patch("character", "vera", ok.revision, { head: characterHead(build(SENTINEL)) }, [upload])).status).toBe("saved");
      const bad = await fixture(characterHead({}));
      await refused(() => bad.store.patch("character", "vera", bad.revision, { head: characterHead(build(GRANT)) }, [upload]));
      expect((await bad.store.read("character", "vera"))!.revision).toBe(bad.revision);
    });
  }

  test("pack items[].ref and groups.*.items[].ref", async () => {
    const base = await fixture(packHead([]));
    const item = (ref: string) => ({ id: "1", label: "a", ref });
    expect((await base.store.patch("pack", "faces", base.revision, { head: packHead([item(SENTINEL)]) }, [upload])).status).toBe("saved");
    const bad = await fixture(packHead([]));
    await refused(() => bad.store.patch("pack", "faces", bad.revision, { head: packHead([item(GRANT)]) }, [upload]));
    const group = await fixture(packHead([]));
    const grouped = { ...packHead([]), body: { name: "Faces", pack: { defaultLabel: "a", items: [] }, groups: { side: { items: [item(GRANT)] } } } };
    await refused(() => group.store.patch("pack", "faces", group.revision, { head: grouped }, [upload]));
  });

});
