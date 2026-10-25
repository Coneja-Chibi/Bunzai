/**
 * The Compendium's one book writer: a pure edit of a book's entries becomes one revision-checked patch of only the entries that
 * changed. Proven on a real library (a throwaway Studio root), with a store wrapper that lets "the person" edit between the
 * writer's read and its patch: a clean rebase saves both, a touched-entry collision writes nothing and says which entries.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { emptyLoreEntry, emptyLorebookBody } from "../core/lore";
import type { LorebookEntry } from "../entities/lorebook/schema";
import { StudioStore } from "./store";
import { tempDir } from "./test-temp-dir";
import { writeBook, type BookStore } from "./world-book-writer";

const entry = (id: string, content: string): LorebookEntry => ({ ...emptyLoreEntry(id), title: id, content });
const TITLE = (e: LorebookEntry) => `${e.id}=${e.content}`;

let store: StudioStore;
beforeEach(async () => {
  store = new StudioStore(await tempDir("vaude-book-writer-"));
  await store.save({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "lorebook", id: "bk", body: { ...emptyLorebookBody("Book"), entries: [entry("a", "A0"), entry("b", "B0"), entry("c", "C0")] } });
});

const entriesNow = async () => ((await store.read("lorebook", "bk")) as unknown as { body: { entries: LorebookEntry[] } }).body.entries.map(TITLE);
const setContent = (id: string, content: string) => (entries: readonly LorebookEntry[]) => entries.map((e) => (e.id === id ? { ...e, content } : e));

/** A store that runs `between` once, after the writer has read the book and before it patches. */
function racing(between: () => Promise<void>): BookStore & { patches: number } {
  let fired = false;
  const wrapped = {
    patches: 0,
    read: (kind: string, id: string) => store.read(kind, id),
    async comparePatch(...args: Parameters<StudioStore["comparePatch"]>) {
      if (!fired) { fired = true; await between(); }
      wrapped.patches++;
      return store.comparePatch(...args);
    },
  };
  return wrapped;
}

describe("the book writer", () => {
  test("one edit is one patch of only the changed entry, and the book is saved at a new revision", async () => {
    const counted = { patches: 0, read: store.read.bind(store), comparePatch: async (...a: Parameters<StudioStore["comparePatch"]>) => { counted.patches++; return store.comparePatch(...a); } };
    const result = await writeBook(counted, "bk", setContent("b", "B1"));
    expect(result.status).toBe("saved");
    if (result.status !== "saved") return;
    expect(result.changes.map((c) => [c.id, c.before?.content, c.after.content])).toEqual([["b", "B0", "B1"]]);
    expect(counted.patches).toBe(1);
    expect(await entriesNow()).toEqual(["a=A0", "b=B1", "c=C0"]);
  });

  test("an edit that changes nothing writes nothing", async () => {
    const counted = { patches: 0, read: store.read.bind(store), comparePatch: async (...a: Parameters<StudioStore["comparePatch"]>) => { counted.patches++; return store.comparePatch(...a); } };
    expect(await writeBook(counted, "bk", (entries) => entries.map((e) => ({ ...e })))).toEqual({ status: "unchanged" });
    expect(counted.patches).toBe(0);
  });

  test("a created entry lands at the end of the book", async () => {
    const result = await writeBook(store, "bk", (entries) => [...entries, entry("d", "D0")]);
    expect(result.status === "saved" && result.changes.map((c) => [c.id, c.before === undefined])).toEqual([["d", true]]);
    expect(await entriesNow()).toEqual(["a=A0", "b=B0", "c=C0", "d=D0"]);
  });

  test("a book that is not in the library is reported missing", async () => {
    expect(await writeBook(store, "ghost", setContent("a", "x"))).toEqual({ status: "missing" });
  });

  test("the person edited another entry in between: the edit is rebased onto their book and both survive", async () => {
    const theirs = racing(async () => {
      await writeBook(store, "bk", setContent("a", "A-by-person"));
    });
    const result = await writeBook(theirs, "bk", setContent("c", "C-by-pass"));
    expect(result.status).toBe("saved");
    expect(await entriesNow()).toEqual(["a=A-by-person", "b=B0", "c=C-by-pass"]);
  });

  test("the person edited the same entry in between: nothing is written and the entry is named", async () => {
    const theirs = racing(async () => {
      await writeBook(store, "bk", setContent("b", "B-by-person"));
    });
    const result = await writeBook(theirs, "bk", setContent("b", "B-by-pass"));
    expect(result).toEqual({ status: "conflict", ids: ["b"] });
    expect(await entriesNow()).toEqual(["a=A0", "b=B-by-person", "c=C0"]);
  });

  test("an entry the other writer added with the name the pass was about to create is a conflict, not a duplicate", async () => {
    const theirs = racing(async () => {
      await writeBook(store, "bk", (entries) => [...entries, entry("d", "D-by-person")]);
    });
    const result = await writeBook(theirs, "bk", (entries) => [...entries, entry("d", "D-by-pass")]);
    expect(result).toEqual({ status: "conflict", ids: ["d"] });
    expect(await entriesNow()).toEqual(["a=A0", "b=B0", "c=C0", "d=D-by-person"]);
  });

  test("writes to one book queue one after the other, so two passes never see each other as a stale edit", async () => {
    const results = await Promise.all([
      writeBook(store, "bk", setContent("a", "A1")),
      writeBook(store, "bk", setContent("b", "B1")),
      writeBook(store, "bk", setContent("c", "C1")),
    ]);
    expect(results.map((r) => r.status)).toEqual(["saved", "saved", "saved"]);
    expect(await entriesNow()).toEqual(["a=A1", "b=B1", "c=C1"]);
  });

  test("an edit that throws writes nothing and does not poison the queue", async () => {
    const failed = await writeBook(store, "bk", () => { throw new Error("boom"); }).then(() => null, (e: unknown) => e);
    expect((failed as Error).message).toBe("boom");
    expect((await writeBook(store, "bk", setContent("a", "A1"))).status).toBe("saved");
    expect(await entriesNow()).toEqual(["a=A1", "b=B0", "c=C0"]);
  });
});
