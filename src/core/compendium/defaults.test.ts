/** The one table of Compendium defaults against the Compendium defaults (04b section 9) and RoleCall's Settings page. */
import { expect, test } from "bun:test";
import { ENTRY_TYPES } from "./types";
import { accessOf, canRead, canWrite, resolveCompendium, writeBookOf } from "./defaults";

test("a scene with nothing saved is off, recalls ten entries, files the next message, and reads every book read only", () => {
  const r = resolveCompendium(undefined);
  expect(r.on).toBe(false);
  expect(r.recall).toEqual({ on: true, guide: undefined, guidance: "", maxEntries: 10, minEntries: 0, contextMessages: 20, detail: "taglines", depth: 2, bookDisplay: "unified", keywordHints: true });
  expect(r.filing).toMatchObject({ on: true, everyN: 1, wait: 1 });
  expect(r.filing.allow).toEqual(ENTRY_TYPES);
  expect(accessOf(undefined, "any")).toBe("read_only");
  expect(writeBookOf(undefined)).toBeUndefined();
});

test("a saved value wins and the rest still resolve to the default", () => {
  const r = resolveCompendium({ on: true, recall: { maxEntries: 4, guide: "g1" } });
  expect(r.recall).toMatchObject({ maxEntries: 4, guide: "g1", minEntries: 0, on: true });
});

test("access: read_only and read_write are read, write_only is never read, off is neither; a write book counts only while writable", () => {
  expect(["off", "read_only", "read_write", "write_only"].map((a) => [canRead(a as never), canWrite(a as never)])).toEqual([[false, false], [true, false], [true, true], [false, true]]);
  expect(writeBookOf({ writeBook: "a", books: { a: { access: "read_only" } } })).toBeUndefined();
  expect(writeBookOf({ writeBook: "a", books: { a: { access: "read_write" } } })).toBe("a");
});
