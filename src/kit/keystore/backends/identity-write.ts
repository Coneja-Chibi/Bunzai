/** Exclusive identity-file creation with cleanup for a write that fails partway through. */
import { open, stat, unlink, type FileHandle } from "node:fs/promises";

interface IdentityFileHandle {
  writeFile(data: Buffer): Promise<void>;
  sync(): Promise<void>;
  chmod(mode: number): Promise<void>;
  stat(): Promise<{ dev: number; ino: number }>;
  close(): Promise<void>;
}

interface IdentityFileWriter {
  open(path: string, flags: "wx", mode: number): Promise<IdentityFileHandle>;
  stat(path: string): Promise<{ dev: number; ino: number }>;
  unlink(path: string): Promise<void>;
}

const disk: IdentityFileWriter = {
  open: async (path, flags, mode) => await open(path, flags, mode) as FileHandle,
  stat: async (path) => await stat(path),
  unlink,
};

/** Write through an exclusive handle; remove a partial file only while it is still ours. */
export async function writeIdentityFile(
  path: string,
  bytes: Buffer,
  writer: IdentityFileWriter = disk,
): Promise<void> {
  let handle: IdentityFileHandle | null = null;
  let failed: unknown;
  try {
    handle = await writer.open(path, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    try { await handle.chmod(0o600); } catch { /* best effort on filesystems without POSIX modes */ }
  } catch (error) {
    failed = error;
  }
  if (handle) {
    const created = await handle.stat().catch(() => null);
    await handle.close().catch((error) => { failed ??= error; });
    if (failed && created) {
      const current = await writer.stat(path).catch(() => null);
      if (current?.dev === created.dev && current.ino === created.ino) {
        await writer.unlink(path).catch(() => undefined);
      }
    }
  }
  if (failed) throw failed;
}
