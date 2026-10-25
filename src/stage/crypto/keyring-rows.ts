/**
 * The keyring's rows (migration 3): the password and recovery copies, one copy per remembered
 * computer, the lock policy, and a cleanup still owed after a key change. Plain reads and writes
 * only; every rule about when they may change lives in keyring.ts.
 */
import { randomUUID } from "node:crypto";
import type { StageDatabase } from "../store/sqlite/database";
import { KeyringRuleError } from "./keyring-errors";

export type SecretKind = "password" | "recovery";

/** When a password is asked for. */
export type LockPolicy = { mode: "each-open" } | { mode: "idle"; idleMinutes: number };

/** A lock policy as the keyring accepts it; anything else is refused before it is stored. */
export function checkPolicy(policy: LockPolicy): LockPolicy {
  if (policy?.mode === "each-open") return { mode: "each-open" };
  if (policy?.mode === "idle") {
    const n = policy.idleMinutes;
    if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 1) throw new KeyringRuleError("idle minutes must be a whole number of at least 1");
    return { mode: "idle", idleMinutes: n };
  }
  throw new KeyringRuleError("unknown lock policy");
}

export function keyringRows(database: StageDatabase) {
  const { statement } = database;
  return {
    secret: (kind: SecretKind) => statement("SELECT wrap_json FROM keyring WHERE kind = ?").get(kind) as { wrap_json: string } | null,
    has: (kind: SecretKind) => statement("SELECT 1 FROM keyring WHERE kind = ?").get(kind) !== null,
    putSecret: (kind: SecretKind, wrap: unknown) =>
      statement(
        `INSERT INTO keyring (kind, wrap_json, created_at) VALUES (?, ?, ?)
         ON CONFLICT (kind) DO UPDATE SET wrap_json = excluded.wrap_json, created_at = excluded.created_at`,
      ).run(kind, JSON.stringify(wrap), Date.now()),
    dropSecret: (kind: SecretKind) => statement("DELETE FROM keyring WHERE kind = ?").run(kind),
    /** When the recovery words in force were written (epoch ms), or null without words. */
    wordsWrittenAt: () => (statement("SELECT created_at FROM keyring WHERE kind = 'recovery'").get() as { created_at: number } | null)?.created_at ?? null,
    /** When the words were last typed back in a rehearsal (epoch ms), or null. A date, no content. */
    rehearsedAt: () => {
      const v = (statement("SELECT value FROM library_meta WHERE key = 'words_rehearsed_at'").get() as { value: string } | null)?.value;
      return v === undefined ? null : Number(v);
    },
    setRehearsedAt: (at: number) =>
      statement(
        `INSERT INTO library_meta (key, value) VALUES ('words_rehearsed_at', ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      ).run(String(at)),
    secretCount: () => (statement("SELECT count(*) AS n FROM keyring").get() as { n: number }).n,

    device: (computerId: string) =>
      statement("SELECT wrap_json FROM devices WHERE computer_id = ?").get(computerId) as { wrap_json: string } | null,
    deviceCount: () => (statement("SELECT count(*) AS n FROM devices").get() as { n: number }).n,
    devices: () =>
      statement("SELECT computer_id, label, wrap_json, created_at FROM devices ORDER BY created_at").all() as {
        computer_id: string;
        label: string;
        wrap_json: string;
        created_at: number;
      }[],
    putDevice: (computerId: string, labelCell: string, sealed: string) =>
      statement(
        `INSERT INTO devices (computer_id, label, wrap_json, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (computer_id) DO UPDATE SET label = excluded.label, wrap_json = excluded.wrap_json, created_at = excluded.created_at`,
      ).run(computerId, labelCell, JSON.stringify(sealed), Date.now()),
    dropDevice: (computerId: string) => statement("DELETE FROM devices WHERE computer_id = ?").run(computerId),
    dropAllDevices: () => statement("DELETE FROM devices").run(),

    policy: (): LockPolicy | null => {
      const r = statement("SELECT mode, idle_minutes FROM lock_settings WHERE id = 1").get() as
        | { mode: LockPolicy["mode"]; idle_minutes: number | null }
        | null;
      if (!r) return null;
      return r.mode === "idle" ? { mode: "idle", idleMinutes: r.idle_minutes! } : { mode: "each-open" };
    },
    setPolicy: (p: LockPolicy | null) => {
      statement("DELETE FROM lock_settings").run();
      if (p) statement("INSERT INTO lock_settings (id, mode, idle_minutes) VALUES (1, ?, ?)").run(p.mode, p.mode === "idle" ? p.idleMinutes : null);
    },

    /** The reason a cleanup is still owed, or null. */
    owed: () => (statement("SELECT cleanup_pending FROM maintenance WHERE id = 1").get() as { cleanup_pending: string } | null)?.cleanup_pending ?? null,
    /** Which change marked the owed cleanup; a cleanup clears only the mark it started under. */
    owedMark: () => (statement("SELECT mark FROM maintenance WHERE id = 1").get() as { mark: string } | null)?.mark ?? null,
    /** A key change owes a cleanup: a fresh mark, inside the change's own transaction. */
    markOwed: (reason: string) =>
      statement(
        `INSERT INTO maintenance (id, cleanup_pending, since, mark) VALUES (1, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET cleanup_pending = excluded.cleanup_pending, mark = excluded.mark`,
      ).run(reason, Date.now(), randomUUID()),
    /** Records why an owed cleanup failed, keeping its mark (or owing one, if another app cleared it). */
    setOwed: (reason: string) =>
      statement(
        `INSERT INTO maintenance (id, cleanup_pending, since, mark) VALUES (1, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET cleanup_pending = excluded.cleanup_pending`,
      ).run(reason, Date.now(), randomUUID()),
    clearOwed: (mark: string) => statement("DELETE FROM maintenance WHERE mark = ?").run(mark),

    /** Keys, computers, and content (library, chats, Studio state): setup refuses to run when any exist. */
    anythingStored: () =>
      (
        statement(
          `SELECT (SELECT count(*) FROM keyring) + (SELECT count(*) FROM devices)
                + (SELECT count(*) FROM documents) + (SELECT count(*) FROM document_graves) + (SELECT count(*) FROM chats)
                + (SELECT count(*) FROM studio_state) AS n`,
        ).get() as { n: number }
      ).n > 0,
  };
}
