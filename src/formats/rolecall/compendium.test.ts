/**
 * The RoleCall compendium export (`compendium-v1.0.0`, RoleCall's `.compendium.json`): what Bunzai streams out, that Bunzai reads
 * it back whole, that RoleCall's own file survives a pass through canonical untouched, and that the older lorebook codec never
 * claims it.
 */
import { describe, expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import { typedEntry } from "../../core/compendium/fixture-book";
import { emptyLoreEntry, emptyLorebookBody } from "../../core/lore";
import type { CanonicalLorebook, LorebookBody } from "../../entities/lorebook/schema";
import compendium, { compendiumChunks } from "./compendium";
import lorebook from "./lorebook";

const entity = (body: LorebookBody): CanonicalLorebook => ({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "lorebook", id: "harbor", body });

function book(): LorebookBody {
  const classic = { ...emptyLoreEntry("k1"), title: "Harbor Lore", content: "Salt and rope.", triggers: [{ keyword: "harbor", isRegex: false }], categoryId: "cat1", comment: "note", caseSensitive: true, scanDepth: 6, position: "depth" as const, vectorized: true, displayIndex: 3 };
  const wolf = typedEntry("c1", "Lycanthrope", "character", { name: "Lycanthrope", aliases: ["Wolfman"], memories: ["a"] }, { featured: true }, { sortOrder: 7, secondaryTriggers: [{ keyword: "wolf", isRegex: true, flags: "i" }] });
  const gone = typedEntry("r1", "Old Plot", "plot", { name: "Old Plot" }, { retired: { at: 1, receipt: "x" } }, { enabled: false });
  return { ...emptyLorebookBody("Harbor"), description: "Where the boats are.", tags: ["sea"], genre: "noir", tokenBudget: 900, budgetMode: "entry", entryBudget: 12, categories: [{ id: "cat1", name: "Places", sortOrder: 2, enabled: true }], entries: [classic, wolf, gone] };
}

async function text(chunks: AsyncGenerator<Uint8Array>): Promise<{ text: string; count: number }> {
  const parts: string[] = [];
  const decoder = new TextDecoder();
  for await (const chunk of chunks) parts.push(decoder.decode(chunk, { stream: true }));
  return { text: parts.join(""), count: parts.length };
}

describe("exporting a compendium", () => {
  test("the file is RoleCall's compendium shape: top-level raw rows with snake_case columns, no tree, no owner", async () => {
    const out = JSON.parse((await text(compendiumChunks(entity(book())))).text);
    expect(out).toMatchObject({ schemaVersion: "compendium-v1.0.0", format: "rolecall-compendium", tree: null, nodeConstraints: [], counts: { totalEntries: 3, typedEntries: 2, classicEntries: 1 } });
    expect(out.lorebook).toMatchObject({ name: "Harbor", description: "Where the boats are.", token_budget: 900, genre: "noir", tags: ["sea"] });
    expect(out.lorebook).not.toHaveProperty("creator_id");
    expect(out.categories).toEqual([{ id: "cat1", name: "Places", sort_order: 2, enabled: true }]);
    const [harbor, wolf] = out.entries;
    expect(harbor).toMatchObject({ id: "k1", title: "Harbor Lore", content: "Salt and rope.", case_sensitive: true, scan_depth: 6, position: "depth", category_id: "cat1", is_featured: false });
    expect(wolf).toMatchObject({ id: "c1", sort_order: 7, is_featured: true, metadata: { entry_type: "character", structured_data: { name: "Lycanthrope" } } });
    expect(wolf.secondary_triggers).toEqual([{ keyword: "wolf", isRegex: true, flags: "i" }]);
  });

  test("it arrives a piece at a time: a header, one chunk per entry, a footer, never one buffer", async () => {
    const big = { ...book(), entries: Array.from({ length: 300 }, (_, i) => ({ ...emptyLoreEntry(`e${i}`), title: `Entry ${i}`, content: "x".repeat(200) })) };
    const { text: file, count } = await text(compendiumChunks(entity(big)));
    expect(count).toBe(300 + 2);
    expect(JSON.parse(file).entries).toHaveLength(300);
  });
});

describe("reading it back", () => {
  test("a Bunzai export read by Bunzai gives the same book", async () => {
    const original = book();
    const { text: file } = await text(compendiumChunks(entity(original)));
    expect(compendium.detect({ text: file })).toBe(1);
    const back = compendium.toCanonical({ text: file });
    expect(back.body).toEqual(original);
  });

  test("the older lorebook codec does not claim a compendium file, and the compendium codec does not claim a v1 lorebook", async () => {
    const { text: file } = await text(compendiumChunks(entity(book())));
    expect(lorebook.detect({ text: file })).toBe(0);
    const v1 = JSON.stringify({ schemaVersion: "1.0.0", exportDate: "2026-01-01T00:00:00.000Z", lorebook: { name: "A", entries: [] } });
    expect(compendium.detect({ text: v1 })).toBe(0);
    expect(compendium.detect({ text: "{}" })).toBe(0);
    expect(compendium.detect({ text: "not json" })).toBe(0);
  });

  const rc = () => ({
    schemaVersion: "compendium-v1.0.0", format: "rolecall-compendium", exportDate: "2026-02-02T00:00:00.000Z",
    lorebook: { id: "lb1", name: "Aetheria", description: null, creator_id: "u1", status: "published", global_scan_depth: 4, token_budget: 0, tags: ["oc"], lorebook_type: "world" },
    entries: [
      { id: "a", lorebook_id: "lb1", title: "Skyports", content: "Docks.", enabled: true, triggers: [{ keyword: "skyport", isRegex: false }], sort_order: 3, position: "world", category_id: null, token_count: 12, allow_recursion: true, origin: "imported", created_at: "2026-01-01", metadata: { entry_type: "location", structured_data: { name: "Skyports" }, original_classic_content: "Docks." }, is_featured: true },
      { id: "b", lorebook_id: "lb1", title: "Plain", content: "Plain.", enabled: false, triggers: [], metadata: null },
    ],
    tree: { tree_data: { root: {} }, version: 2 },
    nodeConstraints: [{ node_id: "a", user_locked: true }],
    categories: [{ id: "c1", name: "Skies", sort_order: 1, enabled: true, parent_category_id: null }],
    counts: { totalEntries: 2, typedEntries: 1, classicEntries: 1 },
  });

  test("RoleCall's own file reads into typed entries and writes back with nothing lost", () => {
    const raw = rc();
    const read = compendium.toCanonical({ text: JSON.stringify(raw) });
    expect(read.body.name).toBe("Aetheria");
    expect(read.body.entries.map((e) => [e.id, e.enabled, e.sortOrder])).toEqual([["a", true, 3], ["b", false, 100]]);
    expect(read.body.entries[0]!.metadata).toMatchObject({ entry_type: "location", featured: true });
    expect(read.body.categories).toEqual([{ id: "c1", name: "Skies", sortOrder: 1, enabled: true }]);
    const written = JSON.parse(compendium.fromCanonical(read).text!);
    expect(written).toEqual(raw);
  });

  test("an entry the person edited is written over the raw row; RoleCall-only columns beside it stay", () => {
    const read = compendium.toCanonical({ text: JSON.stringify(rc()) });
    read.body.entries[0] = { ...read.body.entries[0]!, content: "New docks." };
    const written = JSON.parse(compendium.fromCanonical(read).text!);
    expect(written.entries[0]).toMatchObject({ content: "New docks.", token_count: 12, allow_recursion: true, origin: "imported" });
    expect(written.tree).toEqual(rc().tree);
  });

  test("a malformed row value falls back to the default instead of poisoning the entry", () => {
    const raw = rc();
    Object.assign(raw.entries[1]!, { position: "sideways", role: 7, probability: "high", triggers: [{ keyword: 4 }, { keyword: "ok", isRegex: false }] });
    const entry = compendium.toCanonical({ text: JSON.stringify(raw) }).body.entries[1]!;
    expect(entry).toMatchObject({ position: emptyLoreEntry("").position, role: "system", probability: 100, triggers: [{ keyword: "ok", isRegex: false }] });
  });
});
