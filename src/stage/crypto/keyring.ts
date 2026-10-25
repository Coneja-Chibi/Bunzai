/**
 * The keyring: the one data key, stored only in
 * wrapped form in the database, and every way to unlock, lock, and recover it. Unwrapped, the key
 * lives in this object's memory and nowhere else, and is zeroed when dropped.
 * Rules that hold everywhere. Nobody ends up with zero ways in. While a password is set, changing a
 * secret needs a fresh proof; without one, this computer's own copy is proof enough. Key changes run
 * one at a time, and each re-checks its rules inside the transaction that writes it, so two changes
 * racing (in this app or another) can never leave a computer's copy beside a password. Every change
 * marks a cleanup owed in its own transaction and reports whether the cleanup finished; an owed
 * cleanup is retried in the background, never silently dropped, and never freezes the app.
 */
import { toErrorMessage } from "../../error-message";
import { lockAll, setGate } from "../caches";
import type { StageDatabase } from "../store/sqlite/database";
import {
  makeWords,
  newDataKey,
  normalizeWords,
  openCell,
  openWithWords,
  sealCell,
  subkeys,
  WrongSecretError,
  wrapWithWords,
  argonPasswords,
  type PasswordLock,
  type PasswordWrap,
  type Wrapped,
} from "./crypto";
import { KeyChangedError, KeyringRuleError, LockedError, ProofRequiredError } from "./keyring-errors";
import { checkPolicy, keyringRows, type LockPolicy } from "./keyring-rows";
import { createKeyringLifecycle } from "./keyring-lifecycle";

export type { LockPolicy } from "./keyring-rows";

/** A key store the operating system guards for this computer and user (device-vault.ts), or a test stand-in. */
export interface DeviceVault {
  seal(text: string): Promise<string>;
  open(sealed: string): Promise<string>;
  /**
   * A stable id for this computer and user, so each remembered computer has its own copy. Never
   * changes because the vault failed for a moment: that would strand this computer's copy.
   */
  computerId(): Promise<string>;
  /**
   * The id to write a new copy under: the same id, unless its check does not open here (a folder
   * copied from another computer), when it is a fresh one, so the other computer's copy is never
   * overwritten.
   */
  computerIdForNewCopy(): Promise<string>;
  /** A name for this computer, shown in the remembered-computers list. */
  computerLabel(): Promise<string>;
  /** Which lock sealed this copy, and whether it is the weak key-file fallback. */
  lockOf(sealed: string): { lock: string; weak: boolean };
  /** True when sealing now would use a stronger lock than the one on `sealed`. */
  strongerThan(sealed: string): Promise<boolean>;
}

export { KeyChangedError, KeyringRuleError, LockedError, ProofRequiredError };

/** What a key change left behind: never "done" unless the old copies are gone from the file. */
export type KeyChange = { cleanup: "done" } | { cleanup: "pending"; reason: string };

export interface KeyringStatus {
  state: "new" | "locked" | "unlocked";
  hasPassword: boolean;
  hasWords: boolean;
  /** Why the last key change's cleanup is still owed, or null. Shown until it succeeds. */
  cleanupPending: string | null;
  /** When a password is asked for; null without a password. */
  lockPolicy: LockPolicy | null;
  /** When the recovery words in force were written, and last proved in a rehearsal (epoch ms). */
  wordsWrittenAt: number | null;
  wordsRehearsedAt: number | null;
}

export interface RememberedComputer {
  id: string;
  label: string;
  /** Epoch ms. */
  createdAt: number;
  thisComputer: boolean;
  /** Which lock holds this computer's copy (its vault's name for it). */
  lock: string;
}

/** How long a proof counts, like RoleCall's step-up window. */
const PROOF_MS = 5 * 60_000;
/** The first wait before retrying an owed cleanup in the background; it doubles, up to an hour. */
const FIRST_RETRY_MS = 60_000;
const MAX_RETRY_MS = 60 * 60_000;
/** Recorded in the change's own transaction, replaced by the real reason if the cleanup fails. */
const NOT_YET_RUN = "the cleanup after the last key change has not finished yet";

