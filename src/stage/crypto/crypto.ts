/**
 * The encryption core: the cell format, the data key and its subkeys,
 * and the password and recovery-word wraps. Nothing here touches the disk or the key vault; the
 * password step runs on the background lane (password-worker.ts).
 * AES-256-GCM comes from the vault's one implementation (src/kit/keystore/aes.ts), so there is a
 * single cipher to get right.
 */
import { createHmac, hkdfSync, randomBytes } from "node:crypto";
import { DamagedDataError } from "../damaged-data-error";
export { DamagedDataError } from "../damaged-data-error";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { aesOpen, aesOpenBuf, aesSeal, aesSealBuf, type AesParts, type AesPartsBuf } from "../../kit/keystore/aes";
import { runOnLane, startLaneWorker } from "../worker-lane";
import type { PasswordJob, PasswordReply } from "./password-worker";

/** A secret that does not open this wrap: a wrong password, or recovery words from elsewhere. */
export class WrongSecretError extends Error {
  constructor(message = "that does not unlock this library") {
    super(message);
    this.name = "WrongSecretError";
  }
}

const CELL_PREFIX = "e1:";
const IV = 12;
const TAG = 16;

/** The one key that encrypts everything (spec rule 1). */
export function newDataKey(): Buffer {
  return randomBytes(32);
}

const hkdf = (key: Buffer, info: string): Buffer => Buffer.from(hkdfSync("sha256", key, Buffer.alloc(0), info, 32));

/** Keys derived from the data key, one per use, so no key does two jobs. */
export function subkeys(dataKey: Buffer): { content: Buffer; index: Buffer } {
  return { content: hkdf(dataKey, "bunraku content v1"), index: hkdf(dataKey, "bunraku index v1") };
}

/**
 * Encrypts one cell. `where` is its table and column (spec rule 9): a cell opens only in the column
 * it was written for, but may be copied between rows. Uses the buffer-native cipher path
 * (`aesSealBuf`) so a multi-MB body is never round-tripped through a base64 string twice for no
 * reason; the wire format is unchanged.
 */
export function sealCell(contentKey: Buffer, where: string, text: string): string {
  const { iv, tag, ct } = aesSealBuf(contentKey, Buffer.from(text, "utf8"), Buffer.from(where, "utf8"));
  return CELL_PREFIX + Buffer.concat([iv, tag, ct]).toString("base64");
}

/** Decrypts one cell. Throws on a wrong key, a tampered cell, a cell from another column, or a foreign format. */
export function openCell(contentKey: Buffer, where: string, cell: string): string {
  if (typeof cell !== "string" || !cell.startsWith(CELL_PREFIX)) throw new DamagedDataError(where, "not an encrypted cell");
  const raw = Buffer.from(cell.slice(CELL_PREFIX.length), "base64");
  if (raw.length < IV + TAG) throw new DamagedDataError(where, "encrypted cell is too short");
  const parts: AesPartsBuf = { iv: raw.subarray(0, IV), tag: raw.subarray(IV, IV + TAG), ct: raw.subarray(IV + TAG) };
  try {
    return aesOpenBuf(contentKey, parts, Buffer.from(where, "utf8")).toString("utf8");
  } catch {
    // One reason for every failure: telling a wrong key from a changed byte would help an attacker
    // more than it helps a repair.
    throw new DamagedDataError(where, "it does not open with this library's key, or it was changed");
  }
}

/** A value the database searches by, hashed so equal values match and none can be read (spec rule 7). */
export function indexHash(indexKey: Buffer, value: string): string {
  return createHmac("sha256", indexKey).update(value, "utf8").digest("hex");
}

/** The data key sealed under a key-encrypting key. */
export interface Wrapped {
  readonly parts: AesParts;
}

function wrap(kek: Buffer, dataKey: Buffer, label: string): Wrapped {
  return { parts: aesSeal(kek, dataKey.toString("base64"), label) };
}

function unwrap(kek: Buffer, wrapped: Wrapped, label: string): Buffer {
  try {
    return Buffer.from(aesOpen(kek, wrapped.parts, label), "base64");
  } catch {
    throw new WrongSecretError();
  }
}

// -- the password wrap ------------------------------------------------------------------------------

/**
 * Argon2id: memory-hard, the password-hashing competition's winner and
 * OWASP's first choice. 64 MiB and 3 passes, about 2 s, run on the background lane's password
 * worker (password-worker.ts), so the app never pauses while a password is checked.
 */
