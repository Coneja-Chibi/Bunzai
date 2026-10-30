/**
 * Linux: keep GTK's unsetenv calls away from the environment Bun reads whenever it starts a Worker.
 *
 * Bun 1.3 keeps a fixed-length view of libc's ORIGINAL `environ` array and walks it each time a Worker
 * starts (Transpiler.runEnvLoader). Loading libgtk-4 (the window worker's webview-bun import) unsets
 * DESKTOP_STARTUP_ID, XDG_ACTIVATION_TOKEN and DESKTOP_AUTOSTART_ID, which launchers and session
 * autostart set; unsetenv shifts that array in place, and the next Worker reads past its new end and
 * segfaults at 0x0. The stage's background lane starts one about thirty seconds in, so a Bunzai
 * opened from the menu died half a minute later, whatever the person was doing.
 *
 * The cure is one new variable added through libc on the main thread before the window worker
 * starts: glibc then moves `environ` to a heap copy, every later unsetenv shifts only that copy, and
 * the original array Bun reads stays whole. No restart, whatever names GTK unsets, and GTK still
 * receives the launcher's token, so focus and startup notification keep working. The name must be
 * NEW: setenv on a name already present replaces it in place and `environ` never moves, so the name
 * carries the pid and is checked against the environment first.
 */
import { dlopen, FFIType, ptr } from "bun:ffi";

/** What libgtk-4 unsets as it loads (launcher and session-autostart tokens). */
export const GTK_UNSET_VARS: readonly string[] = ["XDG_ACTIVATION_TOKEN", "DESKTOP_STARTUP_ID", "DESKTOP_AUTOSTART_ID"];

/** A variable name not yet in this environment; adding it is what moves `environ`. */
export function detachVarName(env: Readonly<Record<string, string | undefined>>, pid: number): string {
  let name = `BUNZAI_ENVIRON_DETACHED_${pid}`;
  while (env[name] !== undefined) name += "_";
  return name;
}

const cString = (text: string): Uint8Array => new TextEncoder().encode(`${text}\0`);

/** Call first thing in a desktop entry, before the window worker starts. True when `environ` moved. */
export function detachEnvironFromGtk(platform: NodeJS.Platform = process.platform): boolean {
  if (platform !== "linux") return false;
  try {
    const libc = dlopen("libc.so.6", { setenv: { args: [FFIType.ptr, FFIType.ptr, FFIType.i32], returns: FFIType.i32 } });
    // Both buffers held in locals for the call: a bare ptr(cString(...)) could be collected first.
    const name = cString(detachVarName(process.env, process.pid));
    const value = cString("1");
    return libc.symbols.setenv(ptr(name), ptr(value), 1) === 0;
  } catch {
    return false;
  }
}
