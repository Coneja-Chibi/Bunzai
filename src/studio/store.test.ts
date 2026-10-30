/**
 * StudioStore: the Studio's view of the library (temp roots only; the test sandbox gives each root
 * its own encrypted library). Containment and validation, keep-both, versions, the Trash, and the
 * editor's compare-and-save. What a plain folder holds is the folder import's business, tested at
 * the end through its reader.
 */
import { describe, expect, test, beforeEach } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { emptyLorebookBody } from "../core/lore";
import { StudioLockedError, StudioValidationError } from "./errors";
import { readStudioFolder } from "./folder-reader";
import { StudioStore } from "./store";
import { createContentStore } from "../stage/store/content-store";
import { memoryDocumentBackend } from "../stage/store/memory/document-backend";
import { entityRevision } from "../kit/changes/revision";
import { tempDir } from "./test-temp-dir";

/** A plain folder on disk, for the import reader. */
async function plantFile(_root: string, path: string, body: string): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, body);
}

const ent = (id: string, kind = "character") => ({
  schemaVersion: CANONICAL_SCHEMA_VERSION,
  kind,
  id,
  body: {
    identity: { name: id },
    persona: {},
    prompts: {},
    greetings: {},
    examples: {},
    media: {},
    attribution: {},
    discovery: {},
  },
});