/**
 * `timer` measures the proof window, the idle lock, and retry backoff. It must be monotonic (the
 * default is performance.now()): a wall clock can be set back to keep a proof alive forever.
 * `passwords` is the Argon2id lock; only tests pass another (fake-password-lock.ts).
 */
export function createKeyring(
  database: StageDatabase,
  vault: DeviceVault,
  opts: { timer?: () => number; passwords?: PasswordLock } = {},
) {
  const { transaction } = database;
  const rows = keyringRows(database);
  /** The words' written date, and the later of that and the last rehearsal. */
  const wordsDates = (): { wordsWrittenAt: number | null; wordsRehearsedAt: number | null } => {
    const written = rows.wordsWrittenAt();
    if (written === null) return { wordsWrittenAt: null, wordsRehearsedAt: null };
    return { wordsWrittenAt: written, wordsRehearsedAt: Math.max(written, rows.rehearsedAt() ?? 0) };
  };
  const timer = opts.timer ?? (() => performance.now());
  const passwords = opts.passwords ?? argonPasswords;
  let dataKey: Buffer | null = null;
  let keys: ReturnType<typeof subkeys> | null = null;
  let pendingWords: string | null = null;
  let lastActivity = 0;
  let provedAt: number | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  let retrying: Promise<unknown> | null = null;
  let nextRetryAt = 0;
  let retryGap = FIRST_RETRY_MS;
  const lifecycle = createKeyringLifecycle(() => keys);

  setGate(() => dataKey !== null); // the one gate source (src/stage/caches.ts): open only while this keyring holds a key.

  /** Key changes run one at a time within this keyring; the transactions guard across apps. */
  const exclusive = <T>(work: () => Promise<T>): Promise<T> => {
    const run = queue.then(work, work);
    queue = run.catch(() => undefined);
    return run;
  };

  const zero = () => {
    dataKey?.fill(0);
    keys?.content.fill(0);
    keys?.index.fill(0);
    dataKey = null;
    keys = null;
    lifecycle.drop();
    pendingWords = null;
    provedAt = null;
    lockAll();
  };
  const hold = (key: Buffer, proved: boolean) => {
    zero();
    dataKey = key;
    keys = subkeys(key);
    lastActivity = timer();
    provedAt = proved ? timer() : null;
  };
  const unlocked = (): Buffer => {
    if (!dataKey) throw new LockedError();
    return dataKey;
  };
  /** With a password set, a change to a secret needs a proof from the last five minutes. */
  const requireProof = () => {
    if (!rows.has("password")) return;
    if (provedAt === null || timer() - provedAt > PROOF_MS) throw new ProofRequiredError();
  };
  /** Inside a change's transaction: a computer's copy may never sit beside a password. */
  const noPasswordNow = () => {
    if (rows.has("password")) throw new KeyChangedError("a password was set meanwhile, so this computer was not remembered");
  };

  /**
   * After a key copy is removed or replaced: fold the WAL in and rebuild the file on the background
   * lane, so the old copy is gone from disk. The change already marked the cleanup owed in its own
   * transaction, so a failure here cannot leave it unrecorded. It clears only the mark it started
   * under: a change another app marks meanwhile keeps its own record until its own cleanup runs.
   */
  const cleanUp = async (): Promise<KeyChange> => {
    const covered = rows.owedMark();
    try {
      await database.scrub();
      await database.rebuild();
      if (covered !== null) rows.clearOwed(covered);
      retryGap = FIRST_RETRY_MS;
      return { cleanup: "done" };
    } catch (error) {
      const reason = toErrorMessage(error);
      try {
        rows.setOwed(reason);
      } catch {
        // The row already says a cleanup is owed; only the reason could not be refined.
      }
      return { cleanup: "pending", reason };
    }
  };

  /** After an unlock: retry an owed cleanup in the background, backing off while it keeps failing. */
  const retryInBackground = () => {
    if (retrying || rows.owed() === null || timer() < nextRetryAt) return;
    retrying = exclusive(cleanUp)
      .then((result) => {
        if (result.cleanup === "pending") {
          nextRetryAt = timer() + retryGap;
          retryGap = Math.min(retryGap * 2, MAX_RETRY_MS);
        }
      })
      .finally(() => {
        retrying = null;
      });
  };

  const sealForDevice = async (key: Buffer) => vault.seal(key.toString("base64"));
  const openFromDevice = async (sealed: string) => Buffer.from(await vault.open(sealed), "base64");
  const labelCell = async (key: Buffer) => sealCell(subkeys(key).content, "devices.label", await vault.computerLabel());

  /** Reseat this computer's device copy: seal, THEN resolve `computerFor` (a failed seal must never
   *  reach it - it can write a new id file), THEN label; one transaction runs `guard` (may refuse by
   *  throwing - no putDevice, no markOwed), writes the copy, runs `extra` work if given, marks cleanup
   *  owed. Shared by unlockWithWords/removePassword/upgradeDeviceLock (B33). */
  const reseatDeviceCopy = async (key: Buffer, computerFor: () => Promise<string>, guard: () => void, extra?: () => void): Promise<void> => {
    const sealed = await sealForDevice(key);
    const computer = await computerFor();
    const label = await labelCell(key);
    transaction(() => {
      guard();
      rows.putDevice(computer, label, sealed);
      extra?.();
      rows.markOwed(NOT_YET_RUN);
    });
  };

  const api = {
    async status(): Promise<KeyringStatus> {
      const n = rows.secretCount() + rows.deviceCount();
      return {
        state: n === 0 ? "new" : dataKey ? "unlocked" : "locked",
        hasPassword: rows.has("password"),
        hasWords: rows.has("recovery"),
        cleanupPending: rows.owed(),
        lockPolicy: rows.has("password") ? (rows.policy() ?? null) : null,
        ...wordsDates(),
      };
    },

    /**
     * First run only: makes the data key and gives this computer a copy. The slow vault work comes
     * first, and the sealed copy is opened again to prove the vault gives the key back; then one
     * transaction claims the keyring, so two setups at once cannot both win.
     */
    setup: () =>
      exclusive(async () => {
        const key = newDataKey();
        const sealed = await sealForDevice(key);
        const back = await openFromDevice(sealed);
        if (!back.equals(key)) throw new Error("this computer's key store did not give the key back; nothing was set up");
        const computer = await vault.computerIdForNewCopy();
        const label = await labelCell(key);
        transaction(() => {
          if (rows.anythingStored()) throw new Error("this library already has a key or encrypted content; another key would orphan it");
          rows.putDevice(computer, label, sealed);
        });
        hold(key, false);
      }),

    /**
     * Unlocks without asking when this computer holds a copy. Its own copy is tried first; if that is
     * missing (the id file was lost or replaced), any other copy this computer's vault can open is
     * this computer's too, so a lost id never locks the person out.
     */
    async unlock(): Promise<boolean> {
      const here = await vault.computerId();
      const own = rows.device(here);
      const others = rows.devices().filter((d) => d.computer_id !== here);
      const candidates = own ? [own] : others.map((d) => rows.device(d.computer_id));
      for (const row of candidates) {
        if (!row) continue;
        try {
          hold(await openFromDevice(JSON.parse(row.wrap_json) as string), false);
        } catch {
          continue;
        }
        retryInBackground();
        return true;
      }
      return false;
    },

    async unlockWithPassword(password: string): Promise<void> {
      const r = rows.secret("password");
      if (!r) throw new WrongSecretError("this library has no password");
      hold(await passwords.open(JSON.parse(r.wrap_json) as PasswordWrap, password), true);
      retryInBackground();
    },

    /**
     * Unlocks with the recovery words. When the person chooses to remember this computer, and no
     * password is set, this computer gets its own copy beside any others.
     */
    async unlockWithWords(words: string, choice: { rememberComputer: boolean }): Promise<KeyChange> {
      const r = rows.secret("recovery");
      if (!r) throw new WrongSecretError("this library has no recovery words");
      const key = openWithWords(JSON.parse(r.wrap_json) as Wrapped, words);
      hold(key, true);
      if (!choice.rememberComputer || rows.has("password")) {
        retryInBackground();
        return { cleanup: "done" };
      }
      return exclusive(async () => {
        database.assertRoomToRebuild();
        await reseatDeviceCopy(key, () => vault.computerIdForNewCopy(), noPasswordNow);
        return cleanUp();
      });
    },

    /** Proves the person knows a secret, for the next five minutes of changes. */
    async prove(given: { password: string } | { words: string }): Promise<void> {
      const key = unlocked();
      let opened: Buffer;
      if ("password" in given) {
        const r = rows.secret("password");
        if (!r) throw new WrongSecretError("this library has no password");
        opened = await passwords.open(JSON.parse(r.wrap_json) as PasswordWrap, given.password);
      } else {
        const r = rows.secret("recovery");
        if (!r) throw new WrongSecretError("this library has no recovery words");
        opened = openWithWords(JSON.parse(r.wrap_json) as Wrapped, given.words);
      }
      const same = opened.equals(key);
      opened.fill(0);
      if (!same) throw new WrongSecretError();
      provedAt = timer();
    },

    /**
     * The occasional check that the words are still known: all twelve, since no
     * single word is stored. Right words record the date and count as a proof; wrong ones change nothing.
     */
    async rehearse(words: string): Promise<void> {
      await api.prove({ words });
      rows.setRehearsedAt(Date.now());
    },

    ...lifecycle.access,
    lock(): void {
      zero();
    },

    /** The app is closing: same as lock, named for the reader. */
    forget(): void {
      zero();
    },

    /** The content and index keys; throws LockedError while locked. */
    keys(): ReturnType<typeof subkeys> {
      if (!keys) throw new LockedError();
      return keys;
    },

    /** Sets or replaces the password. Needs words first. Every remembered computer's copy goes. */
    setPassword: (password: string, lockPolicy: LockPolicy) =>
      exclusive(async (): Promise<KeyChange> => {
        const key = unlocked();
        const p = checkPolicy(lockPolicy);
        if (!rows.has("recovery")) throw new KeyringRuleError("make recovery words first, so a forgotten password can never lose the library");
        requireProof();
        database.assertRoomToRebuild();
        const wrap = await passwords.wrap(key, password);
        transaction(() => {
          if (!rows.has("recovery")) throw new KeyChangedError("the recovery words were removed meanwhile");
          rows.putSecret("password", wrap);
          rows.dropAllDevices();
          rows.setPolicy(p);
          rows.markOwed(NOT_YET_RUN);
        });
        lastActivity = timer();
        return cleanUp();
      }),

    /** Removes the password after a fresh proof; this computer holds a copy again. */
    removePassword: () =>
      exclusive(async (): Promise<KeyChange> => {
        const key = unlocked();
        requireProof();
        const current = rows.secret("password")?.wrap_json;
        if (!current) return { cleanup: "done" };
        database.assertRoomToRebuild();
        await reseatDeviceCopy(
          key, () => vault.computerIdForNewCopy(),
          // Only the password that was checked may be removed, never one set meanwhile.
          () => { if (rows.secret("password")?.wrap_json !== current) throw new KeyChangedError("the password changed meanwhile, so it was not removed"); },
          () => { rows.dropSecret("password"); rows.setPolicy(null); },
        );
        return cleanUp();
      }),

    /** New recovery words, not yet in force: they count only once typed back. */
    beginWords(): string {
      unlocked();
      pendingWords = makeWords();
      return pendingWords;
    },

    /**
     * Puts the pending words in force if typed back right. The old words stop working only once the
     * new ones are in, so there is never a gap.
     */
    confirmWords: (typed: string) =>
      exclusive(async (): Promise<KeyChange> => {
        const key = unlocked();
        requireProof();
        if (!pendingWords || normalizeWords(typed) !== normalizeWords(pendingWords)) {
          throw new WrongSecretError("those words do not match the ones shown");
        }
        const replacing = rows.has("recovery");
        if (replacing) database.assertRoomToRebuild();
        const wrap = wrapWithWords(key, pendingWords);
        transaction(() => {
          rows.putSecret("recovery", wrap);
          if (replacing) rows.markOwed(NOT_YET_RUN);
        });
        pendingWords = null;
        provedAt = timer();
        return replacing ? cleanUp() : { cleanup: "done" };
      }),

    /** Every computer that holds a copy, with its name. Needs the keyring unlocked (names are sealed). */
    async rememberedComputers(): Promise<RememberedComputer[]> {
      const content = api.keys().content;
      const here = await vault.computerId();
      return rows.devices().map((r) => ({
        id: r.computer_id,
        label: openCell(content, "devices.label", r.label),
        createdAt: r.created_at,
        thisComputer: r.computer_id === here,
        lock: vault.lockOf(JSON.parse(r.wrap_json) as string).lock,
      }));
    },

    /** Removes one computer's copy, unless it is the last way into the library. */
    forgetComputer: (computerId: string) =>
      exclusive(async (): Promise<KeyChange> => {
        unlocked();
        requireProof();
        if (!rows.device(computerId)) throw new KeyringRuleError("that computer is not remembered");
        database.assertRoomToRebuild();
        transaction(() => {
          const waysLeft = rows.deviceCount() - 1 + (rows.has("password") ? 1 : 0) + (rows.has("recovery") ? 1 : 0);
          if (waysLeft === 0) throw new KeyringRuleError("this is the only way into the library; make recovery words before forgetting it");
          rows.dropDevice(computerId);
          rows.markOwed(NOT_YET_RUN);
        });
        return cleanUp();
      }),

    /** The lock on this computer's copy, as recorded when it was sealed (not what would be used now). */
    async deviceLock(): Promise<{ lock: string; weak: boolean; strongerAvailable: boolean } | null> {
      const row = rows.device(await vault.computerId());
      if (!row) return null;
      const sealed = JSON.parse(row.wrap_json) as string;
      return { ...vault.lockOf(sealed), strongerAvailable: await vault.strongerThan(sealed) };
    },

    /** Moves this computer's copy to the strongest lock available now (a keychain over the key file). */
    upgradeDeviceLock: () =>
      exclusive(async (): Promise<KeyChange> => {
        const key = unlocked();
        const computer = await vault.computerId();
        const row = rows.device(computer);
        if (!row) throw new KeyringRuleError("this computer holds no copy to move");
        if (!(await vault.strongerThan(JSON.parse(row.wrap_json) as string))) return { cleanup: "done" };
        database.assertRoomToRebuild();
        await reseatDeviceCopy(key, async () => computer, () => {
          noPasswordNow();
          if (!rows.device(computer)) throw new KeyChangedError("this computer was forgotten meanwhile");
        });
        return cleanUp();
      }),

    /** Tries an owed cleanup again now, waiting for it; the same result shape as a key change. */
    retryCleanup: () => exclusive(async (): Promise<KeyChange> => (rows.owed() === null ? { cleanup: "done" } : cleanUp())),

    /** Resolves when no background retry is running (for the app shell and tests). */
    async settled(): Promise<void> {
      while (retrying) await retrying.catch(() => undefined);
    },

    /** Marks activity, for the idle lock. */
    touch(): void { lastActivity = timer(); },
    /** Locks when the idle policy says so. Returns true when it locked. */
    lockIfIdle(): boolean {
      const ms = api.idleLockIn();
      if (ms === null || ms > 0) return false;
      zero();
      return true;
    },

    /** Ms until `lockIfIdle` locks (0 once due), or null; library-root.ts arms its one timer from it. */
    idleLockIn(): number | null {
      const p = rows.policy();
      return dataKey && p?.mode === "idle" ? Math.max(0, p.idleMinutes * 60_000 - (timer() - lastActivity)) : null;
    },
  };
  return api;
}
