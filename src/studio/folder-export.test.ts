/**
 * The folder export (folder-export.ts) against the plan's exit test for phase 1 step two: a
 * 125-pieces-per-kind studio folder is imported, edited, exported, and imported again into a fresh library,
 * and every piece and document comes back exactly (same revision, so the same bytes the library
 * hashed). Also the refusals: a destination that is not empty, the studio folder, a folder inside it,
 * and a locked library, none of which writes anything. Throwaway folders only.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { emptyLorebookBody } from "../core/lore";
import { emptyHtmlDocBody } from "../entities/htmldoc/schema";
import { emptyPackBody } from "../entities/pack/schema";
import { emptyPersonaBody } from "../entities/persona/schema";
import { emptyPresetBody } from "../entities/preset/schema";
import { emptyQuickReplyBody } from "../entities/quickreply/schema";
import { emptyRegexSetBody } from "../entities/regex/schema";
import type { ContentStore } from "../stage/contracts/content-store";
import type { StateKey, StateStore } from "../stage/contracts/state-store";
import { LockedError } from "../stage/crypto/keyring-errors";
import { createContentStore } from "../stage/store/content-store";
import { memoryDocumentBackend } from "../stage/store/memory/document-backend";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { ExportRefusedError, exportLibraryToFolder } from "./folder-export";
import { importFolderIntoLibrary } from "./folder-import";
import { STUDIO_ENTITY_KINDS, type StudioEntityKind } from "./path-policy";
import { StudioStore } from "./store";
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
};
const piece = (kind: StudioEntityKind, id: string, name: string) => ({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind, id, body: bodies[kind](name) });

const temp = (): string => tempDirSync("bunraku-export-");
const library = (): { content: ContentStore; state: StateStore } => ({ content: createContentStore(memoryDocumentBackend()), state: memoryStateStore() });
const roomy = { freeSpace: () => Number.MAX_SAFE_INTEGER };

/** Every live piece's revision, by kind and id: equal maps mean equal libraries. */
async function revisions(content: ContentStore): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const kind of STUDIO_ENTITY_KINDS) {
    for (const s of await content.list(kind)) out[`${kind}/${s.id}`] = (await content.read(kind, s.id))!.revision;
  }
  return out;
}

const DOCUMENTS = {
  "settings.json": '{"theme":"stage"}',
  "collections.json": '{"collections":[{"id":"favs","name":"Favourites","members":[{"kind":"character","id":"character-7"}]}]}',
  "engines.json": '{"roots":[]}',
  "graveyard.json": '{"graves":[]}',
  "variables.json": '{"mood":{"value":"calm","createdAt":1,"updatedAt":1}}',
  "meter.json": '{"version":1,"models":{}}',
  "guides.json": '{"guides":[]}',
  "loadouts.json": '{"version":1,"loadouts":[],"receipts":[]}',
};

