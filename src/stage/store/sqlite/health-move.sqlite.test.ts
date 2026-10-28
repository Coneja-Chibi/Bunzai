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
import { closureOf, refOf } from "./health-closure";

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

test("rows set aside drop the scene-state caches, and a read still answers from what is left", async () => {
  const l = await library();
  const messages = (await l.chats.readMessages(l.branchId, { limit: 10 })).messages;
  const [early, late] = [messages[1]!, messages[2]!];
  await l.chats.recordMessageDeltas(l.branchId, early.id, [{ slot: "vars", path: ["early"], value: 1, at: 1 }]);
  await l.chats.recordMessageDeltas(l.branchId, late.id, [{ slot: "vars", path: ["late"], value: 2, at: 1 }]);
  expect(count(l, "branch_state")).toBeGreaterThan(0);
  const ref = refOf("message_deltas", early.id, 1);
  const db = new Database(l.path);
  expect(moveRowsSql(db, { refs: [ref], group: "g", at: 1, reason: "r", expect: {} })).toBe(1);
  db.close(true);
  expect([count(l, "branch_state"), count(l, "state_keyframes")]).toEqual([0, 0]);
  expect(Object.keys(((await l.chats.sceneState(l.branchId)) as { vars: object }).vars)).toEqual(["late"]);
});

test("setting a take aside takes its starting state with it, and a message set aside leaves it", async () => {
  const l = await library();
  await l.chats.setBranchBase(l.branchId, [{ slot: "vars", path: ["start"], value: 1, at: 1 }]);
  const statement = (sql: string) => l.database.statement(sql);
  expect(closureOf(statement, l.cipher, refOf("messages", l.messageIds[1]!)).some((r) => r.table === "branch_base")).toBe(false);
  const closure = closureOf(statement, l.cipher, refOf("branches", l.branchId));
  expect(closure.filter((r) => r.table === "branch_base")).toEqual([refOf("branch_base", l.branchId)]);
  const db = new Database(l.path);
  moveRowsSql(db, { refs: closure, group: "g", at: 1, reason: "r", expect: {} });
  db.close(true);
  expect((l.database.statement("SELECT count(*) AS n FROM branch_base WHERE branch_id = ?").get(l.branchId) as { n: number }).n).toBe(0);
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

test("setting aside a fork's copy of a reply leaves the source take's state: a delta row goes only with the last reply that holds it", async () => {
  const l = await library();
  const turn = await l.chats.beginTurn(l.branchId, { kind: "reply" });
  await l.chats.saveCheckpoint(turn!.id, { content: "r", deltas: [{ slot: "vars", path: ["kept"], value: 1, at: 1 }] });
  const reply = (await l.chats.commitTurn(turn!.id, { content: "reply" }))!;
  const take = await l.chats.fork(l.branchId, reply.id);
  const copy = (await l.chats.readMessages(take!.id, { limit: 100 })).messages.at(-1)!;
  const statement = (sql: string) => l.database.statement(sql);
  const closure = closureOf(statement, l.cipher, refOf("messages", copy.id));
  expect(closure.filter((r) => r.table === "swipe_deltas")).toEqual([]);
  const expect_: Record<string, string> = {};
  for (const r of closure) { const f = factsOf(statement, r); if (f) expect_[factsKey(r)] = f; }
  const db = new Database(l.path);
  moveRowsSql(db, { refs: closure, group: "g", at: 1, reason: "r", expect: expect_ });
  db.close(true);
  expect(Object.keys(((await l.chats.sceneState(l.branchId)) as { vars: object }).vars)).toEqual(["kept"]);
  // The whole chat set aside takes the shared rows with it: every reply that holds them goes too.
  const all = closureOf(statement, l.cipher, refOf("chats", l.chatId));
  expect(all.filter((r) => r.table === "swipe_deltas")).toHaveLength(1);
});
