/**
 * The health check's writes on real files (health-move.ts): a row
 * that changed since it was checked is never touched, a row set aside is copied whole by SQLite and removed in one
 * transaction, and a repair of an item a fresh check no longer reports changes nothing.
 */
import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { createHealthCheck } from "./health-check";
import { factsKey, factsOf, moveRowsSql, StaleRepair } from "./health-move";
import { makeLibrary, type Library } from "./health-test-support";
import { refOf } from "./health-closure";

const libraries: Library[] = [];
afterEach(() => {
  for (const l of libraries.splice(0)) l.dispose();
});
const library = async () => {
  const l = await makeLibrary();
  libraries.push(l);
  return l;
};
const flip = (cell: string): string => cell.slice(0, 10) + (cell[10] === "A" ? "B" : "A") + cell.slice(11);
const count = (l: Library, table: string) => (l.database.statement(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;

test("a row that changed after it was checked is not moved, and nothing is written", async () => {
  const l = await library();
  const ref = refOf("scene_folders", "none");
  l.database.statement("INSERT INTO scene_folders (id, name, created_at) VALUES (?, ?, ?)").run("none", l.cipher.seal("scene_folders.name", "Old"), 1);
  const seen = factsOf(l.database.statement, ref)!;
  const other = new Database(l.path); // another writer, after the check
  other.run("UPDATE scene_folders SET name = ? WHERE id = 'none'", [l.cipher.seal("scene_folders.name", "New")]);
  other.close(true);

  const db = new Database(l.path);
  const error = (() => { try { moveRowsSql(db, { refs: [ref], group: "g", at: 1, reason: "r", expect: { [factsKey(ref)]: seen } }); return null; } catch (e) { return e; } })();
  db.close(true);
  expect(error).toBeInstanceOf(StaleRepair);
  expect(count(l, "set_aside")).toBe(0);
  expect(count(l, "scene_folders")).toBe(1);
});

test("a row that is unchanged is copied whole into set_aside by SQLite and removed, in one transaction", async () => {
  const l = await library();
  const ref = refOf("scene_folders", "keep");
  l.database.statement("INSERT INTO scene_folders (id, name, created_at) VALUES (?, ?, ?)").run("keep", l.cipher.seal("scene_folders.name", "Mine"), 7);
  const seen = factsOf(l.database.statement, ref)!;
  const original = l.database.statement("SELECT * FROM scene_folders WHERE id = 'keep'").get();
  const db = new Database(l.path);
  expect(moveRowsSql(db, { refs: [ref], group: "g", at: 5, reason: "because", expect: { [factsKey(ref)]: seen } })).toBe(1);
  db.close(true);
  expect(count(l, "scene_folders")).toBe(0);
  const kept = l.database.statement("SELECT tbl, row_key, row_json, reason FROM set_aside").get() as { tbl: string; row_key: string; row_json: string; reason: string };
  expect(kept).toMatchObject({ tbl: "scene_folders", row_key: ref.key, reason: "because" });
  expect(JSON.parse(kept.row_json)).toEqual(original); // byte for byte, cells as stored
});

test("repairing an item a fresh check no longer reports changes nothing", async () => {
  const l = await library();
  const health = createHealthCheck({ database: l.database, cipher: l.cipher, path: l.path, content: l.content, keys: l.keys });
  const original = (l.database.statement("SELECT title FROM chats WHERE id = ?").get(l.chatId) as { title: string }).title;
  l.database.statement("UPDATE chats SET title = ? WHERE id = ?").run(flip(original), l.chatId);
  const finding = (await health.scan()).findings.find((f) => f.code === "cell-unreadable" && f.row.table === "chats")!;
  l.database.statement("UPDATE chats SET title = ? WHERE id = ?").run(original, l.chatId); // put right meanwhile, as a restore or a rewrite would
  await l.database.sealNow();

  const result = await health.repair({ kind: "set-aside", finding });
  expect(result).toEqual({ cleared: true, summary: "it checks clean now, so nothing was changed" });
  expect(count(l, "set_aside")).toBe(0);
  expect((l.database.statement("SELECT title FROM chats WHERE id = ?").get(l.chatId) as { title: string }).title).toBe(original);
});