const ARGON = { name: "argon2id", m: 65_536, t: 3, p: 1 } as const;
type Kdf = { readonly name: "argon2id"; readonly m: number; readonly t: number; readonly p: number };

export interface PasswordWrap extends Wrapped {
  readonly kdf: Kdf;
  readonly salt: string;
}

/**
 * The settings come from the file, so only the exact ones Bunzai writes are accepted: any raised
 * cost could hang the unlock (the review measured 83 s at the old upper bound) and any lowered one
 * would make guessing cheap. A future stronger setting arrives with its own version.
 */
function checkKdf(kdf: unknown): Kdf {
  const k = kdf as Partial<Kdf> | null;
  if (!k || k.name !== ARGON.name || k.m !== ARGON.m || k.t !== ARGON.t || k.p !== ARGON.p) {
    throw new DamagedDataError("keyring.password", "its strength settings are not ones Bunzai writes");
  }
  return ARGON;
}

function startPasswordWorker(): Worker {
  // The literal must match the entrypoint path relative to the build root (src/); see worker-lane.ts.
  return startLaneWorker(
    () => new Worker("./stage/crypto/password-worker.ts"),
    new URL("./password-worker.ts", import.meta.url).href,
  );
}

/** How long one password check may take before the lane gives up; Argon2id takes about 2 s. */
const PASSWORD_LANE_MS = 60_000;

/**
 * Derives the password's key on the background lane. If the lane cannot run, the check fails with
 * the reason instead of freezing the app; the recovery words, which need no Argon2id, still unlock.
 */
async function passwordKek(password: string, salt: Buffer, kdf: Kdf): Promise<Buffer> {
  const job: PasswordJob = { password: password.normalize("NFKC"), salt: new Uint8Array(salt), m: kdf.m, t: kdf.t, p: kdf.p };
  const reply = await runOnLane<PasswordJob, PasswordReply>(startPasswordWorker, job, PASSWORD_LANE_MS);
  if (!reply.ok) throw new Error(`the password check could not run (${reply.reason}); your recovery words still unlock the library`);
  return Buffer.from(reply.kek);
}

export async function wrapWithPassword(dataKey: Buffer, password: string): Promise<PasswordWrap> {
  if (typeof password !== "string" || password.length === 0) throw new Error("a password cannot be empty");
  const salt = randomBytes(16);
  return { ...wrap(await passwordKek(password, salt, ARGON), dataKey, "password"), kdf: ARGON, salt: salt.toString("base64") };
}

export async function openWithPassword(w: PasswordWrap, password: string): Promise<Buffer> {
  const kdf = checkKdf(w.kdf);
  return unwrap(await passwordKek(password, Buffer.from(w.salt, "base64"), kdf), w, "password");
}

/**
 * How the keyring wraps and opens its password copy. The app always uses `argonPasswords`. Tests of
 * keyring rules may pass the fast stand-in in fake-password-lock.ts, which the boundary lint keeps
 * out of app code and whose wraps the real `openWithPassword` refuses.
 */
export interface PasswordLock {
  wrap(dataKey: Buffer, password: string): Promise<PasswordWrap>;
  open(w: PasswordWrap, password: string): Promise<Buffer>;
}

export const argonPasswords: PasswordLock = { wrap: wrapWithPassword, open: openWithPassword };

// -- the recovery words -----------------------------------------------------------------------------

/** RoleCall's normalization: case, surrounding space, and runs of space never matter. */
export const normalizeWords = (words: string): string => words.normalize("NFKD").toLowerCase().trim().replace(/\s+/g, " ");

/** Twelve new BIP39 words (128 bits), the same standard RoleCall uses. */
export function makeWords(): string {
  return generateMnemonic(wordlist, 128);
}

function wordsKek(words: string): Buffer {
  const normal = normalizeWords(words);
  if (!validateMnemonic(normal, wordlist)) throw new WrongSecretError("those are not valid recovery words");
  return hkdf(Buffer.from(mnemonicToSeedSync(normal)), "bunraku recovery v1");
}

export function wrapWithWords(dataKey: Buffer, words: string): Wrapped {
  return wrap(wordsKek(words), dataKey, "recovery");
}

export function openWithWords(w: Wrapped, words: string): Buffer {
  return unwrap(wordsKek(words), w, "recovery");
}
