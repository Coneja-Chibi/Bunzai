/**
 * The narrator's lookup tool (04b "Narrator lookup", RoleCall `tv_during_gen_search`): read only, over the books the Compendium may
 * read in this scene, never a book set to off or write only, strict about its arguments, and offered only when the scene asked for it.
 */
import { describe, expect, test } from "bun:test";
import { emptyLoreEntry, emptyLorebookBody } from "../core/lore";
import type { Chat, ChatCompendium } from "../stage/contracts/chat-store";
import type { LoadedTurn } from "./scene-turn-load";
import { compendiumTools } from "./compendium-lookup";

const note = (id: string, title: string, content: string) => ({ ...emptyLoreEntry(id), title, content });
const harbor = { id: "b1", name: "Harbor", body: { ...emptyLorebookBody("Harbor"), entries: [note("e1", "Mira", "Mira keeps the lantern at Gull Point."), note("e2", "Gull Point", "A salt town with a red door.")] } };
const vault = { id: "b2", name: "Vault", body: { ...emptyLorebookBody("Vault"), entries: [note("v1", "Secret", "The vault key is under the clock.")] } };

const chat = (compendium?: ChatCompendium): Chat => ({ id: "c", ...(compendium ? { compendium } : {}) }) as unknown as Chat;
const loaded = (...books: (typeof harbor)[]): LoadedTurn => ({ lore: { books, recentFires: [] } }) as unknown as LoadedTurn;
const toolOf = (c: Chat, l: LoadedTurn) => compendiumTools({ chat: c, loaded: l })[0] as unknown as { definition: { function: { name: string; description: string } }; parse(raw: unknown): { args: unknown } | { error: string }; run(args: unknown, signal: undefined): Promise<{ text: string; detail?: Record<string, unknown> }> };

describe("compendiumTools", () => {
  test("none unless the Compendium and its Narrator explore tool are both on, and a book can be read", () => {
    expect(compendiumTools({ chat: chat(), loaded: loaded(harbor) })).toEqual([]);
    expect(compendiumTools({ chat: chat({ on: true }), loaded: loaded(harbor) })).toEqual([]);
    expect(compendiumTools({ chat: chat({ lookup: true }), loaded: loaded(harbor) })).toEqual([]);
    expect(compendiumTools({ chat: chat({ on: true, lookup: true }), loaded: loaded() })).toEqual([]);
    expect(compendiumTools({ chat: chat({ on: true, lookup: true }), loaded: loaded(harbor) })).toHaveLength(1);
  });

  test("a book set to off or write only is not in the description and is never searched or read", async () => {
    const t = toolOf(chat({ on: true, lookup: true, books: { b2: { access: "off" } } }), loaded(harbor, vault));
    expect(t.definition.function.name).toBe("explore_lorebook");
    expect(t.definition.function.description).toContain("Mira");
    expect(t.definition.function.description).not.toContain("Secret");
    const parsed = t.parse({ query: "vault key" }) as { args: unknown };
    expect((await t.run(parsed.args, undefined)).text).toContain("No entries match");
    const writeOnly = toolOf(chat({ on: true, lookup: true, books: { b2: { access: "write_only" } } }), loaded(harbor, vault));
    expect(writeOnly.definition.function.description).not.toContain("Secret");
    const open = toolOf(chat({ on: true, lookup: true, books: { b2: { access: "read_write" } } }), loaded(harbor, vault));
    expect(open.definition.function.description).toContain("Secret");
  });

  test("a query lists the matching entries with their handles; entry_ids reads them in full", async () => {
    const t = toolOf(chat({ on: true, lookup: true }), loaded(harbor));
    const found = await t.run((t.parse({ query: "red door" }) as { args: unknown }).args, undefined);
    expect(found.text).toContain("[e2] Gull Point");
    expect(found.text).not.toContain("[e1]");
    expect(found.detail).toMatchObject({ query: "red door", entries: [{ bookId: "b1", entryId: "e2", title: "Gull Point", bookName: "Harbor" }] });
    const read = await t.run((t.parse({ entry_ids: ["e1", "e9"] }) as { args: unknown }).args, undefined);
    expect(read.text).toContain("Mira keeps the lantern at Gull Point.");
    expect(read.text).toContain("e9");
    expect(read.detail).toMatchObject({ entries: [{ entryId: "e1", title: "Mira" }] });
    expect(JSON.stringify(read.detail)).not.toContain("lantern");
  });

  test("arguments are checked once and strictly: nothing to look for, wrong types, unknown keys, bad handles", () => {
    const t = toolOf(chat({ on: true, lookup: true }), loaded(harbor));
    for (const bad of [{}, { query: "" }, { query: 5 }, { query: "x".repeat(201) }, { entry_ids: [] }, { entry_ids: ["nope"] }, { entry_ids: "e1" }, { entry_ids: Array.from({ length: 11 }, (_, i) => `e${i + 1}`) }, { query: "a", node_id: "x" }]) {
      expect(t.parse(bad)).toHaveProperty("error");
    }
    expect(t.parse({ query: "  mira  " })).toEqual({ args: { query: "mira" } });
  });
});
