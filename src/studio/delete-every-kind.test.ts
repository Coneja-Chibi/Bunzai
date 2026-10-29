/**
 * Deleting works the same for every kind the Studio holds, on the real encrypted SQLite library the test sandbox gives each folder: the
 * piece goes to the Trash with its history, its name is free at once and its id is retired for
 * good, a restore always comes home with its history, an id differing only in case is the same id,
 * and emptying the Trash removes the piece for good without freeing its id.
 */
import { describe, expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { emptyLorebookBody } from "../core/lore";
import { emptyHtmlDocBody } from "../entities/htmldoc/schema";
import { emptyPackBody } from "../entities/pack/schema";
import { emptyPersonaBody } from "../entities/persona/schema";
import { emptyPresetBody } from "../entities/preset/schema";
import { emptyQuickReplyBody } from "../entities/quickreply/schema";
import { emptyRegexSetBody } from "../entities/regex/schema";
import { StudioNotFoundError } from "./errors";
import { libraryContentFor } from "./library-content";
import { STUDIO_ENTITY_KINDS, type StudioEntityKind } from "./path-policy";
import { StudioStore } from "./store";
import { emptySkillBody } from "../entities/skill/schema";
import { tempDirSync } from "./test-temp-dir";

const bodies: Record<StudioEntityKind, (name: string) => unknown> = {
  character: (name) => ({ identity: { name }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} }),
  lorebook: (name) => emptyLorebookBody(name),
  persona: (name) => emptyPersonaBody(name),
  pack: (name) => emptyPackBody(name),
  regex: (name) => emptyRegexSetBody(name),
  preset: (name) => emptyPresetBody(name),
  htmldoc: (name) => ({ ...emptyHtmlDocBody(), name }),
  quickreply: (name) => emptyQuickReplyBody(name),
  promptformat: (name) => ({ name }),
  scriptsheet: (name) => ({ name, content: "Be brief." }),
  tool: (name) => ({ name, description: "Roll for luck.", fields: [], action: { kind: "dice", id: "luck" } }),
  dice: (name) => ({ name, description: "", type: "table", rows: [{ text: "Sparks", weight: 1 }] }),
  formula: (name) => ({ name, description: "", text: "{{mentions::storm}}" }),
  tracker: (name) => ({ name, description: "", layout: "record", note: "", fields: [{ name: "value", description: "", type: "number", default: 0 }] }),
  skill: (name) => emptySkillBody(name),
};
const piece = (kind: StudioEntityKind, id: string, name: string) => ({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind, id, body: bodies[kind](name) });

const studio = (): StudioStore => {
  return new StudioStore(tempDirSync("bunraku-delete-kinds-"));
};
const nameOf = (entity: { body?: unknown } | null): unknown => {
  const body = entity?.body as { name?: unknown; identity?: { name?: unknown } } | undefined;
  return body?.name ?? body?.identity?.name;
};

describe("delete, for every kind the Studio holds", () => {
  test("the kind list this covers is the Studio's whole list", () => {
    expect(Object.keys(bodies).sort()).toEqual([...STUDIO_ENTITY_KINDS].sort());
  });

  for (const kind of STUDIO_ENTITY_KINDS) {
    describe(kind, () => {
      test("goes to the Trash with its history; its name is free at once, its id is retired", async () => {
        const store = studio();
        await store.save(piece(kind, "vera", "First"));
        await store.save(piece(kind, "vera", "Second"), { overwrite: true });
        expect(await store.delete(kind, "vera")).toBe(true);

        expect(await store.read(kind, "vera")).toBeNull();
        expect((await store.list(kind)).map((e) => e.id)).toEqual([]);
        const [grave] = await store.graveyard(kind);
        expect(grave).toMatchObject({ kind, id: "vera" });
        expect(await store.delete(kind, "vera")).toBe(false);

        // Same name, new piece: the name is free, the id is not. Overwriting the deleted one is refused.
        await expect(store.save(piece(kind, "vera", "Second"), { overwrite: true })).rejects.toBeInstanceOf(StudioNotFoundError);
        const newcomer = await store.save(piece(kind, "vera", "Second"));
        expect(newcomer).toMatchObject({ id: "vera-2", version: 1 });
        expect(nameOf(await store.read(kind, "vera-2"))).toBe("Second");
      });

      test("a restore always comes home with its whole history, whatever was made since", async () => {
        const store = studio();
        await store.save(piece(kind, "vera", "First"));
        await store.save(piece(kind, "vera", "Second"), { overwrite: true });
        await store.delete(kind, "vera");
        await store.save(piece(kind, "vera", "Newcomer"));

        const [grave] = await store.graveyard(kind);
        expect(await store.restore(grave!.graveId)).toMatchObject({ id: "vera", version: 2 });
        const { versions } = await libraryContentFor(store.studioPath())!.versions(kind, "vera");
        expect(versions.map((v) => v.version)).toEqual([1, 2]);
        expect(nameOf(await store.read(kind, "vera"))).toBe("Second");
        expect(nameOf(await store.read(kind, "vera-2"))).toBe("Newcomer");
        expect(await store.graveyard(kind)).toEqual([]);
      });

      test("an id differing only in case is the same id, before and after a delete", async () => {
        const store = studio();
        await store.save(piece(kind, "Vera", "Capital"));
        expect((await store.save(piece(kind, "vera", "Lower"))).id).toBe("vera-2");
        await store.delete(kind, "VERA");
        expect(await store.read(kind, "Vera")).toBeNull();
        expect((await store.save(piece(kind, "vera", "After"))).id).toBe("vera-3");
      });

      test("emptying the Trash removes the piece for good, and its id stays retired", async () => {
        const store = studio();
        await store.save(piece(kind, "vera", "First"));
        await store.delete(kind, "vera");
        const [grave] = await store.graveyard(kind);
        await libraryContentFor(store.studioPath())!.purge(Date.now() + 1);
        expect(await store.graveyard(kind)).toEqual([]);
        expect(await store.restore(grave!.graveId)).toBeNull();
        expect((await store.save(piece(kind, "vera", "Later"))).id).toBe("vera-2");
        expect(await store.read(kind, "vera")).toBeNull();
      });
    });
  }
});