describe("folder export", () => {
  test("a 125-pieces-per-kind folder: import, edit, export, import again, and every piece and document comes back exactly", async () => {
    const studio = temp();
    const source = join(temp(), "hoplight");
    let made = 0;
    for (const kind of STUDIO_ENTITY_KINDS) {
      mkdirSync(join(source, kind), { recursive: true });
      for (let i = 0; i < 125; i++) {
        writeFileSync(join(source, kind, `${kind}-${i}.json`), JSON.stringify(piece(kind, `${kind}-${i}`, `${kind} number ${i}`)));
        made++;
      }
    }
    for (const [file, text] of Object.entries(DOCUMENTS)) writeFileSync(join(source, file), text);
    writeFileSync(join(source, "character", "broken.json"), '{"schemaVersion":');
    writeFileSync(join(source, "portrait.png"), "not really a png");
    const total = STUDIO_ENTITY_KINDS.length * 125;
    expect(made).toBe(total);

    const first = library();
    const imported = await importFolderIntoLibrary(source, first, roomy);
    expect(imported.pieces).toBe(total);
    expect(imported.damaged).toEqual([{ kind: "character", id: "broken", reason: "unreadable-json" }]);

    // Edit through the Studio, as the app does: ten renames, one delete.
    const store = new StudioStore(studio, () => first.content);
    for (let i = 0; i < 10; i++) await store.save(piece("preset", `preset-${i}`, `edited ${i}`), { overwrite: true });
    await store.delete("regex", "regex-0");

    const out = join(temp(), "exported");
    const written = await exportLibraryToFolder(out, first, { studioDir: studio });
    expect(written).toEqual({ folder: out, pieces: total - 1, documents: 8, damaged: [], droppedFromCollections: 0 });
    expect(readdirSync(join(out, "..")).filter((n) => n.includes(".exporting-"))).toEqual([]);

    const second = library();
    const again = await importFolderIntoLibrary(out, second, roomy);
    expect(again).toMatchObject({ pieces: total - 1, renamed: [], damaged: [], leftInFolder: 0 });
    expect(await revisions(second.content)).toEqual(await revisions(first.content));
    for (const [file, text] of Object.entries(DOCUMENTS)) {
      const key = file.slice(0, -5) as StateKey;
      expect(await second.state.read(key)).toBe(text);
    }
    expect((await second.content.read("preset", "preset-3"))?.entity.body).toMatchObject({ name: "edited 3" });
    expect(await second.content.read("regex", "regex-0")).toBeNull();
  }, 120_000);

  test("refuses a folder that is not empty, and writes nothing into it", async () => {
    const out = temp();
    writeFileSync(join(out, "keep.txt"), "mine");
    const lib = library();
    await lib.content.save(piece("character", "vera", "Vera"));
    await expect(exportLibraryToFolder(out, lib, { studioDir: temp() })).rejects.toBeInstanceOf(ExportRefusedError);
    expect(readdirSync(out)).toEqual(["keep.txt"]);
  });

  test("refuses the studio folder and anywhere inside it, in any spelling", async () => {
    const studio = temp();
    const lib = library();
    await expect(exportLibraryToFolder(studio, lib, { studioDir: studio })).rejects.toBeInstanceOf(ExportRefusedError);
    const inside = join(studio, "backup");
    await expect(exportLibraryToFolder(inside, lib, { studioDir: studio })).rejects.toBeInstanceOf(ExportRefusedError);
    expect(existsSync(inside)).toBe(false);
    if (process.platform !== "linux") {
      await expect(exportLibraryToFolder(studio.toUpperCase(), lib, { studioDir: studio })).rejects.toBeInstanceOf(ExportRefusedError);
    }
  });

  test("an empty folder that already exists is used; a locked library writes nothing at all", async () => {
    const empty = temp();
    const lib = library();
    await lib.content.save(piece("character", "vera", "Vera"));
    expect((await exportLibraryToFolder(empty, lib, { studioDir: temp() })).pieces).toBe(1);
    expect(readdirSync(join(empty, "character"))).toEqual(["vera.json"]);

    const locked: ContentStore = { ...lib.content, inventory: () => Promise.reject(new LockedError()) };
    const out = join(temp(), "never");
    await expect(exportLibraryToFolder(out, { content: locked, state: lib.state }, { studioDir: temp() })).rejects.toBeInstanceOf(LockedError);
    expect(existsSync(out)).toBe(false);
    expect(readdirSync(join(out, "..")).filter((n) => n.includes(".exporting-"))).toEqual([]);
  });

  test("a collection naming a deleted piece does not go out, so a new piece after re-import never inherits it", async () => {
    const studio = temp();
    const lib = library();
    const store = new StudioStore(studio, () => lib.content);
    await store.save(piece("character", "vera", "Vera"));
    await store.save(piece("character", "nuit", "Nuit"));
    await lib.state.write("collections", JSON.stringify({ collections: [{ id: "favs", name: "Favourites", members: [{ kind: "character", id: "vera" }, { kind: "character", id: "nuit" }] }] }));
    await store.delete("character", "vera");

    const out = join(temp(), "exported");
    expect((await exportLibraryToFolder(out, lib, { studioDir: studio })).droppedFromCollections).toBe(1);
    const again = library();
    await importFolderIntoLibrary(out, again, roomy);
    await again.content.save(piece("character", "vera", "A different Vera"));
    expect(JSON.parse((await again.state.read("collections"))!).collections[0].members).toEqual([{ kind: "character", id: "nuit" }]);
  });

  test("refuses a file as the destination, a missing parent, and a name that only looks outside the studio", async () => {
    const studio = temp();
    const lib = library();
    const file = join(temp(), "a-file");
    writeFileSync(file, "mine");
    await expect(exportLibraryToFolder(file, lib, { studioDir: studio })).rejects.toBeInstanceOf(ExportRefusedError);
    await expect(exportLibraryToFolder(join(temp(), "no", "such", "place"), lib, { studioDir: studio })).rejects.toBeInstanceOf(ExportRefusedError);
    await expect(exportLibraryToFolder(join(studio, "..backup"), lib, { studioDir: studio })).rejects.toBeInstanceOf(ExportRefusedError);
    expect(existsSync(join(studio, "..backup"))).toBe(false);
  });
});
