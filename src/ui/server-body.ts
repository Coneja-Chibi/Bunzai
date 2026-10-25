/**
 * The byte pump's server-side sinks (the pump itself is src/core/stream-bytes.ts): a file, a sealed
 * (AES-256-GCM) file, and a hash tee. A sink never reads the source; the pump hands it chunks, then
 * `finish()` on success or `abort()` on any early stop, which closes the handle. The caller owns the
 * file's directory and removes it on failure.
 */
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { open, type FileHandle } from "node:fs/promises";
import type { ByteSink } from "../core/stream-bytes";

/** Owner-only: an in-flight upload holds whatever private cards, personas or pictures it carries. */
export async function fileSink(path: string, mode = 0o600): Promise<ByteSink> {
  const handle = await open(path, "w", mode);
  return {
    write: async (chunk) => { await handle.write(chunk); },
    finish: () => handle.close(),
    abort: () => handle.close().catch(() => undefined),
  };
}

/** `iv | ciphertext | auth tag`, the layout the staged-upload reader opens with the same key. */
export async function sealedFileSink(path: string, key: Buffer, mode = 0o600): Promise<ByteSink> {
  const handle: FileHandle = await open(path, "w", mode);
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    await handle.write(iv);
    return {
      write: async (chunk) => { await handle.write(cipher.update(chunk)); },
      finish: async () => {
        try {
          await handle.write(cipher.final());
          await handle.write(cipher.getAuthTag());
        } finally { await handle.close(); }
      },
      abort: () => handle.close().catch(() => undefined),
    };
  } catch (error) {
    await handle.close().catch(() => undefined);
    throw error;
  }
}

/** Tees every chunk through SHA-256 on its way to `inner`; `sha256()` is valid once the pump has finished. */
export function hashSink(inner: ByteSink): ByteSink & { sha256(): string } {
  const hash = createHash("sha256");
  let digest: string | undefined;
  return {
    write(chunk) { hash.update(chunk); return inner.write(chunk); },
    finish: () => inner.finish(),
    abort: () => inner.abort(),
    sha256: () => (digest ??= hash.digest("hex")),
  };
}
