/**
 * The name the desktop window gives the Linux desktop. GTK reports the program name as the window's
 * Wayland app_id (and X11 WM_CLASS); webview never sets one, so every Bunzai window said "GTK
 * Application" and GNOME could not tie it to bunzai.desktop - the dock showed a generic icon beside
 * the launcher's. Naming the process "bunzai" through GLib before the window is built fixes that.
 * Best effort: without GLib there is no GTK window to name either.
 */
import { dlopen, FFIType, ptr } from "bun:ffi";

/** Matches the launcher file name, bunzai.desktop, which is what GNOME matches an app_id against. */
export const DESKTOP_APP_ID = "bunzai";

const NAME = new TextEncoder().encode(`${DESKTOP_APP_ID}\0`);

/** Name this process for the desktop; true when it was named. Call before the window is created. */
export function nameProcessForDesktop(platform: NodeJS.Platform = process.platform): boolean {
  if (platform !== "linux") return false;
  try {
    const glib = dlopen("libglib-2.0.so.0", { g_set_prgname: { args: [FFIType.ptr], returns: FFIType.void } });
    glib.symbols.g_set_prgname(ptr(NAME));
    return true;
  } catch {
    return false;
  }
}