describe("StudioStore containment", () => {
  let root: string;
  let store: StudioStore;

  beforeEach(async () => {
    root = await tempDir("vaude-store-");
    store = new StudioStore(root);
  });

  test("save + read + list happy path", async () => {
    const s = await store.save(ent("vera"));
    expect(s.id).toBe("vera");
    const got = await store.read("character", "vera");
    expect(got?.id).toBe("vera");
    const list = await store.list("character");
    expect(list.some((e) => e.id === "vera")).toBe(true);
  });

  test("the listing carries a piece's tags, so the Library's search can find it by them", async () => {
    const tagged = ent("nuit");
    tagged.body.discovery = { tags: ["tarot", "oracle"] } as never;
    await store.save(tagged);
    await store.save(ent("plain"));
    const list = await store.list("character");
    expect(list.find((e) => e.id === "nuit")?.tags).toEqual(["tarot", "oracle"]);
    // No tags is no field, not an empty list on every summary.
    expect(list.find((e) => e.id === "plain")).not.toHaveProperty("tags");
  });

  test("rejects path traversal kind/id without writing outside", async () => {
    const sentinel = join(root, "..", "vaude-sentinel-outside.txt");
    // place sentinel outside store root sibling
    const outside = join(tmpdir(), `vaude-outside-${Date.now()}.txt`);
    await writeFile(outside, "safe");
    await expect(store.save({ ...ent("x"), kind: "../etc" })).rejects.toBeInstanceOf(
      StudioValidationError,
    );
    await expect(store.read("character", "../escape")).rejects.toBeInstanceOf(StudioValidationError);
    await expect(store.list("../../../tmp")).rejects.toBeInstanceOf(StudioValidationError);
    const still = await Bun.file(outside).text();
    expect(still).toBe("safe");
    await rm(outside, { force: true });
    void sentinel;
  });

  test("keep-both mints sibling id", async () => {
    await store.save(ent("twin"));
    const s2 = await store.save(ent("twin"));
    expect(s2.id).toBe("twin-2");
  });

  test("concurrent keep-both saves all receive unique ids", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => store.save(ent("same"))),
    );
    expect(new Set(results.map((result) => result.id)).size).toBe(results.length);
    expect(await store.list("character")).toHaveLength(results.length);
  });

  test("delete moves the piece to the Trash, retires its id, reports absence honestly, refuses traversal", async () => {
    await store.save(ent("gone"));
    expect(await store.delete("character", "gone")).toBe(true);
    expect(await store.read("character", "gone")).toBeNull();
    // deleting what is not there is false, never a throw (idempotent from the UI's view)
    expect(await store.delete("character", "gone")).toBe(false);
    await expect(store.delete("character", "../escape")).rejects.toBeInstanceOf(
      StudioValidationError,
    );
    await expect(store.delete("../etc", "x")).rejects.toBeInstanceOf(StudioValidationError);
    const [grave] = await store.graveyard("character");
    expect(grave?.id).toBe("gone");
    expect((await store.save(ent("gone"))).id).toBe("gone-2");
    expect((await store.restore(grave!.graveId))?.id).toBe("gone");
  });

  test("every piece carries its library version, and a save that changes nothing makes none and is reported", async () => {
    const reported: string[] = [];
    const content = createContentStore(memoryDocumentBackend(), Date.now, {
      onUnchangedSave: (kind, id) => reported.push(`${kind}/${id}`),
    });
    const store = new StudioStore(root, () => content);
    expect((await store.save(ent("ver"))).version).toBe(1);
    expect((await store.save(ent("ver"), { overwrite: true })).version).toBe(1);
    expect(reported).toEqual(["character/ver"]);
    const edited = { ...ent("ver"), body: { ...ent("ver").body, identity: { name: "Edited" } } };
    expect((await store.save(edited, { overwrite: true })).version).toBe(2);
    expect((await store.readVersioned("character", "ver"))?.version).toBe(2);
    expect((await store.list("character")).find((e) => e.id === "ver")?.version).toBe(2);
  });

  test("with no library open it refuses as locked and never reads the folder", async () => {
    await writeFile(join(root, "stray.json"), "{}");
    const closed = new StudioStore(root, () => null);
    await expect(closed.list()).rejects.toBeInstanceOf(StudioLockedError);
    await expect(closed.read("character", "vera")).rejects.toBeInstanceOf(StudioLockedError);
    await expect(closed.save(ent("vera"))).rejects.toBeInstanceOf(StudioLockedError);
  });

  test("the folder import lists every safe damaged file with an exact user-safe reason", async () => {
    await plantFile(root, join(root, "character", "healthy.json"), JSON.stringify(ent("healthy")));
    const characterDir = join(root, "character");
    await plantFile(root, join(characterDir, "truncated.json"), '{"schemaVersion":');
    await plantFile(root, join(characterDir, "primitive.json"), "42");
    await plantFile(
      root,
      join(characterDir, "wrong-schema.json"),
      JSON.stringify({ ...ent("wrong-schema"), body: { identity: { name: "Incomplete" } } }),
    );
    await plantFile(
      root,
      join(characterDir, "wrong-kind.json"),
      JSON.stringify({
        schemaVersion: CANONICAL_SCHEMA_VERSION,
        kind: "lorebook",
        id: "wrong-kind",
        body: emptyLorebookBody("Wrong kind"),
      }),
    );
    await plantFile(root, join(characterDir, "wrong-id.json"), JSON.stringify(ent("different-id")));
    await plantFile(root, join(characterDir, ".tmp-orphan.json"), '{"broken":');

    const read = await readStudioFolder(root);
    expect(read.pieces.map((piece) => piece.entity.id)).toEqual(["healthy"]);
    expect(read.damaged).toEqual([
      { kind: "character", id: "primitive", reason: "schema-mismatch" },
      { kind: "character", id: "truncated", reason: "unreadable-json" },
      { kind: "character", id: "wrong-id", reason: "id-mismatch" },
      { kind: "character", id: "wrong-kind", reason: "kind-mismatch" },
      { kind: "character", id: "wrong-schema", reason: "schema-mismatch" },
    ]);
  });

  test("rejects an entity whose schemaVersion read() would refuse (no invisible files)", async () => {
    // Without this gate, save() writes a file that read()/list() then treat as corrupt forever:
    // the piece exists on disk but never appears in the studio again.
    const { schemaVersion: _v, ...bare } = ent("ghost");
    await expect(store.save(bare as never)).rejects.toBeInstanceOf(StudioValidationError);
    await expect(store.save({ ...ent("ghost"), schemaVersion: "0" } as never)).rejects.toBeInstanceOf(
      StudioValidationError,
    );
    const list = await store.list("character");
    expect(list.some((e) => e.id === "ghost")).toBe(false);
  });

  test("rejects malformed nested canonical data before writing", async () => {
    const malformed = {
      ...ent("wrong-shape"),
      body: { ...ent("wrong-shape").body, identity: { name: 42 } },
    };
    await expect(store.save(malformed)).rejects.toBeInstanceOf(StudioValidationError);
    expect(await store.read("character", "wrong-shape")).toBeNull();
  });

  test("rejects malformed optional canonical data before writing", async () => {
    const malformed = {
      ...ent("wrong-optional"),
      body: { ...ent("wrong-optional").body, settings: "not an object" },
    };
    await expect(store.save(malformed)).rejects.toBeInstanceOf(StudioValidationError);
    expect(await store.read("character", "wrong-optional")).toBeNull();
  });

  test("overwrite preserves importedAt", async () => {
    const s1 = await store.save(ent("keep"));
    const first = s1.importedAt;
    expect(first).toBeTruthy();
    await new Promise((r) => setTimeout(r, 5));
    const edited = { ...ent("keep"), body: { ...ent("keep").body, identity: { name: "Kept, edited" } } };
    const s2 = await store.save(edited, { overwrite: true });
    expect(s2.version).toBe(2);
    expect(s2.importedAt).toBe(first);
    const disk = await store.read("character", "keep");
    const um = disk?.original?.["vaud-studio"]?.unmapped;
    expect(um?.["importedAt"]).toBe(first);
  });

  test("compareAndSave writes once for the expected revision and rejects a stale retry", async () => {
    await store.save(ent("revision"));
    const baseline = (await store.read("character", "revision"))!;
    const expectedRevision = entityRevision(baseline);
    const baselineBody = baseline.body as ReturnType<typeof ent>["body"];
    const changed = {
      ...baseline,
      body: {
        ...baselineBody,
        identity: { ...baselineBody.identity, name: "new" },
      },
    };

    const saved = await store.compareAndSave(changed, expectedRevision);
    expect(saved.status).toBe("saved");
    expect(((await store.read("character", "revision"))!.body as { identity: { name: string } })
      .identity.name).toBe("new");
    if (saved.status !== "saved") throw new Error("expected save");
    const next = await store.compareAndSave({
      ...changed,
      body: {
        ...changed.body,
        identity: { ...(changed.body as { identity: object }).identity, name: "newer" },
      },
    }, saved.revision);
    expect(next.status).toBe("saved");

    const stale = await store.compareAndSave({
      ...changed,
      body: {
        ...changed.body,
        identity: { ...(changed.body as { identity: object }).identity, name: "stale overwrite" },
      },
    }, expectedRevision);
    expect(stale.status).toBe("stale");
    expect(((await store.read("character", "revision"))!.body as { identity: { name: string } })
      .identity.name).toBe("newer");
  });

  test("two concurrent compareAndSave calls from one revision have exactly one winner", async () => {
    await store.save(ent("race"));
    const baseline = (await store.read("character", "race"))!;
    const expectedRevision = entityRevision(baseline);
    const body = baseline.body as ReturnType<typeof ent>["body"];
    const result = await Promise.all([
      store.compareAndSave({
        ...baseline,
        body: { ...body, identity: { ...body.identity, name: "first" } },
      }, expectedRevision),
      store.compareAndSave({
        ...baseline,
        body: { ...body, identity: { ...body.identity, name: "second" } },
      }, expectedRevision),
    ]);
    expect(result.map((item) => item.status).sort()).toEqual(["saved", "stale"]);
  });

  test("comparePatch saves without stamping, and reports stale/missing like compareAndSave", async () => {
    const preset = {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "preset",
      id: "p-patch",
      body: { name: "P", prompts: [{ id: "a", name: "a", content: "A", role: "system", enabled: true, systemPrompt: false, marker: false, placement: "relative", injectionDepth: 0, injectionOrder: 0, forbidOverrides: false }] },
    };
    const created = await store.save(preset);
    const before = (await store.read("preset", "p-patch"))!;

    const head = { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "preset", id: "p-patch", body: { name: "P renamed", prompts: [] } };
    const patched = await store.comparePatch("preset", "p-patch", entityRevision(before), { head });
    expect(patched.status).toBe("saved");
    if (patched.status !== "saved") throw new Error("expected saved");
    // The committed summary preserves the stamp without reopening the whole entity.
    expect(patched.summary.importedAt).toBe(created.importedAt);
    expect(patched.summary.accent).toBe(created.accent);
    expect(patched.summary.version).toBe((created.version ?? 1) + 1);
    const after = (await store.read("preset", "p-patch"))!;
    expect((after.body as { name: string }).name).toBe("P renamed");

    const stale = await store.comparePatch("preset", "p-patch", entityRevision(before), { head });
    expect(stale.status).toBe("stale");

    const missing = await store.comparePatch("preset", "ghost-patch", "whatever", { head: { kind: "preset", id: "ghost-patch", body: { prompts: [] } } });
    expect(missing.status).toBe("missing");
  });

  test("compareAndCreate saves the requested id once and refuses a collision", async () => {
    const store = new StudioStore(root);
    const created = await store.compareAndCreate(ent("eros"));
    const collision = await store.compareAndCreate({
      ...ent("eros"),
      body: { ...ent("eros").body, identity: { name: "Replacement" } },
    });

    expect(created.status).toBe("saved");
    expect(collision.status).toBe("exists");
    expect(((await store.read("character", "eros"))!.body as {
      identity: { name: string };
    }).identity.name).toBe("eros");
    expect(await store.read("character", "eros-2")).toBeNull();
  });

  test("two concurrent compareAndCreate calls for one id have exactly one winner", async () => {
    const [first, second] = await Promise.all([
      store.compareAndCreate(ent("single")),
      store.compareAndCreate({
        ...ent("single"),
        body: { ...ent("single").body, identity: { name: "Other" } },
      }),
    ]);
    expect([first.status, second.status].sort()).toEqual(["exists", "saved"]);
    expect(await store.read("character", "single")).not.toBeNull();
    expect(await store.read("character", "single-2")).toBeNull();
  });
});

