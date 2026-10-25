/**
 * The authenticated-encryption primitive every key-holding backend shares.
 *
 * WHY THIS IS EXTRACTED. Two backends now hold a 256-bit key and need the same envelope around it:
 * the passphrase backend derives its key with scrypt, the identity-file backend reads its key off
 * disk. Only the DERIVATION differs, and duplicating AES-GCM per backend is how two copies of one
 * cipher drift apart. Keeping it here also means the crypto is unit-tested once, with a literal key,
 * on a machine with no keystore of any kind - which is what lets it run in CI.
 *
 * GCM, not CBC: the authentication tag makes a wrong key or altered ciphertext fail loudly instead
 * of returning plausible garbage. A fresh random IV per seal means the same plaintext never encrypts
 * to the same bytes twice.
 *
 * Two APIs, one cipher path. `aesSealBuf`/`aesOpenBuf` stay in buffers and are what a multi-MB cell
 * (`src/stage/crypto/crypto.ts`'s `sealCell`/`openCell`) uses: perf research found the base64-string API cost 40% of decrypt CPU on a
 * 3.2 MB cell purely from converting buffers to base64 and back for no reason. `aesSeal`/`aesOpen`
 * (small payloads: a wrapped 32-byte data key) build on the buffer API instead of duplicating it.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** The ciphertext and everything needed to reverse it, given the key. Base64 throughout. */
export interface AesParts {
  readonly iv: string;
  readonly tag: string;
  readonly ct: string;
}

/** The same three values as buffers, for a caller that already has (or wants) buffers. */
export interface AesPartsBuf {
  readonly iv: Buffer;
  readonly tag: Buffer;
  readonly ct: Buffer;
}

export const b64 = (buf: Buffer): string => buf.toString("base64");
export const unb64 = (value: string): Buffer => Buffer.from(value, "base64");

/**
 * Encrypt with a 32-byte key, staying in buffers throughout. Throws rather than truncating if the
 * key is the wrong size. `aad` is authenticated but not encrypted: opening with a different `aad`
 * fails, which binds a ciphertext to where it belongs (Bunraku's encrypted cells bind to their table
 * and column).
 */
export function aesSealBuf(key: Buffer, plaintext: Buffer, aad?: Buffer): AesPartsBuf {
  if (key.length !== 32) throw new Error(`keystore: AES key must be 32 bytes, got ${key.length}`);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  if (aad !== undefined) cipher.setAAD(aad);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), ct };
}

/** Decrypt with a 32-byte key, staying in buffers throughout. Throws on a wrong key or tampered
 * ciphertext; never returns garbage. */
export function aesOpenBuf(key: Buffer, parts: AesPartsBuf, aad?: Buffer): Buffer {
  if (key.length !== 32) throw new Error(`keystore: AES key must be 32 bytes, got ${key.length}`);
  const decipher = createDecipheriv("aes-256-gcm", key, parts.iv);
  if (aad !== undefined) decipher.setAAD(aad);
  decipher.setAuthTag(parts.tag);
  return Buffer.concat([decipher.update(parts.ct), decipher.final()]);
}

/** The string/base64 API for small payloads (a wrapped data key), built on the buffer path above. */
export function aesSeal(key: Buffer, plaintext: string, aad?: string): AesParts {
  const { iv, tag, ct } = aesSealBuf(key, Buffer.from(plaintext, "utf8"), aad === undefined ? undefined : Buffer.from(aad, "utf8"));
  return { iv: b64(iv), tag: b64(tag), ct: b64(ct) };
}

export function aesOpen(key: Buffer, parts: AesParts, aad?: string): string {
  const plaintext = aesOpenBuf(
    key,
    { iv: unb64(parts.iv), tag: unb64(parts.tag), ct: unb64(parts.ct) },
    aad === undefined ? undefined : Buffer.from(aad, "utf8"),
  );
  return plaintext.toString("utf8");
}
