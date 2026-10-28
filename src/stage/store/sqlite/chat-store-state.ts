/**
 * The SQLite ChatStore's scene state (rule 17, migration 43). `swipe_deltas` holds what each version of a reply changed, keyed by
 * swipe id: a fork copies messages but keeps swipe ids, so a take shares its prefix's deltas and no such row is ever copied or
 * changed. `message_deltas` holds what a message carries whichever version shows (a person's edit on a reply): keyed by message id, so
 * it belongs to one take, and a fork copies it with the new message id. A message's own deltas fold after its shown version's, so they win on that message.
 * `branch_state` is each take's tip cache and `state_keyframes` keeps the full state after every 50th shown message; both are
 * caches `refresh` rewrites inside the transaction of whatever changed what the branch shows, and a cache cell that will not open
 * is skipped and rewritten, never fatal (the deltas are the data: a damaged delta cell still refuses). Everything is sealed like
 * the other chat payloads. Only the SQLite chat store reads or writes these tables (scene-state-guard.test.ts).
 */
import type { Delta, SceneState } from "../../../core/scene-state/types";
import type { ChatStore } from "../../contracts/chat-store";
import type { CellCipher } from "../../crypto/cell-cipher";
import { DamagedDataError } from "../../damaged-data-error";
import { baseState, changed, checkImportedDeltas, rebuildState, sliceShown } from "../scene-state-rules";
import type { BranchSql, MessageSql } from "./chat-store-rows";
import type { StageDatabase } from "./database";

type Param = string | number | null;
type Shown = { messageId: string; swipeId: string | null };

export interface StateSqlDeps {
  database: StageDatabase;
  cipher: CellCipher;
  one<T>(sql: string, ...params: Param[]): T | null;
  run(sql: string, ...params: Param[]): number;
  writableBranch(id: string): BranchSql | null;
  writableMessage(id: string): MessageSql | null;
  write<T>(work: () => T, limitMs?: number): Promise<T>;
}

export interface StateSql {
  api: Pick<ChatStore, "sceneState" | "sceneStateBefore" | "sceneDeltas" | "recordMessageDeltas" | "setBranchBase">;
  /** Rebuilds the branch's tip cache and rewrites its keyframes; the ones at or after message seq `fromSeq` are dropped first. Inside the caller's transaction. */
  refresh(branchId: string, fromSeq?: number): void;
  /** Gives a new take its own copy of another's base and builds its state. Inside the caller's transaction. */
  copyBase(fromBranchId: string, toBranchId: string): void;
  /** Forgets a branch's cache and keyframes. */
  drop(branchId: string): void;
  /** Keeps a turn's deltas with the version it stored; they follow the ones it already has. */
  stampSwipe(swipeId: string, deltas: readonly Delta[]): void;
}

interface DeltaSql { owner: string; slot: string; path_json: string; value_json: string | null; removed: number; at: number }
interface PathSql { message_id: string; seq: number; swipe_id: string }

const isDamage = (error: unknown): boolean => error instanceof DamagedDataError || error instanceof SyntaxError;

