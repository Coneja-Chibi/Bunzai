/** The Linux app_id naming: only Linux is touched, and on Linux GLib takes the name. */
import { expect, test } from "bun:test";
import { dlopen, FFIType } from "bun:ffi";
import { DESKTOP_APP_ID, nameProcessForDesktop } from "./desktop-app-id";

test("nothing is named off Linux", () => {
  expect(nameProcessForDesktop("win32")).toBe(false);
  expect(nameProcessForDesktop("darwin")).toBe(false);
});

test.if(process.platform === "linux")("on Linux GLib takes the launcher's name", () => {
  expect(nameProcessForDesktop("linux")).toBe(true);
  const glib = dlopen("libglib-2.0.so.0", { g_get_prgname: { args: [], returns: FFIType.cstring } });
  expect(String(glib.symbols.g_get_prgname())).toBe(DESKTOP_APP_ID);
});
