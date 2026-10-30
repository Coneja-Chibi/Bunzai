/**
 * Test probe for src/desktop-env.ts. Optionally detaches `environ`, then does what libgtk-4 does as
 * it loads (unsetenv the launcher variables, or `--gtk`: really load libgtk-4), then starts a Worker.
 * Prints "worker ok" when the Worker ran; Bun 1.3 segfaults instead when nothing was detached.
 * `--has-gtk` only answers whether libgtk-4 loads, in this throwaway process rather than the caller's.
 */
import { dlopen, FFIType, ptr } from "bun:ffi";
import { detachEnvironFromGtk, GTK_UNSET_VARS } from "../src/desktop-env";

if (!Bun.isMainThread) {
  postMessage("worker ok");
} else if (process.argv.includes("--has-gtk")) {
  try {
    dlopen("libgtk-4.so.1", { gtk_get_major_version: { args: [], returns: FFIType.u32 } });
    console.log("gtk");
  } catch {
    console.log("no gtk");
  }
} else {
  if (process.argv.includes("--detach")) detachEnvironFromGtk();
  if (process.argv.includes("--gtk")) {
    dlopen("libgtk-4.so.1", { gtk_get_major_version: { args: [], returns: FFIType.u32 } });
  } else {
    const libc = dlopen("libc.so.6", { unsetenv: { args: [FFIType.ptr], returns: FFIType.i32 } });
    for (const name of GTK_UNSET_VARS) libc.symbols.unsetenv(ptr(new TextEncoder().encode(`${name}\0`)));
  }
  const worker = new Worker(import.meta.path);
  worker.onmessage = (event) => { console.log(event.data); process.exit(0); };
}
