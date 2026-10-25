/** The Compendium export route: a stored book printed as RoleCall's compendium file, one entry at a time, never one buffer. */
import { expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import { emptyLoreEntry, emptyLorebookBody } from "../../core/lore";
import { StudioStore } from "../../studio/store";
import { tempDir } from "../../studio/test-temp-dir";
import { handleStudioRead } from "./studio-read-route";

const json = (value: unknown, status = 200): Response => Response.json(value, { status });
const read = (store: StudioStore, id: string) => handleStudioRead("/api/studio/export-compendium", new URL(`http://x/api/studio/export-compendium?id=${id}`), store, json, (e) => json({ error: String(e) }, 500));

test("a book streams out as a compendium file in many chunks, and a missing book is a 404 before any byte", async () => {
  const store = new StudioStore(await tempDir("vaude-compendium-export-"));
  const entries = Array.from({ length: 40 }, (_, i) => ({ ...emptyLoreEntry(`e${i}`), title: `Entry ${i}`, content: "x".repeat(100) }));
  await store.save({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "lorebook", id: "bk", body: { ...emptyLorebookBody("Harbor"), entries } });

  const response = (await read(store, "bk"))!;
  expect(response.headers.get("content-type")).toBe("application/json");
  expect(response.headers.get("cache-control")).toBe("no-store");
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) chunks.push(chunk);
  expect(chunks.length).toBeGreaterThanOrEqual(42);
  const file = JSON.parse(chunks.map((c) => new TextDecoder().decode(c)).join(""));
  expect(file).toMatchObject({ format: "rolecall-compendium", lorebook: { name: "Harbor" } });
  expect(file.entries).toHaveLength(40);

  expect((await read(store, "nope"))!.status).toBe(404);
});
