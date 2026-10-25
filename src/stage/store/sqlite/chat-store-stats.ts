/**
 * The SQLite ChatStore's persona counters (migration 26). Every
 * mutator runs inside the transaction of the write it counts, so a rolled-back write counts nothing. A
 * scene still waiting for the backfill (`stats_state` 0) is left alone by the live mutators and counted
 * whole, once, by the backfill, so no message or scene is ever counted twice. A scene whose rows will not
 * parse is set aside (state 2) so it can never block the rest, and still goes to the Trash and comes back.
 *
 * The backfill reads a scene in slices of at most SLICE user messages and hands control back between
 * slices, then applies the totals in one small write that first checks the scene did not change while it
 * was being read (a changed scene is read again). It counts every take once: a fork copies messages with
 * their swipe ids, so the first swipe's id names a message across its copies.
 */
import type { ChatStore, Message } from "../../contracts/chat-store";
import { dayOf, emptyStats, parseStatsRow, readStats, withDays, type StatsRow } from "../persona-stats-rules";
import type { ChatSqlKit } from "./chat-store-cuts";
import { StageDatabaseError } from "./database";

const COLUMN = "persona_stats.cell";
/** The most user messages one slice reads (and decrypts a stamp for) before the main thread is handed back. */
export const SLICE = 200;
const LIVE = 1;
const SKIPPED = 2;

export interface SqlStatsCounters {
  scenes(chatId: string, personaId: string | undefined, delta: 1 | -1): void;
  /** A scene going to the Trash or coming back: its persona is read from its own row, and a damaged one changes nothing. */
  sceneOf(chatId: string, delta: 1 | -1): void;
  messages(chatId: string, personaId: string | undefined, count: number, days?: number[]): void;
  api: Pick<ChatStore, "personaStats" | "backfillPersonaStats">;
}

/** A busy or locked library, or a failing disk: the scene is fine, so it stays waiting for the next run instead of being set aside. */
const isTransient = (error: unknown): boolean =>
  error instanceof StageDatabaseError || /^(SQLITE_(BUSY|LOCKED|IOERR|FULL|NOMEM|INTERRUPT|CANTOPEN)|E(BUSY|IO|AGAIN|NOSPC|MFILE))/.test(String((error as { code?: unknown } | null)?.code ?? ""));

interface SliceRow { r: number; created_at: number; persona_json: string | null; swipe_id: string }

