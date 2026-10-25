/** Run a Studio filesystem test under a throwaway directory, cleaning it on every exit path. */
import { mkdtemp, rm } from "node:fs/promises";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach } from "bun:test";

const active = new Set<string>();

afterEach(async () => {
  const paths = [...active];
  active.clear();
  await Promise.all(paths.map((path) => rm(path, { recursive: true, force: true })));
});

/** Register an async test directory for automatic removal after the current test. */
export async function tempDir(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  active.add(path);
  return path;
}

/** Register a sync-created test directory for automatic removal after the current test. */
export function tempDirSync(prefix: string): string {
  const path = mkdtempSync(join(tmpdir(), prefix));
  active.add(path);
  return path;
}

export async function removeTempDir(path: string): Promise<void> {
  active.delete(path);
  for (let attempt = 0; ; attempt++) {
    try {
      await rm(path, { recursive: true, force: true });
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EBUSY" || attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
}

export function removeTempDirSync(path: string): void {
  active.delete(path);
  rmSync(path, { recursive: true, force: true });
}

export async function withTempDir<T>(prefix: string, run: (path: string) => Promise<T> | T): Promise<T> {
  const path = await tempDir(prefix);
  try {
    return await run(path);
  } finally {
    await removeTempDir(path);
  }
}

export function withTempDirSync<T>(prefix: string, run: (path: string) => T): T {
  const path = tempDirSync(prefix);
  try {
    return run(path);
  } finally {
    removeTempDirSync(path);
  }
}
