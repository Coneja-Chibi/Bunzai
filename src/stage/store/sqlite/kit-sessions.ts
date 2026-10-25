/**
 * Kit's session store in the encrypted library (migration 5):
 * the same SessionStore Kit already uses, with each transcript a sealed row instead of a plain
 * JSON file in ~/.bunraku/sessions. Rows are keyed by a keyed hash of the session id, and each
 * sealed body carries its key, so a transcript copied onto another row fails to open there.
 * Exports still go to the folder the person chose: an export is a request for a readable file.
 */
import { parseSession, type SessionStore } from "../../../kit/sessions/store";
import { summarize } from "../../../kit/sessions/projection";
import type { Session } from "../../../kit/sessions/session-model";
import { refuseWhileLocked, type CellCipher } from "../../crypto/cell-cipher";
import { breather } from "../breather";
import type { StageDatabase } from "./database";

const SEP = "\u0000";
const WHERE = "kit_sessions.body";

export function sqliteSessionStore(database: StageDatabase, cipher: CellCipher, exports: Pick<SessionStore, "writeExport">): SessionStore {
  const { statement, patiently } = database;
  const key = (id: string): string => cipher.index(`kit-session${SEP}${id}`);
  /** A stored session, or null when it does not open to a whole, sound session (the file store's rule). */
  const decode = (k: string, cell: string): Session | null => {
    const text = cipher.open(WHERE, cell);
    if (!text.startsWith(`${k}${SEP}`)) return null;
    try {
      return parseSession(JSON.parse(text.slice(k.length + 1)));
    } catch {
      return null;
    }
  };

  const store: SessionStore = {
    async list() {
      const rows = (await patiently(() => statement("SELECT id_key, body FROM kit_sessions").all())) as { id_key: string; body: string }[];
      const breathe = breather();
      const sessions: Session[] = [];
      for (const r of rows) {
        const session = decode(r.id_key, r.body);
        if (session) sessions.push(session);
        await breathe();
      }
      return sessions.map(summarize).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async read(id) {
      const k = key(id);
      const row = (await patiently(() => statement("SELECT body FROM kit_sessions WHERE id_key = ?").get(k))) as { body: string } | null;
      return row ? decode(k, row.body) : null;
    },
    async write(session) {
      const k = key(session.id);
      const sealed = cipher.seal(WHERE, `${k}${SEP}${JSON.stringify(session)}`);
      await patiently(() =>
        statement(
          `INSERT INTO kit_sessions (id_key, body, updated_at) VALUES (?, ?, ?)
           ON CONFLICT (id_key) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`,
        ).run(k, sealed, Date.now()),
      );
    },
    async remove(id) {
      const k = key(id);
      return (await patiently(() => statement("DELETE FROM kit_sessions WHERE id_key = ?").run(k))).changes > 0;
    },
    writeExport: (exportDir, filename, body) => exports.writeExport(exportDir, filename, body),
  };
  return refuseWhileLocked(cipher, store, database.idle);
}
