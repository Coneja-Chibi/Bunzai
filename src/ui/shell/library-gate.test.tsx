/**
 * The library gate (library-gate.tsx): the Studio shows only when the library is readable, and the
 * stage door offers the right way in for the library it faces.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ApiHttpError, LIBRARY_LOCKED_EVENT } from "../_shared/api-fetch";
import { attachArtCacheLockListener, createArtCache } from "../_shared/art-cache";
import { entersLocked, gateScreen, StageDoor, statusOnError, type GateScreen, type Status } from "./library-gate";

const fresh = { loadInSeen: false };

describe("entersLocked: the idle-lock poll's own moment of discovery", () => {
  test("unlocked -> locked (the idle-lock poll catching up) is a lock", () => {
    expect(entersLocked({ phase: "unlocked" }, { phase: "locked" })).toBe(true);
  });
  test("a lock from elsewhere, discovered on the very first read, is still a lock", () => {
    expect(entersLocked(null, { phase: "locked" })).toBe(true);
  });
  test("already locked, checked again, is not a NEW lock (no repeat dispatch)", () => {
    expect(entersLocked({ phase: "locked" }, { phase: "locked" })).toBe(false);
  });
  test("unlocking, opening, and failing are none of them a lock", () => {
    expect(entersLocked({ phase: "locked" }, { phase: "unlocked" })).toBe(false);
    expect(entersLocked({ phase: "unlocked" }, { phase: "opening" })).toBe(false);
    expect(entersLocked({ phase: "unlocked" }, { phase: "failed", reason: "boom" })).toBe(false);
  });
});

/** A bare EventTarget-shaped stand-in for `window`, so this proof needs no DOM (this file renders
 * with `renderToStaticMarkup` and sets up no JSDOM elsewhere). */
function fakeWindow(): { addEventListener: typeof window.addEventListener; removeEventListener: typeof window.removeEventListener; dispatch(type: string): void } {
  const listeners = new Map<string, Set<() => void>>();
  return {
    addEventListener: ((type: string, fn: () => void) => {
      const set = listeners.get(type) ?? new Set();
      set.add(fn);
      listeners.set(type, set);
    }) as typeof window.addEventListener,
    removeEventListener: ((type: string, fn: () => void) => { listeners.get(type)?.delete(fn); }) as typeof window.removeEventListener,
    dispatch: (type) => { for (const fn of listeners.get(type) ?? []) fn(); },
  };
}

describe("an idle lock clears and revokes the art cache", () => {
  test("the same LIBRARY_LOCKED_EVENT the gate raises on entersLocked reaches a listening cache", async () => {
    // This proves the OTHER half of the wire: LibraryGate's check() calls
    // `target.dispatchEvent(new Event(LIBRARY_LOCKED_EVENT))` exactly when entersLocked is true
    // (a real DOM mount of LibraryGate itself, with a fake EventSource and a fake fetch, is
    // library-gate-mount.test.tsx); this proves that when that exact event fires, a cache attached
    // the way the app attaches one (attachArtCacheLockListener) really does clear and revoke - the
    // same event, the same listener, the two halves of one path.
    const revoked: string[] = [];
    const cache = createArtCache({}, {
      fetchBlob: async () => ({ size: 5 }) as unknown as Blob,
      createUrl: () => "obj:0",
      revokeUrl: (u) => { revoked.push(u); },
    });
    await cache.get("a"); // populate it, standing in for art a scene or card already decrypted

    const win = fakeWindow();
    attachArtCacheLockListener(win as unknown as typeof window, cache);

    // The idle-lock poll's own transition, exactly what check() computes on its next tick.
    expect(entersLocked({ phase: "unlocked" }, { phase: "locked" })).toBe(true);
    win.dispatch(LIBRARY_LOCKED_EVENT);
    await Promise.resolve();
    await Promise.resolve();

    expect(revoked).toEqual(["obj:0"]);
    const p = cache.get("a"); // cleared: this is a fresh fetch, not the old cached row
    await p.catch(() => undefined);
  });
});

test("the Studio shows only when the library is readable", () => {
  const cases: [Status, GateScreen][] = [
    [{ phase: "opening" }, "load-in"],
    [{ phase: "loading-in", done: 3, total: 9, recent: [] }, "load-in"],
    [{ phase: "locked" }, "stage-door"],
    [{ phase: "failed", reason: "boom" }, "failed"],
    [{ phase: "failed", reason: "not enough free space", noRoom: true }, "no-room"],
    [{ phase: "unlocked" }, "studio"],
    [{ phase: "unlocked", copied: { files: 4, renamed: [], leftInFolder: 0 } }, "all-aboard"],
  ];
  for (const [status, screen] of cases) expect([status.phase, gateScreen(status, fresh)]).toEqual([status.phase, screen]);
});

test("the load-in note shows once, then the Studio; nothing else is ever waved through", () => {
  const seen = { loadInSeen: true };
  expect(gateScreen({ phase: "unlocked", copied: { files: 4, renamed: [], leftInFolder: 0 } }, seen)).toBe("studio");
  // The app never runs on the plain folder: a library that could not open stays shut.
  expect(gateScreen({ phase: "failed", reason: "not enough free space", noRoom: true }, seen)).toBe("no-room");
  // A locked library is never waved through by a note someone dismissed.
  expect(gateScreen({ phase: "locked" }, seen)).toBe("stage-door");
});

test("with a password the door asks for it, and offers the lines when they exist", () => {
  const html = renderToStaticMarkup(<StageDoor status={{ phase: "locked", hasPassword: true, hasWords: true }} />);
  expect(html).toContain("Welcome");
  expect(html).toContain('type="password"');
  expect(html).toContain("I forgot it: use my lines");
  expect(html).not.toContain("Remember this computer");
});

test("without a password (a new computer) the door asks for the lines and offers to remember it", () => {
  const html = renderToStaticMarkup(<StageDoor status={{ phase: "locked", hasPassword: false, hasWords: true }} />);
  expect(html).toContain("Recite your");
  expect(html).toContain('aria-label="Word 12"');
  expect(html).toContain("Remember this computer");
  expect(html).not.toContain('type="password"');
});

test("with no password and no lines, the door says plainly it cannot open here", () => {
  const html = renderToStaticMarkup(<StageDoor status={{ phase: "locked", hasPassword: false, hasWords: false }} />);
  expect(html).toContain("cannot be opened here");
  expect(html).not.toContain("<input");
});

test("a status check that fails shows the Studio only where the library's routes do not exist", () => {
  expect(statusOnError(new ApiHttpError(404, "not found"))).toEqual({ phase: "unlocked" });
  expect(statusOnError(new ApiHttpError(403, "forbidden: managed on the host device"))).toEqual({ phase: "unlocked" });
  // The server down or restarting is not a reason to show the Studio over a library that may be locked.
  expect(statusOnError(new ApiHttpError(500, "boom")).phase).toBe("failed");
  expect(statusOnError(new TypeError("Failed to fetch")).phase).toBe("failed");
});

test("the door's password field invites no password manager to keep it", () => {
  const html = renderToStaticMarkup(<StageDoor status={{ phase: "locked", hasPassword: true, hasWords: true }} />);
  expect(html).toContain('autoComplete="off"');
  expect(html).toContain('data-1p-ignore="true"');
  expect(html).toContain('data-lpignore="true"');
  expect(html).not.toContain("<form");
});
