/**
 * Which books a scene reads (2e-d4 plan step 1): order and dedupe across the three sources, `off`
 * disables without dropping the book, and a missing (or trashed) library book is null, never a throw.
 */
import { describe, expect, test } from "bun:test";
import type { CharacterBody } from "../entities/character/schema";
import type { LorebookBody } from "../entities/lorebook/schema";
import type { PersonaBody } from "../entities/persona/schema";
import { resolveBooks, type ReadLorebook } from "./scene-lore";

const character = { identity: { name: "Vera" }, knowledgeRefs: ["a", "b"] } as CharacterBody;
const persona = { name: "Chi", content: "", knowledgeRefs: ["b", "c"] } as PersonaBody;

const bookBody = (id: string): LorebookBody => ({
  name: `Book ${id}`,
  tags: [],
  globalCaseSensitive: false,
  globalMatchWholeWords: false,
  globalScanDepth: 4,
  globalRecursion: false,
  tokenBudget: 1_000,
  budgetMode: "token",
  entryBudget: 10,
  entries: [],
});
const library: Record<string, LorebookBody> = { a: bookBody("a"), b: bookBody("b"), c: bookBody("c") };
const read: ReadLorebook = async (id) => (library[id] ? { id, name: library[id]!.name, body: library[id]! } : null);

describe("resolveBooks", () => {
  test("orders the character's refs, then the persona's, then the scene's own, and keeps each id once by its first source", async () => {
    const resolved = await resolveBooks(character, persona, { added: ["c", "d"], off: [] }, read);
    expect(resolved.map((r) => [r.id, r.source])).toEqual([
      ["a", "character"],
      ["b", "character"],
      ["c", "persona"],
      ["d", "scene"],
    ]);
  });

  test("off disables a book without dropping it, whatever its source", async () => {
    const resolved = await resolveBooks(character, undefined, { added: [], off: ["a"] }, read);
    expect(resolved.find((r) => r.id === "a")).toMatchObject({ source: "character", enabled: false });
    expect(resolved.find((r) => r.id === "b")).toMatchObject({ enabled: true });
  });

  test("a missing library book is null, not a throw; a trashed book looks the same to the caller", async () => {
    const resolved = await resolveBooks(character, undefined, { added: ["ghost"], off: [] }, read);
    expect(resolved.find((r) => r.id === "ghost")).toEqual({ id: "ghost", source: "scene", enabled: true, book: null });
  });

  test("with no persona and no scene lore, only the character's books resolve", async () => {
    const resolved = await resolveBooks(character, undefined, undefined, read);
    expect(resolved.map((r) => r.id)).toEqual(["a", "b"]);
  });
});
