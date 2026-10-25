/**
 * The SQLite StateStore: the Studio's own documents in `studio_state` (migration 7), one row per key,
 * the text a sealed cell. Keys are a closed list of fixed names, so they
 * say nothing about anybody's content and stay readable. Refuses every call while locked.
 */
import { refuseWhileLocked, type CellCipher } from "../../crypto/cell-cipher";
import { checkStateKey, type StateStore } from "../../contracts/state-store";
import type { StageDatabase } from "./database";

export function sqliteStateStore(database: StageDatabase, cipher: CellCipher): StateStore {
  const { statement } = database;
  return refuseWhileLocked(
    cipher,
    {
      async read(key) {
        const row = statement("SELECT body FROM studio_state WHERE key = ?").get(checkStateKey(key)) as { body: string } | null;
        return row ? cipher.open("studio_state.body", row.body) : null;
      },
      async write(key, text) {
        if (typeof text !== "string") throw new Error("state text must be a string");
        statement(
          `INSERT INTO studio_state (key, body, updated_at) VALUES (?, ?, ?)
           ON CONFLICT (key) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`,
        ).run(checkStateKey(key), cipher.seal("studio_state.body", text), Date.now());
      },
    } satisfies StateStore,
    database.idle,
  );
}
