/**
 * Test support: a fast stand-in for the Argon2id password lock, so tests of keyring rules do not
 * spend two seconds per password. The real lock is tested at full strength in crypto.test.ts and
 * the freeze gate. The boundary lint forbids app code from importing this file, and its wraps carry
 * strength settings the real `openWithPassword` refuses, so a fast wrap can never reach a library.
 */
import { createHash, randomBytes } from "node:crypto";
import { aesOpen, aesSeal } from "../../kit/keystore/aes";
import { WrongSecretError, type PasswordLock, type PasswordWrap } from "./crypto";

/** Not a setting Bunzai writes: the real lock rejects it as damaged. */
const FAST = { name: "argon2id", m: 0, t: 0, p: 0 } as const;

const kek = (password: string, salt: string) => createHash("sha256").update(salt).update(password.normalize("NFKC")).digest();

/** `delayMs` holds each wrap and open, for tests that need a password step to overlap another change. */
export function fastPasswords(opts: { delayMs?: number } = {}): PasswordLock {
  const pause = () => (opts.delayMs ? new Promise((r) => setTimeout(r, opts.delayMs)) : Promise.resolve());
  return {
    async wrap(dataKey, password) {
      if (typeof password !== "string" || password.length === 0) throw new Error("a password cannot be empty");
      await pause();
      const salt = randomBytes(16).toString("base64");
      return { parts: aesSeal(kek(password, salt), dataKey.toString("base64"), "password"), kdf: FAST, salt } satisfies PasswordWrap;
    },
    async open(w, password) {
      await pause();
      if (w.kdf.m !== FAST.m) throw new Error("fast password lock: this wrap was made by the real one");
      try {
        return Buffer.from(aesOpen(kek(password, w.salt), w.parts, "password"), "base64");
      } catch {
        throw new WrongSecretError();
      }
    },
  };
}
