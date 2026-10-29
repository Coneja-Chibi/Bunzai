/**
 * Clears temporary files a crashed run left behind (the disk-write
 * list): uploaded archives, staged imports, preset scratch files, pasted images, and Kit's MCP
 * configs. Each is deleted when its job ends; this catches the ones a crash stranded. Only entries
 * older than a day are removed, so a second Bunzai running at the same time never loses the file
 * it is working on.
 */
import { readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Every temp name Bunzai makes, by prefix. A new temp write adds its prefix here. */
export const TEMP_PREFIXES = [
  "bunzai-lvbak-upload-",
  "bunzai-lvbak-staged-",
  "bunzai-import-staged-",
  "bunzai-asset-staged-",
  "bunzai-macro-lab-",
  "bunzai-mcp-",
  "kit-paste-",
  "hoplight-verify-",
] as const;

const DAY_MS = 24 * 60 * 60_000;

/** Removes stale leftovers; returns how many. Never throws: a sweep must not stop the app starting. */
export function sweepStaleTemp(dir: string = tmpdir(), now: number = Date.now()): number {
  let removed = 0;
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return 0;
  }
  for (const name of names) {
    if (!TEMP_PREFIXES.some((p) => name.startsWith(p))) continue;
    const path = join(dir, name);
    try {
      if (now - statSync(path).mtimeMs < DAY_MS) continue;
      rmSync(path, { recursive: true, force: true });
      removed++;
    } catch {
      // In use or already gone: the next start tries again.
    }
  }
  return removed;
}
