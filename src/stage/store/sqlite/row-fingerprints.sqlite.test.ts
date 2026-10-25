/**
 * Row fingerprints, on a real library file: each row is
 * signed in the transaction that wrote it, nothing is left unsealed after a store method, a delete
 * drops its fingerprint, a locked or empty step touches no key, and the covered columns match each
 * table's real columns so a new column forces a deliberate bump.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { character } from "../../contracts/content-store.contract-fixtures";
import { cellCipher } from "../../crypto/cell-cipher";
import { newDataKey, subkeys } from "../../crypto/crypto";
import { LockedError } from "../../crypto/keyring-errors";
import { FP_SPECS, factsSql, fingerprintOf, readFacts, specOf } from "./row-fingerprints";
import { makeLibrary, type Library } from "./health-test-support";

const libraries: Library[] = [];
afterEach(() => {
  for (const l of libraries.splice(0)) l.dispose();
});
const library = async () => {
  const l = await makeLibrary();
  libraries.push(l);
  return l;
};

const count = (l: Library, sql: string, ...params: (string | number)[]) => (l.database.statement(sql).get(...params) as { n: number }).n;

describe("row fingerprints", () => {
  test("every row of every covered table is signed, current, and the queue is empty", async () => {
    const l = await library();
    expect(count(l, "SELECT count(*) AS n FROM fp_dirty")).toBe(0);
    for (const spec of FP_SPECS) {
      const rows = l.database.statement(`SELECT ${factsSql(spec)} FROM ${spec.table}`).all() as { rk: string; pl: string; cl: string }[];
      // A library with no row of this kind (a summary the rebuild has not made, a traces table no
      // test turn wrote) has nothing to sign; the others must hold rows or this test proves nothing.
      for (const row of rows) {
        const stored = l.database.statement("SELECT v, fp FROM row_fingerprints WHERE tbl = ? AND row_key = ?").get(spec.table, row.rk) as { v: number; fp: string } | null;
        expect(stored, `${spec.table} ${row.rk}`).not.toBeNull();
        expect(stored!.v).toBe(spec.v);
        expect(stored!.fp).toBe(fingerprintOf(l.cipher, spec, row));
      }
      expect(count(l, "SELECT count(*) AS n FROM row_fingerprints WHERE tbl = ?", spec.table)).toBe(rows.length);
    }
    const covered = ["documents", "document_versions", "document_graves", "grave_versions", "piece_parts", "chats", "branches", "messages", "swipes", "swipe_history"];
    for (const table of covered) expect(count(l, `SELECT count(*) AS n FROM ${table}`), table).toBeGreaterThan(0);
  });

  test("no store method leaves a changed row unsealed", async () => {
    const l = await library();
    const dirty = () => count(l, "SELECT count(*) AS n FROM fp_dirty");
    const steps: [string, () => Promise<unknown>][] = [
      ["append", () => l.chats.appendMessage(l.branchId, { role: "user", content: "again" })],
      ["swipe", () => l.chats.addSwipe(l.messageIds[2]!, { content: "another" })],
      ["select swipe", () => l.chats.selectSwipe(l.messageIds[2]!, 0)],
      ["rename", () => l.chats.renameChat(l.chatId, "Renamed")],
      ["variables", () => l.chats.changeVariables(l.branchId, { set: { a: 1 } })],
      ["cut", () => l.chats.cutMessages(l.branchId, l.messageIds[1]!, "one")],
      ["delete chat", () => l.chats.deleteChat(l.chatId)],
      ["restore chat", () => l.chats.restoreChat(l.chatId)],
      ["piece save", () => l.content.save(character("kit2", "Kit Two"))],
      ["piece delete", () => l.content.delete("character", "kit")],
      ["piece restore", async () => l.content.restore((await l.content.graveyard())[0]!.graveId)],
      ["piece restore version", () => l.content.restoreVersion("character", "vera", 1)],
      ["purge", () => l.content.purge(Number.MAX_SAFE_INTEGER)],
    ];
    for (const [name, step] of steps) {
      await step();
      expect(dirty(), name).toBe(0);
    }
  });

  test("a delete drops the fingerprint, and a cascade drops the children's", async () => {
    const l = await library();
    await l.chats.deleteChat(l.chatId);
    await l.chats.purgeChats(Number.MAX_SAFE_INTEGER);
    for (const table of ["chats", "branches", "messages", "swipes", "swipe_history"]) {
      expect(count(l, "SELECT count(*) AS n FROM row_fingerprints WHERE tbl = ?", table), table).toBe(0);
      expect(count(l, `SELECT count(*) AS n FROM ${table}`), table).toBe(0);
    }
  });

  test("a write that fails leaves neither the row nor a fingerprint", async () => {
    const l = await library();
    const before = count(l, "SELECT count(*) AS n FROM row_fingerprints");
    l.database.db.run("CREATE TRIGGER boom BEFORE INSERT ON swipes BEGIN SELECT RAISE(ABORT, 'boom'); END");
    await expect(l.chats.appendMessage(l.branchId, { role: "user", content: "boom" })).rejects.toThrow("boom");
    expect(count(l, "SELECT count(*) AS n FROM row_fingerprints")).toBe(before);
    expect(count(l, "SELECT count(*) AS n FROM fp_dirty")).toBe(0);
  });

  test("a swapped cell changes the row's fingerprint", async () => {
    const l = await library();
    const spec = specOf("swipes")!;
    // A fork copies cells byte for byte, so two rows can hold the same cell: take two whose cells differ (message ids are random).
    const rows = l.database.statement("SELECT message_id, position, content FROM swipes ORDER BY message_id, position").all() as { message_id: string; position: number; content: string }[];
    const a = rows[0]!;
    const b = rows.find((r) => r.content !== a.content)!;
    const rk = JSON.stringify([a.message_id, a.position]);
    const stored = (l.database.statement("SELECT fp FROM row_fingerprints WHERE tbl = 'swipes' AND row_key = ?").get(rk) as { fp: string }).fp;
    l.database.statement("UPDATE swipes SET content = ? WHERE message_id = ? AND position = ?").run(b.content, a.message_id, a.position);
    // The raw update fired the trigger, but no store transaction sealed it, so the signed value is still the old one.
    expect((l.database.statement("SELECT fp FROM row_fingerprints WHERE tbl = 'swipes' AND row_key = ?").get(rk) as { fp: string }).fp).toBe(stored);
    expect(fingerprintOf(l.cipher, spec, readFacts(l.database.statement, spec, rk)!)).not.toBe(stored);
  });

  test("the seal step touches no key when there is nothing to seal, and waits when locked", async () => {
    const l = await library();
    let touched = 0;
    const keys = subkeys(newDataKey());
    const counting = cellCipher(() => {
      touched++;
      return keys;
    });
    const locked = cellCipher(() => {
      throw new LockedError();
    });
    const { attachRowFingerprints } = await import("./row-fingerprints");
    attachRowFingerprints(l.database, counting);
    l.database.transaction(() => l.database.statement("UPDATE lock_settings SET mode = mode").run());
    expect(touched).toBe(0);
    attachRowFingerprints(l.database, locked);
    // A covered row changed while locked is queued, not signed, and the transaction still commits.
    l.database.transaction(() => l.database.statement("INSERT INTO scene_folders (id, name, created_at) VALUES ('f', 'n', 1)").run());
    expect(count(l, "SELECT count(*) AS n FROM fp_dirty")).toBe(1);
    attachRowFingerprints(l.database, l.cipher);
    l.database.transaction(() => undefined);
    expect(count(l, "SELECT count(*) AS n FROM fp_dirty")).toBe(0);
    expect(count(l, "SELECT count(*) AS n FROM row_fingerprints WHERE tbl = 'scene_folders'")).toBe(1);
  });

  test("the covered columns are exactly the table's columns", async () => {
    const l = await library();
    for (const spec of FP_SPECS) {
      const actual = (l.database.statement(`PRAGMA table_info(${spec.table})`).all() as { name: string }[]).map((c) => c.name).sort();
      const covered = [...spec.key, ...spec.plain, ...spec.cells].sort();
      expect(covered, spec.table).toEqual(actual);
    }
  });
});
