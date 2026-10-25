/**
 * The idle lock's one deadline timer, replacing the 30s poll it had
 * before: armed from the keyring's own `idleLockIn()`, re-armed on activity, so a session with no
 * gaps fires this exactly once, at the true deadline, instead of checking every 30s regardless of
 * activity. Split out of library-root.ts (createLibrary) to keep both files under the line cap;
 * `createLibrary` owns WHEN to call `arm()` (open, touch, an unlock reached later, a running
 * request's `hold()` release) and reads lock/unlock transitions back through `onLockChange`.
 */
import type { createKeyring } from "../stage/crypto/keyring";

type Keyring = ReturnType<typeof createKeyring>;
export type LockState = "locked" | "unlocked";

/**
 * setTimeout's own ceiling (a signed 32-bit ms count): past it, engines fire after 1ms instead of
 * throwing, which would turn a many-days idle policy into a busy-lock loop. `policyOf`
 * (server-library.ts) accepts any positive integer of idle minutes with no upper bound, so this is a
 * real value, not a defensive-only one.
 */
const MAX_TIMEOUT_MS = 2_147_483_647;

export interface IdleLock {
  /** Re-reads the keyring's current `idleLockIn()` and (re)arms the deadline timer. Safe to call at
   *  any time; a no-op while there is no keyring held or no idle policy. */
  arm(): void;
  clear(): void;
  onLockChange(cb: (state: LockState) => void): () => void;
  notify(state: LockState): void;
}

export function createIdleLock(
  getKeyring: () => Keyring | null,
  /** Requests running now: a fire never locks under one (the caller's `hold()` release re-arms). */
  getRunning: () => number,
  /** Test-only: the LONGEST single wait before a re-check (createLibrary's own option; unset in
   *  production, so the real deadline is armed directly and the timer fires exactly once). */
  idleCheckMs?: number,
): IdleLock {
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<(state: LockState) => void>();
  const notify = (s: LockState): void => { for (const cb of listeners) cb(s); };

  const clear = (): void => {
    if (idleTimer !== null) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };
  const arm = (): void => {
    clear();
    const keyring = getKeyring();
    if (!keyring) return;
    const remaining = keyring.idleLockIn();
    if (remaining === null) return; // no idle policy, or already locked: nothing to protect
    const cap = idleCheckMs !== undefined ? Math.min(idleCheckMs, MAX_TIMEOUT_MS) : MAX_TIMEOUT_MS;
    idleTimer = setTimeout(fire, Math.min(remaining, cap));
    idleTimer.unref?.();
  };
  function fire(): void {
    idleTimer = null;
    const keyring = getKeyring();
    if (!keyring || getRunning() > 0) return; // a running request's hold() release re-arms
    if (keyring.lockIfIdle()) {
      notify("locked");
      return; // nothing left to check until the next unlock re-arms
    }
    arm(); // not idle yet: a race, or a test's short idleCheckMs re-checking
  }

  return { arm, clear, notify, onLockChange: (cb) => { listeners.add(cb); return () => listeners.delete(cb); } };
}