export function stateMethods(k: StateSqlDeps): StateSql {
  const { statement } = k.database;
  const { cipher } = k;
  const json = (column: string, cell: string) => JSON.parse(cipher.open(column, cell)) as SceneState;
  const NEWEST = Number.MAX_SAFE_INTEGER;

  /** The versions a branch shows, oldest first: live messages only (before message seq `beforeSeq` when given), each with the version it points at. */
  const shownPath = (branchId: string, beforeSeq = NEWEST) =>
    statement(
      `SELECT m.id AS message_id, m.seq, s.swipe_id FROM messages m JOIN swipes s ON s.message_id = m.id AND s.position = m.current_swipe
        WHERE m.branch_id = ? AND m.cut_id IS NULL AND m.seq < ? ORDER BY m.seq`,
    ).all(branchId, beforeSeq) as PathSql[];

  /** The kept state nearest the end of the path: the latest keyframe whose message is still shown here, before `beforeSeq`, that opens. One that does not is named in `bad`. */
  const keyframeBefore = (branchId: string, beforeSeq: number, bad: string[]): Map<string, SceneState> => {
    const candidates = statement(
      `SELECT f.message_id FROM state_keyframes f JOIN messages m ON m.id = f.message_id AND m.branch_id = f.branch_id
        WHERE f.branch_id = ? AND m.cut_id IS NULL AND m.seq < ? ORDER BY m.seq DESC`,
    ).all(branchId, beforeSeq) as { message_id: string }[];
    for (const { message_id } of candidates) {
      const cell = k.one<{ state_json: string }>("SELECT state_json FROM state_keyframes WHERE branch_id = ? AND message_id = ?", branchId, message_id)!.state_json;
      try {
        return new Map([[message_id, json("state_keyframes.state_json", cell)]]);
      } catch (error) {
        if (!isDamage(error)) throw error;
        bad.push(message_id);
      }
    }
    return new Map();
  };

  /** The deltas of one table's owners, in the order written (`table` and `owner` are this file's own names, never input). */
  const load = (table: "swipe_deltas" | "message_deltas", owner: "swipe_id" | "message_id", ids: string[], prefixes?: readonly string[]): Map<string, Delta[]> => {
    const out = new Map<string, Delta[]>();
    if (ids.length === 0) return out;
    const only = prefixes === undefined ? "" : " AND EXISTS (SELECT 1 FROM json_each(?) p WHERE substr(slot, 1, length(p.value)) = p.value)";
    const rows = statement(`SELECT ${owner} AS owner, slot, path_json, value_json, removed, at FROM ${table} WHERE ${owner} IN (SELECT value FROM json_each(?))${only} ORDER BY ${owner}, seq`).all(JSON.stringify(ids), ...(prefixes === undefined ? [] : [JSON.stringify(prefixes)])) as DeltaSql[];
    for (const r of rows) {
      const path = JSON.parse(cipher.open(`${table}.path_json`, r.path_json)) as string[];
      const delta: Delta = r.removed === 1 ? { slot: r.slot, path, removed: true, at: r.at } : { slot: r.slot, path, value: JSON.parse(cipher.open(`${table}.value_json`, r.value_json!)), at: r.at };
      (out.get(r.owner) ?? out.set(r.owner, []).get(r.owner)!).push(delta);
    }
    return out;
  };

  /** Each message's deltas for a path: its shown version's, then its own (they win). */
  const deltasOf = (path: readonly Shown[], prefixes?: readonly string[]): Map<string, Delta[]> => {
    const own = load("message_deltas", "message_id", path.map((p) => p.messageId), prefixes);
    const versions = load("swipe_deltas", "swipe_id", path.flatMap((p) => (p.swipeId === null ? [] : [p.swipeId])), prefixes);
    return new Map(path.map((p) => [p.messageId, [...(p.swipeId === null ? [] : (versions.get(p.swipeId) ?? [])), ...(own.get(p.messageId) ?? [])]]));
  };

  const shown = (rows: PathSql[]): Shown[] => rows.map((p) => ({ messageId: p.message_id, swipeId: p.swipe_id }));
  /** What the take starts with: real data, so a cell that will not open refuses. */
  const baseOf = (branchId: string): SceneState | undefined => {
    const row = k.one<{ state_json: string }>("SELECT state_json FROM branch_base WHERE branch_id = ?", branchId);
    return row ? json("branch_base.state_json", row.state_json) : undefined;
  };
  const build = (branchId: string, bad: string[], path: Shown[], beforeSeq = NEWEST) => {
    const keyframes = keyframeBefore(branchId, beforeSeq, bad);
    const base = keyframes.size === 0 ? baseOf(branchId) : undefined;
    return rebuildState({ path, keyframes, ...(base ? { base } : {}), deltasOf });
  };
  /** The state a message builds from: everything shown before it, and its own message-level deltas. */
  const stateBefore = (branchId: string, m: { id: string; seq: number }): SceneState =>
    build(branchId, [], [...shown(shownPath(branchId, m.seq)), { messageId: m.id, swipeId: null }], m.seq).state;

  const refresh = (branchId: string, fromSeq = 0): void => {
    // Keep only the keyframes on messages this branch still shows, before the change.
    k.run(
      `DELETE FROM state_keyframes WHERE branch_id = ?1 AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.id = message_id AND m.branch_id = ?1 AND m.cut_id IS NULL AND m.seq < ?2)`,
      branchId, fromSeq,
    );
    const rows = shownPath(branchId);
    const bad: string[] = [];
    const { state, fresh } = build(branchId, bad, shown(rows));
    for (const id of bad) k.run("DELETE FROM state_keyframes WHERE branch_id = ? AND message_id = ?", branchId, id);
    for (const [messageId, s] of fresh) {
      k.run("INSERT OR REPLACE INTO state_keyframes (branch_id, message_id, state_json) VALUES (?, ?, ?)", branchId, messageId, cipher.seal("state_keyframes.state_json", JSON.stringify(s)));
    }
    const tip = rows.at(-1);
    k.run(
      `INSERT INTO branch_state (branch_id, state_json, tip_message_id, tip_swipe_id) VALUES (?, ?, ?, ?)
         ON CONFLICT (branch_id) DO UPDATE SET state_json = excluded.state_json, tip_message_id = excluded.tip_message_id, tip_swipe_id = excluded.tip_swipe_id`,
      branchId, cipher.seal("branch_state.state_json", JSON.stringify(state)), tip?.message_id ?? null, tip?.swipe_id ?? null,
    );
  };

  /** Adds deltas after the ones the owner has. */
  const stamp = (table: "swipe_deltas" | "message_deltas", owner: "swipe_id" | "message_id", id: string, deltas: readonly Delta[]): void => {
    let { n } = k.one<{ n: number }>(`SELECT coalesce(max(seq), 0) AS n FROM ${table} WHERE ${owner} = ?`, id)!;
    for (const d of deltas) {
      k.run(
        `INSERT INTO ${table} (${owner}, seq, slot, path_json, value_json, removed, at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        id, ++n, d.slot, cipher.seal(`${table}.path_json`, JSON.stringify(d.path)),
        d.removed ? null : cipher.seal(`${table}.value_json`, JSON.stringify(d.value)), d.removed ? 1 : 0, d.at,
      );
    }
  };

  return {
    refresh,
    stampSwipe: (swipeId, deltas) => stamp("swipe_deltas", "swipe_id", swipeId, deltas),
    copyBase: (fromBranchId, toBranchId) => {
      k.run("INSERT OR REPLACE INTO branch_base (branch_id, state_json) SELECT ?, state_json FROM branch_base WHERE branch_id = ?", toBranchId, fromBranchId);
      refresh(toBranchId);
    },
    drop: (branchId) => {
      k.run("DELETE FROM branch_state WHERE branch_id = ?", branchId);
      k.run("DELETE FROM state_keyframes WHERE branch_id = ?", branchId);
    },
    api: {
      async sceneState(branchId) {
        if (!k.writableBranch(branchId)) return null;
        const row = k.one<{ state_json: string }>("SELECT state_json FROM branch_state WHERE branch_id = ?", branchId);
        if (row) {
          try {
            return json("branch_state.state_json", row.state_json);
          } catch (error) {
            if (!isDamage(error)) throw error; // a cache: build it from the deltas instead
          }
        }
        return build(branchId, [], shown(shownPath(branchId))).state;
      },

      async sceneStateBefore(branchId, messageId) {
        const m = k.one<MessageSql>("SELECT id, branch_id, seq, cut_id FROM messages WHERE id = ?", messageId);
        if (!m || m.branch_id !== branchId || m.cut_id !== null || !k.writableBranch(branchId)) return null;
        return stateBefore(branchId, m);
      },

      async sceneDeltas(branchId, fromMessageId, toMessageId, slotPrefixes) {
        if (!k.writableBranch(branchId)) return null;
        const rows = shownPath(branchId);
        const split = sliceShown(shown(rows), fromMessageId, toMessageId);
        if (!split) return null;
        const deltas = deltasOf(split.range, slotPrefixes);
        return { before: build(branchId, [], split.before, rows[split.before.length]!.seq).state, messages: split.range.map((p) => ({ messageId: p.messageId, deltas: deltas.get(p.messageId) ?? [] })) };
      },

      async setBranchBase(branchId, raw) {
        const deltas = checkImportedDeltas(raw);
        return k.write(() => {
          if (!k.writableBranch(branchId)) return false;
          if (deltas.length === 0) k.run("DELETE FROM branch_base WHERE branch_id = ?", branchId);
          else k.run("INSERT OR REPLACE INTO branch_base (branch_id, state_json) VALUES (?, ?)", branchId, cipher.seal("branch_base.state_json", JSON.stringify(baseState(deltas))));
          refresh(branchId);
          return true;
        });
      },

      async recordMessageDeltas(branchId, messageId, raw) {
        checkImportedDeltas(raw);
        return k.write(() => {
          const m = k.writableMessage(messageId);
          if (!m || m.branch_id !== branchId) return false;
          // A write of what the message already builds on adds nothing.
          const added = changed(stateBefore(branchId, m), checkImportedDeltas(raw));
          if (added.length > 0) {
            stamp("message_deltas", "message_id", messageId, added);
            refresh(branchId, m.seq);
          }
          return true;
        });
      },
    },
  };
}
