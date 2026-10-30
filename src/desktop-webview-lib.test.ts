/** webviewWorkerEnv: on Linux the window worker gets its library from $XDG_RUNTIME_DIR, never from TMPDIR. */
import { afterAll, expect, test } from "bun:test";
import { chmodSync, linkSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { webviewWorkerEnv } from "./desktop-webview-lib";

const runtime = mkdtempSync(join(tmpdir(), "bunzai-runtime-"));
afterAll(() => rmSync(runtime, { recursive: true, force: true }));
const shipped = (arch: string): Buffer => readFileSync(join(import.meta.dir, "..", "node_modules", "webview-bun", "build", `libwebview-${arch}.so`));

test.if(process.platform === "linux")("on Linux it unpacks the library into the runtime folder once and names it in WEBVIEW_PATH, keeping the rest", async () => {
  const env = await webviewWorkerEnv({ XDG_RUNTIME_DIR: runtime, TMPDIR: "/no/such/dir", HOME: "/home/x" }, "linux", "x64");
  expect(env?.["HOME"]).toBe("/home/x");
  const path = env!["WEBVIEW_PATH"]!;
  expect(path.startsWith(runtime)).toBe(true);
  expect(readFileSync(path).equals(shipped("x64"))).toBe(true);
  const written = statSync(path).mtimeMs;
  expect((await webviewWorkerEnv({ XDG_RUNTIME_DIR: runtime }, "linux", "x64"))?.["WEBVIEW_PATH"]).toBe(path);
  expect(statSync(path).mtimeMs).toBe(written);
  expect(readdirSync(runtime).filter((f) => !f.endsWith(".so"))).toEqual([]);
});

test.if(process.platform === "linux")("an arm64 machine gets the arm64 library", async () => {
  const env = await webviewWorkerEnv({ XDG_RUNTIME_DIR: runtime }, "linux", "arm64");
  expect(readFileSync(env!["WEBVIEW_PATH"]!).equals(shipped("arm64"))).toBe(true);
});

test("keeps the default off Linux, without a runtime folder, or when WEBVIEW_PATH is already chosen", async () => {
  expect(await webviewWorkerEnv({ XDG_RUNTIME_DIR: runtime }, "win32")).toBeNull();
  expect(await webviewWorkerEnv({}, "linux")).toBeNull();
  expect(await webviewWorkerEnv({ XDG_RUNTIME_DIR: runtime, WEBVIEW_PATH: "/opt/lib.so" }, "linux")).toBeNull();
});

test.if(process.platform === "linux")("a runtime folder it cannot write to keeps the default instead of failing the launch", async () => {
  const locked = mkdtempSync(join(runtime, "locked-"));
  chmodSync(locked, 0o500);
  try {
    expect(await webviewWorkerEnv({ XDG_RUNTIME_DIR: locked }, "linux", "x64")).toBeNull();
  } finally {
    chmodSync(locked, 0o700);
  }
});

test.if(process.platform === "linux")("a modified cached native library is never handed to the window worker", async () => {
  const env = await webviewWorkerEnv({ XDG_RUNTIME_DIR: runtime }, "linux", "x64");
  const target = env!["WEBVIEW_PATH"]!;
  const altered = readFileSync(target);
  altered[0] = altered[0]! ^ 1;
  writeFileSync(target, altered);
  expect(await webviewWorkerEnv({ XDG_RUNTIME_DIR: runtime }, "linux", "x64")).toBeNull();
});

test.if(process.platform === "linux")("shared runtime folders and symlinked native libraries are refused", async () => {
  const shared = mkdtempSync(join(runtime, "shared-"));
  chmodSync(shared, 0o777);
  expect(await webviewWorkerEnv({ XDG_RUNTIME_DIR: shared }, "linux", "x64")).toBeNull();
  chmodSync(shared, 0o700);
  const privateDir = mkdtempSync(join(runtime, "private-"));
  const env = await webviewWorkerEnv({ XDG_RUNTIME_DIR: privateDir }, "linux", "x64");
  const target = env!["WEBVIEW_PATH"]!;
  const other = join(privateDir, "other.so");
  writeFileSync(other, shipped("x64"), { mode: 0o600 });
  unlinkSync(target);
  symlinkSync(other, target);
  expect(await webviewWorkerEnv({ XDG_RUNTIME_DIR: privateDir }, "linux", "x64")).toBeNull();
});

test.if(process.platform === "linux")("concurrent first launches publish whole private native libraries", async () => {
  const privateDir = mkdtempSync(join(runtime, "concurrent-"));
  const results = await Promise.all([webviewWorkerEnv({ XDG_RUNTIME_DIR: privateDir }, "linux", "x64"), webviewWorkerEnv({ XDG_RUNTIME_DIR: privateDir }, "linux", "x64")]);
  const target = results[0]!["WEBVIEW_PATH"]!;
  expect(results[1]?.["WEBVIEW_PATH"]).toBe(target);
  expect(readFileSync(target).equals(shipped("x64"))).toBe(true);
  expect(statSync(target).mode & 0o777).toBe(0o600);
  expect(readdirSync(privateDir)).toHaveLength(1);
});

test.if(process.platform === "linux")("cached libraries with broad permissions or hard links are refused", async () => {
  const privateDir = mkdtempSync(join(runtime, "permissions-"));
  const env = await webviewWorkerEnv({ XDG_RUNTIME_DIR: privateDir }, "linux", "x64");
  const target = env!["WEBVIEW_PATH"]!;
  chmodSync(target, 0o644);
  expect(await webviewWorkerEnv({ XDG_RUNTIME_DIR: privateDir }, "linux", "x64")).toBeNull();
  chmodSync(target, 0o600);
  linkSync(target, join(privateDir, "hardlink.so"));
  expect(await webviewWorkerEnv({ XDG_RUNTIME_DIR: privateDir }, "linux", "x64")).toBeNull();
});
