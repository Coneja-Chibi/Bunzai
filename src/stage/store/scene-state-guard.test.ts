/**
 * Scene state has one door. The tables that hold it (branch_state, branch_base, swipe_deltas, message_deltas, state_keyframes) are read and written only by
 * the chat store (src/stage/store/sqlite/); everything else goes through ChatStore's sceneState, sceneStateBefore, recordMessageDeltas
 * and the checkpoint's deltas, which is what keeps the tip cache and the keyframes in step with the deltas. The macro variables
 * moved there from branch_variables, so no code calls the removed `variables` / `changeVariables` methods, and the chat store
 * itself no longer touches branch_variables (the table stays, unread, for a library that has one).
 */
import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..", "..");
const TABLES = /\b(branch_state|branch_base|swipe_deltas|message_deltas|state_keyframes)\b/;
/** Where the tables may be named: the SQLite chat store (its methods, migration, health check, fingerprints and snapshot lists). */
const STORE = "src/stage/store/sqlite/";
const EXEMPT: Record<string, string> = {
  "src/stage/store/fake-snapshot-rig.ts": "a test stand-in that drops the tables to look like a snapshot from before migration 43",
};

/** Every authored TypeScript file once (reading them is the slow part), tests included. */
let everything: { file: string; text: string }[] | undefined;
const all = () =>
  (everything ??= [...new Glob("{src,scripts}/**/*.{ts,tsx}").scanSync(ROOT)].map((p) => p.replaceAll("\\", "/")).filter((f) => !f.endsWith(".d.ts")).map((file) => ({ file, text: readFileSync(join(ROOT, file), "utf8") })));
const sources = () => all().filter(({ file }) => !/\.test\.tsx?$/.test(file));

/** What changes which version a take shows or which messages are live, as SQL or as an assignment: every file that does it must rebuild the take's scene state. */
const CHANGES_SHOWN = new RegExp(
  [
    String.raw`UPDATE messages SET[^;"'` + "`" + String.raw`]*\b(current_swipe|cut_id|cut_at|branch_id)\b`,
    String.raw`UPDATE swipes SET cut_at`,
    String.raw`\b(setCurrentSwipe|appendSwipe)\(`,
    String.raw`\.current\s*=[^=]`,
    String.raw`\.cut\s*=[^=]`,
    String.raw`delete\s+\w+\.cut\b`,
    String.raw`\.cutAt\s*=[^=]`,
    String.raw`delete\s+\w+\.cutAt\b`,
    String.raw`\.branchId\s*=[^=]`,
  ].join("|"),
);
const REBUILDS = /\brefresh\(/;
/** Files that touch those fields without being a method that changes a take: they build a copy, seed a new take, or are the helpers their callers rebuild after. */
const NOT_A_CHANGE: Record<string, string> = {
  "src/stage/store/sqlite/swipe-sql.ts": "the helpers (setCurrentSwipe, appendSwipe); every caller rebuilds after them",
  "src/stage/store/memory/chat-records.ts": "builds a copy of a message for a new take (copyRecord); the fork and the restore that call it rebuild",
};
const changesWithoutRebuild = (files: readonly { file: string; text: string }[]): string[] =>
  files.filter(({ file, text }) => /^src\/stage\/store\/(sqlite|memory)\//.test(file) && !(file in NOT_A_CHANGE) && CHANGES_SHOWN.test(text) && !REBUILDS.test(text)).map((f) => f.file);

describe("scene state has one door", () => {
  test("every store file that changes what a take shows rebuilds its scene state, so a method added later cannot forget", () => {
    expect(changesWithoutRebuild(sources())).toEqual([]);
    // The check sees what it checks: the files that do change it are scanned, and a file that changes it without rebuilding is caught.
    expect(sources().filter(({ file, text }) => CHANGES_SHOWN.test(text) && REBUILDS.test(text)).map((f) => f.file)).toEqual(
      expect.arrayContaining(["src/stage/store/memory/chat-store-versions.ts", "src/stage/store/sqlite/chat-store-cuts.ts"]),
    );
    expect(changesWithoutRebuild([{ file: "src/stage/store/memory/chat-store-new.ts", text: "m.current = 3;" }, { file: "src/stage/store/sqlite/new.ts", text: "UPDATE messages SET cut_id = ? WHERE id = ?" }])).toHaveLength(2);
  });

  test("the files that are not a change name real files that really touch those fields", () => {
    for (const file of Object.keys(NOT_A_CHANGE)) expect(CHANGES_SHOWN.test(readFileSync(join(ROOT, file), "utf8")), file).toBe(true);
  });

  test("the scene-state tables are named only inside the SQLite chat store", () => {
    const outside = sources().filter(({ file, text }) => TABLES.test(text) && !file.startsWith(STORE) && !(file in EXEMPT)).map((s) => s.file);
    expect(outside).toEqual([]);
  });

  test("the exemption list names real files that really name the tables", () => {
    for (const file of Object.keys(EXEMPT)) expect(TABLES.test(readFileSync(join(ROOT, file), "utf8")), file).toBe(true);
  });

  test("the guard sees what it guards: the chat store's state file does name the tables", () => {
    expect(sources().filter(({ file, text }) => TABLES.test(text) && file.startsWith(STORE)).map((s) => s.file)).toContain("src/stage/store/sqlite/chat-store-state.ts");
  });

  test("no code, tests included, calls the removed variables, changeVariables or recordDeltas methods", () => {
    const calls = all().filter(({ file, text }) => file !== "src/stage/store/scene-state-guard.test.ts" && /\.(variables|changeVariables|recordDeltas)\(/.test(text)).map((x) => x.file);
    expect(calls).toEqual([]);
  });

  test("the chat store no longer reads or writes branch_variables", () => {
    const touching = sources().filter(({ file, text }) => file.startsWith(`${STORE}chat-store`) && /branch_variables/.test(text)).map((s) => s.file);
    expect(touching).toEqual([]);
  });
});
