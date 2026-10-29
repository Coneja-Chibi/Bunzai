/** The second-launch decision: bring the running window forward, or fall back to opening one. */
import { describe, expect, test } from "bun:test";
import { flashInfo, focusExisting, listenerPidFrom, type WindowApi } from "./desktop-focus";

/** A fake window API: `windows` maps "title|pid" to a handle; `appearsAfter` makes find fail that many times first. */
const rig = (windows: Record<string, number>, appearsAfter = 0) => {
  const calls: string[] = [];
  let misses = appearsAfter;
  const api: WindowApi = {
    find: (title, pid) => {
      calls.push(`find:${title}:${pid}`);
      if (misses-- > 0) return null;
      return windows[`${title}|${pid}`] ?? null;
    },
    raise: (handle) => void calls.push(`raise:${handle}`),
  };
  const deps = { api, listenerPid: (port: number) => (port === 8321 ? 700 : null), wait: async () => {} };
  return { deps, calls };
};

describe("listenerPidFrom", () => {
  // Real `netstat -ano -p TCP` rows: CRLF line ends, a client socket to the same port, another port.
  const netstat = [
    "  Proto  Local Address          Foreign Address        State           PID",
    "  TCP    127.0.0.1:8321         0.0.0.0:0              LISTENING       161204",
    "  TCP    127.0.0.1:52481        127.0.0.1:8321         ESTABLISHED     219424",
    "  TCP    127.0.0.1:8321         127.0.0.1:52481        ESTABLISHED     161204",
    "  TCP    0.0.0.0:8322           0.0.0.0:0              LISTENING       777",
    "  TCP    127.0.0.1:83210        0.0.0.0:0              LISTENING       888",
    "",
  ].join("\r\n");

  test("finds the process on the LISTENING row for exactly that loopback port", () => {
    expect(listenerPidFrom(netstat, 8321)).toBe(161204);
  });

  test("ignores client sockets, other ports, prefix matches and wildcard binds", () => {
    expect(listenerPidFrom(netstat, 8322)).toBeNull();
    expect(listenerPidFrom(netstat, 832)).toBeNull();
    expect(listenerPidFrom("", 8321)).toBeNull();
  });
});

describe("localized netstat", () => {
  const german = [
    "  Proto  Lokale Adresse         Remoteadresse          Status           PID",
    "  TCP    127.0.0.1:8321         0.0.0.0:0              ABHÖREN        161204",
    "  TCP    127.0.0.1:8321         127.0.0.1:52481        HERGESTELLT      161204",
  ].join("\r\n");

  test("a listener is recognised by its 0.0.0.0:0 foreign address, whatever the state word", () => {
    expect(listenerPidFrom(german, 8321)).toBe(161204);
    expect(listenerPidFrom(german.replace("ABHÖREN", "ПРОСЛУШИВАНИЕ"), 8321)).toBe(161204);
  });

  test("an established row is never a listener, in any language", () => {
    expect(listenerPidFrom(german.split("\r\n").filter((l) => !l.includes("0.0.0.0:0")).join("\r\n"), 8321)).toBeNull();
  });
});

describe("flashInfo", () => {
  test("lays out FLASHWINFO: size, handle, FLASHW_ALL | FLASHW_TIMERNOFG, no count, no timeout", () => {
    const b = flashInfo(0x1234n);
    expect(b.length).toBe(32);
    expect(b.readUInt32LE(0)).toBe(32);
    expect(b.readBigUInt64LE(8)).toBe(0x1234n);
    expect(b.readUInt32LE(16)).toBe(3 | 12);
    expect(b.readUInt32LE(20)).toBe(0);
    expect(b.readUInt32LE(24)).toBe(0);
  });
});

describe("focusExisting", () => {
  test("a second launch raises the window owned by the process listening on our port", async () => {
    const { deps, calls } = rig({ "Bunzai.|700": 42 });
    expect(await focusExisting(false, "Bunzai.", 8321, deps)).toBe(true);
    expect(calls).toEqual(["find:Bunzai.:700", "raise:42"]);
  });

  test("a decoy with the same title owned by another process is never raised", async () => {
    const { deps, calls } = rig({ "Bunzai.|999": 13 });
    expect(await focusExisting(false, "Bunzai.", 8321, deps)).toBe(false);
    expect(calls.some((c) => c.startsWith("raise"))).toBe(false);
  });

  test("another instance on another port is not ours to raise", async () => {
    const { deps } = rig({ "Bunzai.|700": 42 });
    expect(await focusExisting(false, "Bunzai.", 8322, deps)).toBe(false);
  });

  test("the first launch never loads the window API or touches a window", async () => {
    const { deps, calls } = rig({ "Bunzai.|700": 42 });
    expect(await focusExisting(true, "Bunzai.", 8321, deps)).toBe(false);
    expect(calls).toEqual([]);
  });

  test("a runner that bound its port but has not opened its window yet is waited for", async () => {
    const { deps, calls } = rig({ "Bunzai.|700": 42 }, 3);
    expect(await focusExisting(false, "Bunzai.", 8321, deps)).toBe(true);
    expect(calls.filter((c) => c.startsWith("find")).length).toBe(4);
  });

  test("a runner whose window never opens leaves the caller to open one, after a bounded wait", async () => {
    const { deps, calls } = rig({});
    expect(await focusExisting(false, "Bunzai.", 8321, deps)).toBe(false);
    expect(calls.filter((c) => c.startsWith("find")).length).toBeLessThan(100);
  });

  test("with no window API on this platform the caller keeps today's behavior", async () => {
    expect(await focusExisting(false, "Bunzai.", 8321, { api: null })).toBe(false);
  });
});
