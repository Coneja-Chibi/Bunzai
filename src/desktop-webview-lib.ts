/**
 * Linux: hand the window worker its webview library from the per-user runtime folder.
 *
 * A compiled Bunzai carries libwebview inside the executable, and Bun unpacks it into TMPDIR every time the
 * window worker loads it. When TMPDIR is missing, unwritable or on a full disk, that unpacking fails, the
 * window never opens, and the studio serves with no window for the rest of the session (reportWindowFailure).
 * Every later launch then opens its window onto that headless studio, and closing such a window never stops
 * it. Unpacking the 70 KB library once into $XDG_RUNTIME_DIR (a per-user tmpfs) and naming it in WEBVIEW_PATH,
 * which webview-bun reads before its own copy, takes TMPDIR out of the window's way. Anything that fails here
 * leaves Bun's own unpacking in place.
 */
import { lstat } from "node:fs/promises";
import type { Stats } from "node:fs";
import { isAbsolute, join } from "node:path";
import { isRecord } from "./core/guards";
import { sha256HexBytes } from "./core/sha256";
import { writeAtomicReplace } from "./studio/atomic-file";
import arm64 from "webview-bun/build/libwebview-arm64.so" with { type: "file" };
import x64 from "webview-bun/build/libwebview-x64.so" with { type: "file" };

/** The window worker's environment, with WEBVIEW_PATH added on Linux; null keeps the default. */
export async function webviewWorkerEnv(
  env: Record<string, string | undefined> = process.env,
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): Promise<Record<string, string> | null> {
  const runtimeDir = env["XDG_RUNTIME_DIR"];
  const uid = process.getuid?.();
  if (platform !== "linux" || uid === undefined || !runtimeDir || !isAbsolute(runtimeDir) || env["WEBVIEW_PATH"] || (arch !== "x64" && arch !== "arm64")) return null;
  try {
    const directory = await lstat(runtimeDir);
    if (!directory.isDirectory() || directory.uid !== uid || (directory.mode & 0o077) !== 0) return null;
    const bytes = await Bun.file(arch === "arm64" ? arm64 : x64).bytes();
    const target = join(runtimeDir, `bunzai-libwebview-${sha256HexBytes(bytes)}.so`);
    let existing: Stats | undefined;
    try { existing = await lstat(target); } catch (error) {
      if (!isRecord(error) || error["code"] !== "ENOENT") throw error;
    }
    if (existing) {
      if (!existing.isFile() || existing.uid !== uid || existing.nlink !== 1 || (existing.mode & 0o077) !== 0 || existing.size !== bytes.length) return null;
      const cached = await Bun.file(target).slice(0, bytes.length + 1).bytes();
      if (cached.length !== bytes.length || !cached.every((value, index) => value === bytes[index])) return null;
    } else {
      await writeAtomicReplace(target, bytes, { mode: 0o600 });
    }
    const next: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) if (value !== undefined) next[key] = value;
    return { ...next, WEBVIEW_PATH: target };
  } catch {
    return null;
  }
}
