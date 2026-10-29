/**
 * ST sampler sets and system prompts through the real import path (the Library drop): /api/inspect
 * reads the file, /api/studio/save-bundle shelves it, and the stored preset carries the mapped
 * fields. Reasoning templates land as presets, instruct and context as prompt formats.
 * Fixtures: samples/sillytavern/templates/ (verbatim copies from a real ST data folder).
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { StudioStore } from "../studio/store";
import { SettingsStore } from "../studio/settings";
import { loadFormats } from "../core";
import { createHandler } from "./server";
import { apiReq, filledSec } from "./server-test-rig";

const DIR = join(import.meta.dir, "../../samples/sillytavern/templates");

interface Inspected {
  ok: boolean;
  error?: string;
  kind?: string;
  formatId?: string;
  entity?: { body: { name: string; prompts: { id: string }[]; samplers?: Record<string, number> } };
}

async function rig() {
  const dir = await mkdtemp(join(tmpdir(), "vaude-sttpl-"));
  const sec = filledSec();
  const store = new StudioStore(dir);
  const handler = createHandler(store, new SettingsStore(dir), undefined, sec);
  const inspect = async (file: string, asName: string = file): Promise<Inspected> => {
    const headers = new Headers({
      host: "127.0.0.1:8321",
      origin: "http://127.0.0.1:8321",
      "x-bunzai-token": sec.token,
      "content-type": "application/octet-stream",
      "x-filename": encodeURIComponent(asName),
    });
    const body = new Uint8Array(await readFile(join(DIR, file)));
    return (await (await handler(new Request("http://127.0.0.1:8321/api/inspect", { method: "POST", headers, body }))).json()) as Inspected;
  };
  const save = async (entity: unknown) =>
    (await (await handler(apiReq("/api/studio/save-bundle", { method: "POST", token: sec.token, contentType: "application/json", body: JSON.stringify({ entity }) }))).json()) as { ok: boolean; primary: { kind: string; id: string } };
  return { dir, store, inspect, save };
}

describe("ST sampler sets and system prompts import", () => {
  beforeAll(async () => {
    await loadFormats();
  });

  test.each([
    ["kobold-deterministic.json", "kobold-deterministic", { temperature: 0, topK: 1 }],
    ["textgen-simple-1.json", "textgen-simple-1", { temperature: 0.7, minP: 0 }],
    ["novelai-asper-kayra.json", "novelai-asper-kayra", { topK: 175, maxContext: 7800 }],
    ["novelai-erato-wilder.json", "novelai-erato-wilder", { topP: 0.98, topA: 0.004 }],
  ])("%s inspects as a preset and shelves with its samplers", async (file, name, samplers) => {
    const { dir, store, inspect, save } = await rig();
    const got = await inspect(file);
    expect(got.ok).toBe(true);
    expect(got.kind).toBe("preset");
    expect(got.formatId).toBe("sillytavern-preset");
    expect(got.entity?.body.name).toBe(name);
    const saved = await save(got.entity);
    expect(saved.ok).toBe(true);
    const stored = (await store.read("preset", saved.primary.id)) as { body: { samplers?: Record<string, number> } } | null;
    expect(stored?.body.samplers).toMatchObject(samplers);
    await rm(dir, { recursive: true, force: true });
  });

  test("two sampler sets sharing a file name, from different dialects, both shelve", async () => {
    const { dir, store, inspect, save } = await rig();
    const kobold = await inspect("kobold-deterministic.json", "Titanic.json");
    const textgen = await inspect("textgen-simple-1.json", "Titanic.json");
    expect(kobold.entity?.body.name).toBe("Titanic");
    expect(textgen.entity?.body.name).toBe("Titanic");
    const first = await save(kobold.entity);
    const second = await save(textgen.entity);
    expect(first.ok && second.ok).toBe(true);
    expect(first.primary.id).not.toBe(second.primary.id);
    for (const [saved, temp] of [[first, 0], [second, 0.7]] as const) {
      const stored = (await store.read("preset", saved.primary.id)) as { body: { samplers?: { temperature?: number } } } | null;
      expect(stored?.body.samplers?.temperature).toBe(temp);
    }
    await rm(dir, { recursive: true, force: true });
  });

  test("a system prompt shelves as a preset with a main block", async () => {
    const { dir, store, inspect, save } = await rig();
    const got = await inspect("sysprompt-actor.json");
    expect(got.ok).toBe(true);
    const saved = await save(got.entity);
    const stored = (await store.read("preset", saved.primary.id)) as { body: { prompts: { id: string; content: string }[] } } | null;
    expect(stored?.body.prompts.map((p) => p.id)).toContain("charDescription");
    expect(stored?.body.prompts[0]!.id).toBe("main");
    expect(stored?.body.prompts[0]!.content).toStartWith("You are an expert actor");
    await rm(dir, { recursive: true, force: true });
  });

  test("a reasoning template shelves as a preset carrying its markers", async () => {
    const { dir, store, inspect, save } = await rig();
    const got = await inspect("reasoning-deepseek.json");
    expect(got.ok).toBe(true);
    const saved = await save(got.entity);
    const stored = (await store.read("preset", saved.primary.id)) as { body: { reasoning?: { prefix: string; suffix: string } } } | null;
    expect(stored?.body.reasoning).toMatchObject({ prefix: "<think>", suffix: "</think>" });
    await rm(dir, { recursive: true, force: true });
  });

  test("a TextGen file that only bundles instruct, context and a prompt imports the prompt", async () => {
    const { dir, inspect } = await rig();
    const got = await inspect("textgen-chatml-with-prompt.json");
    expect(got.ok).toBe(true);
    expect(got.entity?.body.prompts[0]?.id).toBe("main");
    await rm(dir, { recursive: true, force: true });
  });

  test.each([
    ["instruct-chatml-names.json", "instruct", "input_sequence"],
    ["context-llama-3-instruct.json", "context", "story_string"],
  ])("%s shelves as a prompt format holding every key", async (file, half, key) => {
    const { dir, store, inspect, save } = await rig();
    const got = await inspect(file);
    expect(got.ok).toBe(true);
    expect(got.kind).toBe("promptformat");
    const saved = await save(got.entity);
    const stored = (await store.read("promptformat", saved.primary.id)) as { body: Record<string, Record<string, unknown>> } | null;
    expect(Object.keys(stored!.body[half]!).length).toBe(Object.keys(JSON.parse(await readFile(join(DIR, file), "utf8"))).length - 1);
    expect(stored!.body[half]![key]).toBeDefined();
    await rm(dir, { recursive: true, force: true });
  });
});
