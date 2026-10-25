/**
 * Settings, Security's calls to the library's host-only routes (src/ui/server-library.ts). A
 * password or recovery words go straight into a request body and nowhere else: never a log, never
 * the error text shown on screen (the server's refusals are fixed sentences).
 */
import { apiFetchJson } from "../../../_shared/api-fetch";

export type LockPolicy = { mode: "each-open" } | { mode: "idle"; idleMinutes: number };

export interface LibraryStatus {
  phase: "opening" | "loading-in" | "failed" | "locked" | "unlocked";
  hasPassword?: boolean;
  hasWords?: boolean;
  cleanupPending?: string | null;
  lockPolicy?: LockPolicy | null;
  wordsWrittenAt?: number | null;
  wordsRehearsedAt?: number | null;
  deviceLock?: { lock: string; weak: boolean; strongerAvailable: boolean } | null;
}

export interface RememberedComputer {
  id: string;
  label: string;
  createdAt: number;
  thisComputer: boolean;
  lock: string;
}

const post = <T = { ok: true }>(path: string, body: unknown = {}): Promise<T> =>
  apiFetchJson<T>(`/api/library/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

export const securityApi = {
  // ?detail=1 also asks for deviceLock, the one field that costs a vault round trip on a real
  // change (server-library.ts). The gate's own poll (library-gate.tsx)
  // never passes it.
  status: () => apiFetchJson<LibraryStatus>("/api/library/status?detail=1", { requireToken: false }),
  computers: () => apiFetchJson<RememberedComputer[]>("/api/library/computers", { requireToken: false }),
  beginWords: () => post<{ words: string[] }>("words/begin"),
  confirmWords: (words: readonly string[]) => post("words/confirm", { words: words.join(" ") }),
  rehearse: (words: readonly string[]) => post("words/rehearse", { words: words.join(" ") }),
  proveWithPassword: (password: string) => post("prove", { password }),
  proveWithWords: (words: readonly string[]) => post("prove", { words: words.join(" ") }),
  setPassword: (password: string, lockPolicy: LockPolicy) => post("password", { password, lockPolicy }),
  removePassword: () => post("password/remove"),
  forgetComputer: (id: string) => post("computers/forget", { id }),
  retryCleanup: () => post<{ ok: true; cleanup: "done" | "pending"; reason?: string }>("cleanup/retry"),
  upgradeDeviceLock: () => post("device-lock/upgrade"),
  lock: () => post("lock"),
};

/** The lock names the device vault records, in the words the screen uses. */
export function lockName(lock: string): string {
  switch (lock) {
    case "dpapi":
      return "Windows protection";
    case "macos-keychain":
      return "macOS Keychain";
    case "linux-secret":
      return "Linux keyring";
    case "identity-file":
      return "A key file";
    default:
      return lock;
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "23 Sep 2026", for the tiles. Spelled here: the browser's own short months say "Sept". */
export const shortDate = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

/** "23 September 2026". */
export const longDate = (ms: number): string =>
  new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** The occasional rehearsal comes due three months after the last run-through (or the writing). */
export const REHEARSAL_DUE_MS = 91 * 24 * 60 * 60 * 1000;