export function statsCounters(k: ChatSqlKit): SqlStatsCounters {
  const keyOf = (personaId: string) => k.cipher.index(personaId);
  const load = (personaId: string): StatsRow | undefined => {
    const r = k.one<{ cell: string }>("SELECT cell FROM persona_stats WHERE key = ?", keyOf(personaId));
    return r ? parseStatsRow(k.cipher.open(COLUMN, r.cell)) : undefined;
  };
  const store = (personaId: string, row: StatsRow) =>
    k.run(
      "INSERT INTO persona_stats (key, cell) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET cell = excluded.cell",
      keyOf(personaId), k.cipher.seal(COLUMN, JSON.stringify(row)),
    );
  const stateOf = (chatId: string): number | undefined => k.one<{ s: number }>("SELECT stats_state AS s FROM chats WHERE id = ?", chatId)?.s;
  const live = (chatId: string) => stateOf(chatId) === LIVE;
  const change = (personaId: string, edit: (row: StatsRow) => void) => {
    const row = load(personaId) ?? emptyStats();
    edit(row);
    store(personaId, row);
  };
  const personaOf = (chatId: string): string | undefined => {
    const row = k.chatRow(chatId);
    if (!row) return undefined;
    try {
      return k.toChat(row).cast.persona?.id;
    } catch {
      return undefined; // a damaged cast changes no counter, and never blocks the Trash
    }
  };
  /** What changes in a scene between the first read and the totals landing: its message rows and its takes. */
  const fingerprint = (chatId: string): string => {
    const m = k.one<{ n: number; top: number }>(
      "SELECT count(*) AS n, coalesce(max(m.rowid), 0) AS top FROM messages m JOIN branches b ON b.id = m.branch_id WHERE b.chat_id = ?", chatId,
    )!;
    const b = k.one<{ n: number }>("SELECT count(*) AS n FROM branches WHERE chat_id = ?", chatId)!;
    return `${m.n}:${m.top}:${b.n}`;
  };

  /** One scene's whole count: slices read (and yield between), then one small write. False when the scene changed under the read. */
  async function countScene(chatId: string, pause?: () => Promise<void>): Promise<boolean> {
    const before = k.database.transaction(() => {
      const row = k.chatRow(chatId);
      if (!row || stateOf(chatId) !== 0) return null;
      return { current: k.toChat(row).cast.persona?.id, deleted: row.deleted_at !== null, print: fingerprint(chatId) };
    });
    if (!before) return true;
    const seen = new Set<string>();
    const byPersona = new Map<string, number[]>();
    let after = 0;
    for (;;) {
      const slice = k.database.statement(
        `SELECT m.rowid AS r, m.created_at, m.persona_json, s.swipe_id
           FROM messages m JOIN branches b ON b.id = m.branch_id JOIN swipes s ON s.message_id = m.id AND s.position = 0
          WHERE b.chat_id = ? AND m.role = 'user' AND m.rowid > ? ORDER BY m.rowid LIMIT ?`,
      ).all(chatId, after, SLICE) as SliceRow[];
      for (const m of slice) {
        after = m.r;
        if (seen.has(m.swipe_id)) continue;
        seen.add(m.swipe_id);
        const stamp = m.persona_json === null ? undefined : (JSON.parse(k.cipher.open("messages.persona_json", m.persona_json)) as Message["persona"]);
        const who = stamp === undefined ? before.current : stamp?.id;
        if (who) byPersona.set(who, [...(byPersona.get(who) ?? []), m.created_at]);
      }
      if (slice.length < SLICE) break;
      await pause?.();
    }
    return k.write(() => {
      if (fingerprint(chatId) !== before.print || stateOf(chatId) !== 0) return false;
      if (before.current && !before.deleted) change(before.current, (row) => { row.scenes += 1; });
      for (const [who, times] of byPersona) {
        change(who, (row) => {
          row.messages += times.length;
          row.days = withDays(row.days, times.map(dayOf));
        });
      }
      k.run("UPDATE chats SET stats_state = ? WHERE id = ?", LIVE, chatId);
      return true;
    });
  }

  return {
    scenes(chatId, personaId, delta) {
      if (personaId && live(chatId)) change(personaId, (row) => { row.scenes += delta; });
    },
    sceneOf(chatId, delta) {
      const personaId = live(chatId) ? personaOf(chatId) : undefined;
      if (personaId) change(personaId, (row) => { row.scenes += delta; });
    },
    messages(chatId, personaId, count, days) {
      if (!personaId || count === 0 || !live(chatId)) return;
      change(personaId, (row) => {
        row.messages += count;
        row.days = withDays(row.days, days ?? [dayOf(k.clock())]);
      });
    },
    api: {
      async personaStats(personaId) {
        return readStats(load(personaId), dayOf(k.clock()));
      },
      async backfillPersonaStats(pause) {
        let counted = 0;
        const tried: string[] = [];
        for (;;) {
          const next = k.one<{ id: string }>(
            "SELECT id FROM chats WHERE stats_state = 0 AND id NOT IN (SELECT value FROM json_each(?)) ORDER BY rowid LIMIT 1", JSON.stringify(tried),
          );
          if (!next) return counted;
          tried.push(next.id);
          try {
            if (await countScene(next.id, pause)) counted += 1;
          } catch (error) {
            // A transient failure leaves the scene at 0 for the next run. One that will not parse or open is set aside, and the rest are still counted.
            if (isTransient(error)) continue;
            await k.write(() => k.run("UPDATE chats SET stats_state = ? WHERE id = ? AND stats_state = 0", SKIPPED, next.id));
          }
          await pause?.();
        }
      },
    },
  };
}
