/**
 * The health check's repairs on real library files: each
 * damaged item is repaired through the public handle, the original row survives byte for byte in
 * `set_aside`, purges never touch it, the rest of the library reads unchanged, and a failure changes
 * nothing. Restore from a snapshot is proven against a stand-in for the backups work's store.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { character } from "../../contracts/content-store.contract-fixtures";
import { StageDatabaseError } from "./database";
import { createHealthCheck, type HealthCheck } from "./health-check";
import { makeLibrary, type Library } from "./health-test-support";
import { PLACEHOLDER_TEXT } from "./health-repair";
import type { Finding, SnapshotRestorer } from "./health-types";

const libraries: Library[] = [];
afterEach(() => {
  for (const l of libraries.splice(0)) l.dispose();
});

interface Rig {
  readonly l: Library;
  readonly health: HealthCheck;
  readonly restored: string[];
}
const rig = async (): Promise<Rig> => {
  const l = await makeLibrary();
  libraries.push(l);
  const restored: string[] = [];
  const snapshots: SnapshotRestorer = {
    list: () => [{ id: "snap-1", kind: "auto", takenAt: 1, bytes: 10 }],
    preview: async () => ({}),
    restore: async (id) => void restored.push(id),
  };
  return { l, health: createHealthCheck({ database: l.database, cipher: l.cipher, path: l.path, content: l.content, keys: l.keys, snapshots }), restored };
};
const run = (l: Library, sql: string, ...params: (string | number | null)[]) => l.database.statement(sql).run(...params);
const get = <T>(l: Library, sql: string, ...params: (string | number)[]) => l.database.statement(sql).get(...params) as T;
const count = (l: Library, table: string) => get<{ n: number }>(l, `SELECT count(*) AS n FROM ${table}`).n;
const flip = (cell: string): string => cell.slice(0, 10) + (cell[10] === "A" ? "B" : "A") + cell.slice(11);
const findOne = async (r: Rig, code: Finding["code"], table: string): Promise<Finding> => {
  const found = (await r.health.scan()).findings.filter((f) => f.code === code && f.row.table === table);
  expect(found).toHaveLength(1);
  return found[0]!;
};

describe("set aside: a damaged text cell", () => {
  test("keeps the message and its place, shows the placeholder, and keeps the original row byte for byte", async () => {
    const r = await rig();
    const original = get<{ content: string }>(r.l, "SELECT content FROM swipes WHERE message_id = ? AND position = 0", r.l.messageIds[0]!).content;
    const damaged = flip(original);
    run(r.l, "UPDATE swipes SET content = ? WHERE message_id = ? AND position = 0", damaged, r.l.messageIds[0]!);
    const finding = await findOne(r, "cell-unreadable", "swipes");
    expect(r.health.preview(finding).summary).toBe("the damaged text will be replaced and the original kept aside");

    const result = await r.health.repair({ kind: "set-aside", finding });
    expect(result.cleared).toBe(true);
    const page = await r.l.chats.readMessages(r.l.branchId, { limit: 10 });
    expect(page.messages.map((m) => m.seq)).toEqual([1, 2, 3]);
    expect(page.messages[0]!.swipes[0]!.content).toBe(PLACEHOLDER_TEXT);
    const kept = get<{ row_json: string; tbl: string }>(r.l, "SELECT row_json, tbl FROM set_aside");
    expect(kept.tbl).toBe("swipes");
    expect((JSON.parse(kept.row_json) as { content: string }).content).toBe(damaged);
    expect((await r.health.scan()).findings).toEqual([]);
  });

  test("an optional setting that will not open is cleared and the original kept", async () => {
    const r = await rig();
    await r.l.chats.setPreset(r.l.chatId, { id: "p", toggles: {}, samplers: {} });
    const cell = get<{ preset_json: string }>(r.l, "SELECT preset_json FROM chats WHERE id = ?", r.l.chatId).preset_json;
    run(r.l, "UPDATE chats SET preset_json = ? WHERE id = ?", flip(cell), r.l.chatId);
    const finding = await findOne(r, "cell-unreadable", "chats");
    expect((await r.health.repair({ kind: "set-aside", finding })).cleared).toBe(true);
    expect(get<{ preset_json: string | null }>(r.l, "SELECT preset_json FROM chats WHERE id = ?", r.l.chatId).preset_json).toBeNull();
    expect(count(r.l, "set_aside")).toBe(1);
  });
});

describe("roll back", () => {
  test("a damaged reply returns to the newest earlier text that opens", async () => {
    const r = await rig();
    const current = get<{ content: string }>(r.l, "SELECT content FROM swipes WHERE message_id = ? AND position = 0", r.l.messageIds[2]!).content;
    run(r.l, "UPDATE swipes SET content = ? WHERE message_id = ? AND position = 0", flip(current), r.l.messageIds[2]!);
    const finding = await findOne(r, "cell-unreadable", "swipes");
    const result = await r.health.repair({ kind: "roll-back", finding });
    expect(result.cleared).toBe(true);
    const page = await r.l.chats.readMessages(r.l.branchId, { limit: 10 });
    expect(page.messages[2]!.swipes[0]!.content).toBe("How was the long road?");
    expect(count(r.l, "set_aside")).toBe(1);
  });

  test("a piece with a damaged live part rolls back to its newest readable version, as a new restore version", async () => {
    const r = await rig();
    const part = get<{ id: number; cell: string; doc: string }>(
      r.l,
      "SELECT p.id, p.cell, p.doc FROM piece_parts p JOIN documents d ON d.kind = p.kind AND d.id = p.doc WHERE p.to_version IS NULL AND d.version = 3 LIMIT 1",
    );
    run(r.l, "UPDATE piece_parts SET cell = ? WHERE id = ?", flip(part.cell), part.id);
    expect(await r.l.content.read("character", "vera").catch((e: Error) => e.name)).toBe("DamagedDataError");
    const finding = await findOne(r, "cell-unreadable", "piece_parts");
    expect(finding.repairs).toContain("roll-back");

    const result = await r.health.repair({ kind: "roll-back", finding });
    expect(result.summary).toContain("rolled back");
    expect(result.cleared).toBe(true);
    const stored = await r.l.content.read("character", "vera");
    expect(JSON.stringify(stored)).toContain("Vera the Bard");
    const versions = await r.l.content.versions("character", "vera");
    expect(versions.versions.at(-1)!.reason).toBe("restore");
    expect((await r.health.scan()).findings).toEqual([]);
  });

  test("when no earlier text opens, nothing changes and it says so", async () => {
    const r = await rig();
    run(r.l, "UPDATE swipe_history SET content = 'junk' WHERE message_id = ?", r.l.messageIds[2]!);
    const current = get<{ content: string }>(r.l, "SELECT content FROM swipes WHERE message_id = ? AND position = 0", r.l.messageIds[2]!).content;
    run(r.l, "UPDATE swipes SET content = ? WHERE message_id = ? AND position = 0", flip(current), r.l.messageIds[2]!);
    const finding = (await r.health.scan()).findings.find((f) => f.row.table === "swipes")!;
    const result = await r.health.repair({ kind: "roll-back", finding });
    expect(result.cleared).toBe(false);
    expect(result.summary).toBe("nothing was changed: none of this reply's earlier texts would open either");
    expect(count(r.l, "set_aside")).toBe(0);
  });
});

describe("set aside: a whole item", () => {
  test("a chat whose cast will not open goes aside with everything it owns, and the other chat is untouched", async () => {
    const r = await rig();
    const other = await r.l.chats.createChat({ title: "Another", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: { id: "vera" } } });
    await r.l.chats.appendMessage(other.activeBranchId, { role: "user", content: "still here" });
    const cell = get<{ cast_json: string }>(r.l, "SELECT cast_json FROM chats WHERE id = ?", r.l.chatId).cast_json;
    run(r.l, "UPDATE chats SET cast_json = ? WHERE id = ?", flip(cell), r.l.chatId);
    const finding = await findOne(r, "cell-unreadable", "chats");
    const preview = r.health.preview(finding);
    expect(preview.rows.chats).toBe(1);
    expect(preview.rows.messages).toBeGreaterThanOrEqual(3);
    expect(preview.summary).toContain("will be set aside, not deleted");

    const before = { messages: count(r.l, "messages"), swipes: count(r.l, "swipes") };
    const result = await r.health.repair({ kind: "set-aside", finding });
    expect(result.cleared).toBe(true);
    expect(count(r.l, "set_aside")).toBeGreaterThan(before.messages);
    expect(get<{ n: number }>(r.l, "SELECT count(*) AS n FROM set_aside WHERE tbl = 'swipes'").n).toBeGreaterThanOrEqual(4);
    const listed = (await r.l.chats.listChats()).chats;
    expect(listed.map((c) => c.title)).toEqual(["Another"]);
    expect((await r.l.chats.readMessages(other.activeBranchId, { limit: 5 })).messages[0]!.swipes[0]!.content).toBe("still here");
    expect(count(r.l, "messages")).toBe(1);
    expect((await r.health.scan()).findings).toEqual([]);
    expect(before.swipes).toBeGreaterThan(count(r.l, "swipes"));
  });

  test("a piece whose name cannot be read goes aside, its id stays retired, and the others still read", async () => {
    const r = await rig();
    const doc = get<{ kind: string; id: string; id_cell: string }>(r.l, "SELECT kind, id, id_cell FROM documents ORDER BY id LIMIT 1");
    run(r.l, "UPDATE documents SET id_cell = ? WHERE kind = ? AND id = ?", flip(doc.id_cell), doc.kind, doc.id);
    const finding = await findOne(r, "cell-unreadable", "documents");
    expect((await r.health.repair({ kind: "set-aside", finding })).cleared).toBe(true);
    expect((await r.l.content.list("character")).length).toBe(1);
    expect(get<{ n: number }>(r.l, "SELECT count(*) AS n FROM retired_ids WHERE kind = ? AND id = ?", doc.kind, doc.id).n).toBe(1);
    expect(count(r.l, "piece_parts")).toBeGreaterThan(0);
    expect((await r.health.scan()).findings).toEqual([]);
  });

  test("a damaged image takes its pieces aside only where a live part needs it", async () => {
    const r = await rig();
    const blob = get<{ key: string; cell: string }>(r.l, "SELECT key, cell FROM blobs LIMIT 1");
    run(r.l, "UPDATE blobs SET cell = ? WHERE key = ?", flip(blob.cell), blob.key);
    const finding = await findOne(r, "cell-unreadable", "blobs");
    expect(finding.repairs).not.toContain("roll-back");
    expect((await r.health.repair({ kind: "set-aside", finding })).cleared).toBe(true);
    expect(count(r.l, "blobs")).toBe(0);
    expect(get<{ n: number }>(r.l, "SELECT count(*) AS n FROM set_aside WHERE tbl = 'blobs'").n).toBe(1);
    expect((await r.l.content.list("character")).map((c) => c.id)).toEqual(["vera"]);
    expect((await r.health.scan()).findings).toEqual([]);
  });

  test("unowned leftovers are set aside one row at a time", async () => {
    const r = await rig();
    run(r.l, "PRAGMA foreign_keys = OFF");
    run(r.l, "INSERT INTO blobs (key, cell, bytes) VALUES ('stray', 'e1:x', 1)");
    const finding = await findOne(r, "dangling", "blobs");
    expect((await r.health.repair({ kind: "set-aside", finding })).cleared).toBe(true);
    expect(count(r.l, "set_aside")).toBe(1);
  });
});

describe("set aside is not bury: no purge reaches it", () => {
  test("purging the Trash, deleted chats and old versions leaves every set-aside row", async () => {
    const r = await rig();
    const cell = get<{ cast_json: string }>(r.l, "SELECT cast_json FROM chats WHERE id = ?", r.l.chatId).cast_json;
    run(r.l, "UPDATE chats SET cast_json = ? WHERE id = ?", flip(cell), r.l.chatId);
    await r.health.repair({ kind: "set-aside", finding: await findOne(r, "cell-unreadable", "chats") });
    const kept = count(r.l, "set_aside");
    expect(kept).toBeGreaterThan(0);
    await r.l.content.delete("character", "vera");
    await r.l.content.purge(Number.MAX_SAFE_INTEGER);
    await r.l.chats.purgeChats(Number.MAX_SAFE_INTEGER);
    await r.l.database.rebuild();
    expect(count(r.l, "set_aside")).toBe(kept);
  });
});

describe("re-sign", () => {
  test("accepts a changed row whose cells all open, and refuses one that still has damage", async () => {
    const r = await rig();
    run(r.l, "UPDATE messages SET role = 'system' WHERE id = ?", r.l.messageIds[0]!);
    const finding = await findOne(r, "row-changed", "messages");
    expect((await r.health.repair({ kind: "re-sign", finding })).cleared).toBe(true);
    expect((await r.health.scan()).findings).toEqual([]);

    const cell = get<{ content: string }>(r.l, "SELECT content FROM swipes WHERE message_id = ? AND position = 0", r.l.messageIds[0]!).content;
    run(r.l, "UPDATE swipes SET content = ? WHERE message_id = ? AND position = 0", flip(cell), r.l.messageIds[0]!);
    const bad = (await r.health.scan()).findings[0]!;
    const refused = await r.health.repair({ kind: "re-sign", finding: { ...bad, code: "row-changed" } });
    expect(refused.cleared).toBe(false);
    expect(refused.summary).toBe("nothing was changed: the row still has text that will not open");
  });

  test("a missing row's stale fingerprint is dropped when the person accepts the loss", async () => {
    const r = await rig();
    run(r.l, "DROP TRIGGER fp_swipe_history_d");
    run(r.l, "DELETE FROM swipe_history WHERE message_id = ? AND n = 1", r.l.messageIds[2]!);
    const finding = await findOne(r, "row-missing", "swipe_history");
    expect((await r.health.repair({ kind: "re-sign", finding })).cleared).toBe(true);
  });
});

describe("restore from a snapshot", () => {
  test("delegates to the backups work only for a snapshot it lists", async () => {
    const r = await rig();
    run(r.l, "UPDATE messages SET role = 'system' WHERE id = ?", r.l.messageIds[0]!);
    const finding = await findOne(r, "row-changed", "messages");
    expect(await r.health.repair({ kind: "restore-snapshot", finding, snapshotId: "nope" })).toEqual({ cleared: false, summary: "that snapshot is no longer there" });
    expect(r.restored).toEqual([]);
    // The stand-in restores nothing, so the re-check still finds the damage and the repair says so (rule 13).
    const done = await r.health.repair({ kind: "restore-snapshot", finding, snapshotId: "snap-1" });
    expect(done.cleared).toBe(false);
    expect(done.summary).toContain("but it is still reported");
    expect(r.restored).toEqual(["snap-1"]);
  });

  test("a refusal from the snapshot store is a plain result that changed nothing", async () => {
    const l = await makeLibrary();
    libraries.push(l);
    const refusing: SnapshotRestorer = {
      list: () => [{ id: "snap-1", kind: "auto", takenAt: 1, bytes: 10 }],
      preview: async () => ({}),
      restore: async () => { throw new StageDatabaseError("not enough free disk space; nothing was changed"); },
    };
    const health = createHealthCheck({ database: l.database, cipher: l.cipher, path: l.path, content: l.content, keys: l.keys, snapshots: refusing });
    run(l, "UPDATE messages SET role = 'system' WHERE id = ?", l.messageIds[0]!);
    const finding = (await health.scan()).findings[0]!;
    expect(await health.repair({ kind: "restore-snapshot", finding, snapshotId: "snap-1" })).toEqual({ cleared: false, summary: "nothing was restored: not enough free disk space; nothing was changed" });
  });

  test("without a snapshot store it says so", async () => {
    const l = await makeLibrary();
    libraries.push(l);
    const health = createHealthCheck({ database: l.database, cipher: l.cipher, path: l.path, content: l.content, keys: l.keys });
    run(l, "UPDATE messages SET role = 'system' WHERE id = ?", l.messageIds[0]!);
    const finding = (await health.scan()).findings[0]!;
    expect((await health.repair({ kind: "restore-snapshot", finding, snapshotId: "x" })).summary).toBe("no snapshot store is available to restore from");
  });
});

describe("atomic and safe", () => {
  test("a failure partway through a set-aside moves nothing", async () => {
    const r = await rig();
    const cell = get<{ cast_json: string }>(r.l, "SELECT cast_json FROM chats WHERE id = ?", r.l.chatId).cast_json;
    run(r.l, "UPDATE chats SET cast_json = ? WHERE id = ?", flip(cell), r.l.chatId);
    const finding = await findOne(r, "cell-unreadable", "chats");
    const before = { chats: count(r.l, "chats"), messages: count(r.l, "messages"), swipes: count(r.l, "swipes") };
    run(r.l, "CREATE TRIGGER boom BEFORE DELETE ON chats BEGIN SELECT RAISE(ABORT, 'boom'); END");
    await expect(r.health.repair({ kind: "set-aside", finding })).rejects.toThrow("boom");
    expect({ chats: count(r.l, "chats"), messages: count(r.l, "messages"), swipes: count(r.l, "swipes") }).toEqual(before);
    expect(count(r.l, "set_aside")).toBe(0);
  });

  test("a repair of a row that is already gone changes nothing and does not throw", async () => {
    const r = await rig();
    run(r.l, "PRAGMA foreign_keys = OFF");
    run(r.l, "INSERT INTO blobs (key, cell, bytes) VALUES ('stray', 'e1:x', 1)");
    const finding = await findOne(r, "dangling", "blobs");
    run(r.l, "DELETE FROM blobs WHERE key = 'stray'");
    const result = await r.health.repair({ kind: "set-aside", finding });
    expect(result.cleared).toBe(true);
    expect(count(r.l, "set_aside")).toBe(0);
  });
});

describe("adoption and ordinary use", () => {
  test("adopting signs clean unsigned rows, and the next scan has nothing left to adopt", async () => {
    const r = await rig();
    run(r.l, "DELETE FROM row_fingerprints");
    const report = await r.health.scan();
    expect(report.adoptable.length).toBeGreaterThan(20);
    expect(await r.health.adoptFingerprints(report)).toBe(report.adoptable.length);
    const again = await r.health.scan();
    expect(again.adoptable).toEqual([]);
    expect(again.findings).toEqual([]);
  });

  test("adoption never signs a row that is damaged", async () => {
    const r = await rig();
    run(r.l, "DELETE FROM row_fingerprints");
    const report = await r.health.scan();
    const cell = get<{ content: string }>(r.l, "SELECT content FROM swipes WHERE message_id = ? AND position = 0", r.l.messageIds[0]!).content;
    run(r.l, "UPDATE swipes SET content = ? WHERE message_id = ? AND position = 0", flip(cell), r.l.messageIds[0]!);
    run(r.l, "DELETE FROM fp_dirty");
    await r.health.adoptFingerprints(report);
    expect(count(r.l, "row_fingerprints") + 1).toBeGreaterThanOrEqual(report.adoptable.length);
    expect(get<{ n: number }>(r.l, "SELECT count(*) AS n FROM row_fingerprints WHERE tbl = 'swipes' AND row_key = ?", JSON.stringify([r.l.messageIds[0]!, 0])).n).toBe(0);
  });

  test("a library used normally stays clean through saves, restores, deletes, purges and rebuilds", async () => {
    const r = await rig();
    await r.l.content.save(character("vera", "Vera Again"), { overwrite: true });
    await r.l.content.restoreVersion("character", "vera", 1);
    await r.l.content.delete("character", "kit");
    await r.l.content.restore((await r.l.content.graveyard()).find((g) => g.id === "kit")!.graveId);
    await r.l.content.purge(Number.MAX_SAFE_INTEGER);
    await r.l.chats.cutMessages(r.l.branchId, r.l.messageIds[1]!, "from");
    await r.l.chats.deleteChat(r.l.chatId);
    await r.l.chats.restoreChat(r.l.chatId);
    await r.l.database.rebuild();
    const report = await r.health.scan();
    expect(report.findings).toEqual([]);
    expect(report.complete).toBe(true);
  });
});
