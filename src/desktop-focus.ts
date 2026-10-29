/**
 * Second launch: bring the running Bunzai window forward instead of opening another onto the same
 * library (decision 9). The NEW process does the raising, because a process
 * the user just launched is allowed to take the foreground and the running one is not; and because it
 * holds no session token, nothing is added to the server for a local caller to hit.
 *
 * The window is only trusted when it belongs to the process LISTENING on our port: a title alone would
 * raise any look-alike window, or another Bunzai on another port. Windows only; any other platform,
 * or a runner whose window never appears, returns false and the caller opens a window as before.
 */
import { dlopen, ptr, type Pointer } from "bun:ffi";

/** The window operations the decision needs; faked in tests. */
export interface WindowApi {
  /** A top-level window with this exact title owned by process `pid`, or null. */
  find: (title: string, pid: number) => number | null;
  /** Restore it if minimized and take the foreground; if Windows refuses, flash it instead. */
  raise: (handle: number) => void;
}

export interface FocusDeps {
  api: WindowApi | null;
  /** The process listening on this loopback port, or null. */
  listenerPid: (port: number) => number | null;
  wait: (ms: number) => Promise<void>;
}

const SW_RESTORE = 9;
const FLASHW_ALL = 3;
const FLASHW_TIMERNOFG = 12;

/** A FLASHWINFO (x64, 32 bytes) that flashes caption and taskbar button until the window is foreground. */
export function flashInfo(hwnd: bigint): Buffer {
  const b = Buffer.alloc(32);
  b.writeUInt32LE(32, 0); // cbSize
  b.writeBigUInt64LE(hwnd, 8); // hwnd
  b.writeUInt32LE(FLASHW_ALL | FLASHW_TIMERNOFG, 16); // dwFlags; uCount and dwTimeout stay 0
  return b;
}
/** How long a runner that has bound its port but not yet opened its window is given to do so. */
const WINDOW_WAIT_MS = 5000;
const POLL_MS = 100;

function win32Api(): WindowApi | null {
  if (process.platform !== "win32") return null;
  const { symbols: u } = dlopen("user32.dll", {
    FindWindowExW: { args: ["ptr", "ptr", "ptr", "ptr"], returns: "ptr" },
    GetWindowThreadProcessId: { args: ["ptr", "ptr"], returns: "u32" },
    IsIconic: { args: ["ptr"], returns: "i32" },
    ShowWindow: { args: ["ptr", "i32"], returns: "i32" },
    SetForegroundWindow: { args: ["ptr"], returns: "i32" },
    FlashWindowEx: { args: ["ptr"], returns: "i32" },
  });
  return {
    find: (title, pid) => {
      // Held in a variable: a Buffer used only inside ptr() can be collected before the call reads it.
      const name = Buffer.from(`${title}\0`, "utf16le");
      const owner = new Uint32Array(1);
      let at: Pointer | null = null;
      for (;;) {
        at = u.FindWindowExW(null, at, null, ptr(name));
        if (!at) return null;
        u.GetWindowThreadProcessId(at, ptr(owner));
        if (owner[0] === pid) return at as unknown as number;
      }
    },
    raise: (h) => {
      const handle = h as unknown as Pointer;
      if (u.IsIconic(handle)) u.ShowWindow(handle, SW_RESTORE);
      if (u.SetForegroundWindow(handle) !== 0) return;
      const info = flashInfo(BigInt(h)); // held: see find()
      u.FlashWindowEx(ptr(info));
    },
  };
}

/**
 * The PID of the listener on 127.0.0.1:port in `netstat -ano -p TCP` output, or null. A listener is
 * recognised by its foreign address (0.0.0.0:0), not by the state word, which Windows localizes.
 */
export function listenerPidFrom(netstat: string, port: number): number | null {
  for (const line of netstat.split("\n")) {
    const [proto, local, foreign, , pid] = line.trim().split(/\s+/);
    if (proto === "TCP" && local === `127.0.0.1:${port}` && foreign === "0.0.0.0:0") return Number(pid) || null;
  }
  return null;
}

/** The PID listening on 127.0.0.1:port (no elevation, no native table walk). */
function netstatListenerPid(port: number): number | null {
  return listenerPidFrom(Bun.spawnSync(["netstat", "-ano", "-p", "TCP"], { windowsHide: true }).stdout.toString(), port);
}

const real: Omit<FocusDeps, "api"> = { listenerPid: netstatListenerPid, wait: (ms) => Bun.sleep(ms) };

/**
 * True when this is a second launch and the running window has been handled (raised, or flashed when
 * Windows would not let it jump the queue): the caller exits and opens nothing. user32 is loaded only
 * here, so a first launch never depends on it.
 */
export async function focusExisting(
  ours: boolean,
  title: string,
  port: number,
  deps: Partial<FocusDeps> = {},
): Promise<boolean> {
  if (ours) return false;
  const api = deps.api === undefined ? win32Api() : deps.api;
  if (!api) return false;
  const { listenerPid, wait } = { ...real, ...deps };
  const pid = listenerPid(port);
  if (pid === null) return false;
  for (let waited = 0; ; waited += POLL_MS) {
    const handle = api.find(title, pid);
    if (handle !== null) {
      api.raise(handle);
      return true;
    }
    if (waited >= WINDOW_WAIT_MS) return false;
    await wait(POLL_MS);
  }
}
