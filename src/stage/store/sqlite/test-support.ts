/**
 * Shared SQLite test harness: a fresh cell cipher and a fresh in-memory StageDatabase, hand-copied
 * into 9 `.sqlite.test.ts`/`.regressions.test.ts` files before this fold. Pure test infra, no
 * production-behavior risk - each caller still owns its own `open` array and `afterEach`, since a
 * few callers close more than just the database there (the shared gate, a temp dir).
 */
import { cellCipher } from "../../crypto/cell-cipher";
import { newDataKey, subkeys } from "../../crypto/crypto";
import { openStageDatabase, type StageDatabase } from "./database";
import { MIGRATIONS } from "./migrations";

/** A cipher under a fresh key, as an unlocked keyring would give. */
export const testCipher = () => {
  const keys = subkeys(newDataKey());
  return cellCipher(() => keys);
};

/** A fresh in-memory StageDatabase, tracked in `open` so the caller's own afterEach can close it. */
export function freshDatabase(open: StageDatabase[]): StageDatabase {
  const d = openStageDatabase(":memory:", MIGRATIONS);
  open.push(d);
  return d;
}
