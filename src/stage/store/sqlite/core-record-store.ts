/** rp-core's ordered journal inside the unlocked, encrypted Bunzai library. */
import type { Entry, Lease, RecordStore, SessionHeader } from "rp-core";
import type { CellCipher } from "../../crypto/cell-cipher";
import type { StageDatabase } from "./database";

const HEADER = "core_sessions.header_cell";
const TITLE = "core_sessions.title_cell";
const ENTRY = "core_entries.entry_cell";
const LEASE_MS = 30_000;

interface SessionRow { header_cell: string; title_cell: string | null; updated_at: string; lease_owner: string | null; lease_until: number | null }
interface EntryRow { seq: number; entry_cell: string }
export interface CoreSceneRecords extends RecordStore {
  link(chatId: string, sessionId: string, branchId: string): Promise<void>;
  sceneFor(chatId: string): Promise<{ sessionId: string; branchId: string } | null>;
  sceneForBranch(branchId: string): Promise<string | null>;
  sceneForMessage(messageId: string): Promise<string | null>;
}

/** A lease is checked again inside each write transaction, including renewal and release. */
export function sqliteCoreRecordStore(database: StageDatabase, cipher: CellCipher, now: () => number = Date.now): CoreSceneRecords {
  const { statement, transaction } = database;
  const readSession = (id: string): SessionRow | null =>
    statement("SELECT header_cell, title_cell, updated_at, lease_owner, lease_until FROM core_sessions WHERE id = ?").get(id) as SessionRow | null;
  const write = <T>(fn: () => T): Promise<T> => database.patiently(() => transaction(() => { cipher.ready(); return fn(); }));
  const own = (id: string, token: string): SessionRow => {
    const row = readSession(id);
    if (!row || row.lease_owner !== token || row.lease_until === null || row.lease_until <= now()) throw new Error("rp-core session lease lost");
    return row;
  };
  const lastSeq = (id: string): number =>
    (statement("SELECT COALESCE(MAX(seq), 0) AS seq FROM core_entries WHERE session_id = ?").get(id) as { seq: number }).seq;

  return {
    async link(chatId: string, sessionId: string, branchId: string): Promise<void> {
      await write(() => statement("INSERT INTO core_scene_links (chat_id, session_id, branch_id) VALUES (?, ?, ?)").run(chatId, sessionId, branchId));
    },
    async sceneFor(chatId: string): Promise<{ sessionId: string; branchId: string } | null> {
      cipher.ready();
      await database.idle();
      const row = statement("SELECT session_id, branch_id FROM core_scene_links WHERE chat_id = ?").get(chatId) as { session_id: string; branch_id: string } | null;
      return row ? { sessionId: row.session_id, branchId: row.branch_id } : null;
    },
    async sceneForBranch(branchId: string): Promise<string | null> {
      cipher.ready();
      await database.idle();
      const row = statement("SELECT l.chat_id FROM core_scene_links l JOIN branches b ON b.chat_id = l.chat_id WHERE b.id = ?").get(branchId) as { chat_id: string } | null;
      return row?.chat_id ?? null;
    },
    async sceneForMessage(messageId: string): Promise<string | null> {
      cipher.ready();
      await database.idle();
      const row = statement("SELECT l.chat_id FROM core_scene_links l JOIN branches b ON b.chat_id = l.chat_id JOIN messages m ON m.branch_id = b.id WHERE m.id = ?").get(messageId) as { chat_id: string } | null;
      return row?.chat_id ?? null;
    },
    async create(header: SessionHeader, initial: readonly Entry[] = []): Promise<void> {
      await write(() => {
        if (readSession(header.id)) throw new Error("rp-core session already exists");
        let seq = 0;
        for (const entry of initial) if (entry.seq !== ++seq) throw new Error("rp-core journal sequence gap");
        statement("INSERT INTO core_sessions (id, header_cell, title_cell, updated_at) VALUES (?, ?, ?, ?)").run(
          header.id, cipher.seal(HEADER, JSON.stringify(header)), header.title ? cipher.seal(TITLE, header.title) : null, header.created,
        );
        for (const entry of initial) statement("INSERT INTO core_entries (session_id, seq, entry_cell) VALUES (?, ?, ?)").run(header.id, entry.seq, cipher.seal(ENTRY, JSON.stringify(entry)));
      });
    },
    async acquire(session: string): Promise<Lease> {
      const token = crypto.randomUUID();
      await write(() => {
        const row = readSession(session);
        if (!row) throw new Error("rp-core session not found");
        if (row.lease_owner && row.lease_until !== null && row.lease_until > now()) throw new Error("rp-core session locked");
        statement("UPDATE core_sessions SET lease_owner = ?, lease_until = ? WHERE id = ?").run(token, now() + LEASE_MS, session);
      });
      let released = false;
      return {
        session,
        async renew(): Promise<void> {
          if (released) throw new Error("rp-core session lease released");
          await write(() => {
            own(session, token);
            statement("UPDATE core_sessions SET lease_until = ? WHERE id = ?").run(now() + LEASE_MS, session);
          });
        },
        async release(): Promise<void> {
          if (released) return;
          await write(() => {
            own(session, token);
            statement("UPDATE core_sessions SET lease_owner = NULL, lease_until = NULL WHERE id = ?").run(session);
          });
          released = true;
        },
        get owner() { return token; },
      } as Lease;
    },
    async *read(session: string): AsyncIterable<SessionHeader | Entry> {
      cipher.ready();
      await database.idle();
      const row = readSession(session);
      if (!row) throw new Error("rp-core session not found");
      const entries = statement("SELECT seq, entry_cell FROM core_entries WHERE session_id = ? ORDER BY seq").all(session) as EntryRow[];
      yield JSON.parse(cipher.open(HEADER, row.header_cell)) as SessionHeader;
      for (const entry of entries) yield JSON.parse(cipher.open(ENTRY, entry.entry_cell)) as Entry;
    },
    async append(lease: Lease, entries: readonly Entry[], _durable: boolean): Promise<void> {
      const token = (lease as Lease & { owner?: string }).owner;
      if (!token) throw new Error("foreign rp-core session lease");
      if (entries.length === 0) return;
      await write(() => {
        const row = own(lease.session, token);
        let seq = lastSeq(lease.session);
        for (const entry of entries) if (entry.seq !== ++seq) throw new Error("rp-core journal sequence gap");
        for (const entry of entries) statement("INSERT INTO core_entries (session_id, seq, entry_cell) VALUES (?, ?, ?)").run(lease.session, entry.seq, cipher.seal(ENTRY, JSON.stringify(entry)));
        const latest = entries.at(-1)!;
        const title = latest.t === "name" && !latest.leaf ? cipher.seal(TITLE, latest.title) : row.title_cell;
        const updated = "ts" in latest ? latest.ts : row.updated_at;
        statement("UPDATE core_sessions SET title_cell = ?, updated_at = ? WHERE id = ?").run(title, updated, lease.session);
      });
    },
    async list(): Promise<{ id: string; title?: string; updated: string }[]> {
      cipher.ready();
      await database.idle();
      const rows = statement("SELECT id, title_cell, updated_at FROM core_sessions ORDER BY updated_at DESC").all() as Array<{ id: string; title_cell: string | null; updated_at: string }>;
      return rows.map((row) => ({ id: row.id, ...(row.title_cell ? { title: cipher.open(TITLE, row.title_cell) } : {}), updated: row.updated_at }));
    },
  };
}
