/**
 * Same-directory atomic publish - the ONLY atomic write in the app (fold B13). Every other temp-sibling-
 * then-rename publish (CLI export, provider-key vault, and device-id replacement) calls
 * writeAtomicReplace instead of hand-rolling it. Exclusive first-create paths such as the identity-key
 * file keep `wx` semantics. Keep-both uses exclusive create; overwrite uses temp then rename.
 */
import { open, rename, unlink } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { hasErrorName } from "../core/guards";
import { StudioValidationError } from "./errors";

export class StudioWriteError extends Error {
  readonly code = "studio_write" as const;
  constructor(message = "could not write file", options?: { cause?: unknown }) {
    super(message, options);
    this.name = "StudioWriteError";
  }
}

export class StudioConflictError extends Error {
  readonly code = "studio_conflict" as const;
  constructor(message = "file already exists") {
    super(message);
    this.name = "StudioConflictError";
  }
}

export const isStudioWriteError = (error: unknown): error is StudioWriteError =>
  error instanceof StudioWriteError || hasErrorName(error, "StudioWriteError");

export const isStudioConflictError = (error: unknown): error is StudioConflictError =>
  error instanceof StudioConflictError || hasErrorName(error, "StudioConflictError");

const tmpName = (finalPath: string): string => {
  const dir = dirname(finalPath);
  const tag = randomBytes(8).toString("hex");
  return join(dir, `.tmp-${tag}${extname(finalPath) || ".tmp"}`);
};

/**
 * Write bytes to a new exclusive path (fail if exists).
 *
 * The `wx` open CREATES the file, so a later failure (ENOSPC, EIO, a quota) would otherwise leave a
 * truncated file sitting at the destination. That is worse than it sounds: the next attempt hits
 * EEXIST and surfaces as "file already exists" for a piece the user never saved, which both misreads
 * the situation and blocks the retry that would succeed once space is free. So a write that fails
 * after creating the file removes it again, matching writeAtomicReplace's temp cleanup.
 *
 * The `created` flag is load-bearing: on the EEXIST path the file is someone else's and must NOT be
 * unlinked, or the cleanup would destroy the very data the exclusive open was protecting.
 */
export async function writeExclusive(finalPath: string, body: string): Promise<void> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  let created = false;
  try {
    handle = await open(finalPath, "wx");
    created = true;
    await handle.writeFile(body, "utf8");
    await handle.sync();
  } catch (e) {
    const code = (e as NodeJS.ErrnoException)?.code;
    if (code === "EEXIST") throw new StudioConflictError();
    if (created) {
      await handle?.close().catch(() => undefined);
      handle = undefined;
      await unlink(finalPath).catch(() => undefined);
    }
    throw new StudioWriteError("could not write file", { cause: e });
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

/** Windows can refuse rename-over-target with a transient share violation (EPERM/EACCES/EBUSY)
 * while another handle briefly holds the destination - a concurrent save of the SAME file (two
 * settings writes land together when a piece opens), the search indexer, a scanner. The temp is
 * ours alone, so retrying just the rename is idempotent and safe: bounded attempts (12, ~780ms
 * worst case - 6 was flake-prone under 24-way contention in the suite), linear backoff, then fail
 * closed. Live repro before the retry existed: 3 of 8 rapid settings saves 500 d. */
const RENAME_ATTEMPTS = 12;
const RETRYABLE_RENAME_CODES: ReadonlySet<string> = new Set(["EPERM", "EACCES", "EBUSY"]);
const renameQueues = new Map<string, Promise<void>>();

async function renameWithRetry(tmp: string, finalPath: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(tmp, finalPath);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException)?.code ?? "";
      if (attempt >= RENAME_ATTEMPTS || !RETRYABLE_RENAME_CODES.has(code)) throw e;
      await new Promise((resolve) => setTimeout(resolve, 10 * attempt));
    }
  }
}

/** Serialize same-process renames per destination; external share violations still use the retry. */
async function publishRename(tmp: string, finalPath: string): Promise<void> {
  const resolved = resolve(finalPath);
  const key = process.platform === "win32" ? resolved.toLowerCase() : resolved;
  const previous = renameQueues.get(key) ?? Promise.resolve();
  let release = (): void => undefined;
  const turn = new Promise<void>((done) => {
    release = done;
  });
  const tail = previous.catch(() => undefined).then(() => turn);
  renameQueues.set(key, tail);
  await previous.catch(() => undefined);
  try {
    await renameWithRetry(tmp, finalPath);
  } finally {
    release();
    if (renameQueues.get(key) === tail) renameQueues.delete(key);
  }
}

/**
 * Atomic replace: temp sibling then rename over destination. `body` may be text or raw bytes (a CLI
 * export can be either); `opts.mode` sets the temp file's permissions AT CREATION, never a chmod after
 * the fact - a chmod-after-write leaves a window where the temp file sits at the default (broader)
 * permissions, which matters for a secrets vault. The thrown StudioWriteError carries the real error as
 * `cause`, so a caller that wants the specific reason (a CLI print, say) can read it; the default
 * message stays the deliberately generic "could not write file" studioErr relies on for every route.
 */
export async function writeAtomicReplace(
  finalPath: string,
  body: string | Uint8Array,
  opts?: { mode?: number },
): Promise<void> {
  const tmp = tmpName(finalPath);
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(tmp, "wx", opts?.mode);
    if (typeof body === "string") await handle.writeFile(body, "utf8");
    else await handle.writeFile(body);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await publishRename(tmp, finalPath);
  } catch (e) {
    await handle?.close().catch(() => undefined);
    handle = undefined;
    await unlink(tmp).catch(() => undefined);
    throw new StudioWriteError(undefined, { cause: e });
  } finally {
    await handle?.close().catch(() => undefined);
  }
}