describe("files the folder import cannot bring in are reported, not skipped", () => {
  /**
   * A filename that cannot form a canonical id still needs an inventory entry so the person can
   * identify the file and understand why it was not imported.
   */
  test("a filename that cannot be an id is reported as unusable-filename", async () => {
    const dir = await tempDir("kit-unlisted-");
    const good = { schemaVersion: "1", kind: "preset", id: "clean-one", body: { name: "Clean", prompts: [] } };
    await plantFile(dir, join(dir, "preset", "clean-one.json"), JSON.stringify(good));
    await plantFile(dir, join(dir, "preset", "Aegir Main.json"), JSON.stringify(good));
    await plantFile(dir, join(dir, "preset", "Chi's Universe!.json"), JSON.stringify(good));

    const inventory = await readStudioFolder(dir);

    expect(inventory.pieces.map((e) => e.entity.id)).toEqual(["clean-one"]);
    expect(inventory.damaged.length).toBe(2);
    for (const entry of inventory.damaged) expect(entry.reason).toBe("unusable-filename");
    // The name rides for display, so a person can tell WHICH of their files is meant.
    expect(inventory.damaged.map((d) => d.id).sort()).toEqual(["Aegir Main", "Chi's Universe!"]);
  });

  test("a raw platform export is reported as schema-mismatch rather than vanishing", async () => {
    const dir = await tempDir("kit-unlisted-raw-");
    // What a SillyTavern preset export actually looks like: no canonical envelope at all.
    await plantFile(
      dir,
      join(dir, "preset", "raw-export.json"),
      JSON.stringify({ chat_completion_source: "custom", temperature: 1, openai_model: "gpt-4" }),
    );

    const inventory = await readStudioFolder(dir);
    expect(inventory.pieces.length).toBe(0);
    expect(inventory.damaged.length).toBe(1);
    expect(inventory.damaged[0]?.id).toBe("raw-export");
  });
});
