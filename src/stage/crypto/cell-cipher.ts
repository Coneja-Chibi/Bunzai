/**
 * What an encrypting store needs from the keyring: seal and open one cell, and hash a value the
 * database searches by. It asks for the keys on every call,
 * so a store stops working the moment the keyring locks: LockedError, never plaintext. There is no
 * plaintext cipher; a store cannot be built without encryption.
 */
import { indexHash, openCell, sealCell, type subkeys } from "./crypto";

export interface CellCipher {
  /** Encrypts `text` for the column named by `where` ("table.column"). */
  seal(where: string, text: string): string;
  /** Decrypts a cell written for the same column. Throws on any mismatch. */
  open(where: string, cell: string): string;
  /** A searchable stand-in for `value`: equal values match, and none can be read. */
  index(value: string): string;
  /** Throws LockedError while locked, before anything is read or written. */
  ready(): void;
}

export function cellCipher(keys: () => ReturnType<typeof subkeys>): CellCipher {
  return {
    seal: (where, text) => sealCell(keys().content, where, text),
    open: (where, cell) => openCell(keys().content, where, cell),
    index: (value) => indexHash(keys().index, value),
    ready: () => void keys(),
  };
}

/**
 * Wraps every method of a store so it checks the lock first (spec rule 13). One wrapper for every
 * store, so a method added later cannot forget: locked means refused, even for methods that would
 * need no key, like delete or purge. `idle` is the database's background lane: each method waits
 * for it first, so no call ever blocks the main thread on a lock a background job holds.
 */
export function refuseWhileLocked<T extends object>(cipher: CellCipher, store: T, idle: () => Promise<void> = async () => {}): T {
  const guarded = {} as Record<string, unknown>;
  for (const [name, value] of Object.entries(store)) {
    guarded[name] =
      typeof value === "function"
        ? async (...args: unknown[]) => {
            cipher.ready();
            await idle();
            cipher.ready();
            return (value as (...a: unknown[]) => unknown).apply(store, args);
          }
        : value;
  }
  return guarded as T;
}
