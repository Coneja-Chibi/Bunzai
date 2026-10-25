/** The one-time copy of Kit's old plain transcript files into the library (split out of library-root.ts for its line cap). */
import { fileSessionStore, type SessionStore } from "../kit/sessions/store";
import type { StageDatabase } from "../stage/store/sqlite/database";

const SESSIONS_COPIED = "kit_sessions_copied";

/**
 * Copies Kit's old plain transcript files into the library once, and records that it did, so a
 * session the person later deletes is never brought back. The files are only read, like the studio
 * folder (rule 10).
 */
export async function copySessionsIn(database: StageDatabase, sessions: SessionStore, dir?: string): Promise<void> {
  const done = database.statement("SELECT value FROM library_meta WHERE key = ?").get(SESSIONS_COPIED);
  if (done) return;
  const files = fileSessionStore(dir);
  let copied = 0;
  for (const summary of await files.list()) {
    const session = await files.read(summary.id);
    if (session && !(await sessions.read(session.id))) {
      await sessions.write(session);
      copied++;
    }
  }
  database.statement("INSERT INTO library_meta (key, value) VALUES (?, ?)").run(SESSIONS_COPIED, new Date().toISOString());
  if (copied > 0) console.log(`library: copied ${copied} Kit sessions into the encrypted library; the old files are unchanged`);
}
