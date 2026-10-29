/** Desktop port parsing and explicit-claim isolation at the claim boundary. */
import { describe, expect, test } from "bun:test";
import { claimDesktopPort, desktopPortOverride } from "./desktop-port";

describe("desktop port override", () => {
  test("accepts only bounded, unsigned decimal ports and leaves absence on default policy", () => {
    expect(desktopPortOverride(undefined)).toBeNull();
    expect(desktopPortOverride("8351")).toBe(8351);
    for (const invalid of ["", " 8351", "8351 ", "+8351", "-1", "8351x", "0", "1023", "65536", "８３５１"]) {
      expect(() => desktopPortOverride(invalid)).toThrow("BUNZAI_PORT");
    }
  });

  test("an override refuses an existing Bunzai and never starts or attaches to it", async () => {
    let started = false;
    const claim = claimDesktopPort(8351, () => {
      started = true;
      return { url: "http://127.0.0.1:8351", stop() {} };
    }, async () => "http://127.0.0.1:8351");
    const error = await claim.then(() => null, (cause: Error) => cause);
    expect(error?.message).toContain("already running");
    expect(started).toBe(false);
  });

  test("an explicit occupied-port bind fails without probing or trying another port", async () => {
    const attempted: number[] = [];
    const claim = claimDesktopPort(8351, (port) => {
      attempted.push(port);
      throw new Error("address already in use");
    }, async () => null);
    const error = await claim.then(() => null, (cause: Error) => cause);
    expect(error?.message).toContain("address already in use");
    expect(attempted).toEqual([8351]);
  });

  test("an override stops a server whose reported URL does not match the requested port", async () => {
    let stopped = false;
    const claim = claimDesktopPort(8351, () => ({ url: "http://127.0.0.1:8352", stop: () => { stopped = true; } }), async () => null);
    const error = await claim.then(() => null, (cause: Error) => cause);
    expect(error?.message).toContain("did not claim requested port 8351");
    expect(stopped).toBe(true);
  });

  test("default mode retains the first-free port search and existing-instance reuse", async () => {
    const attempted: number[] = [];
    const result = await claimDesktopPort(null, (port) => {
      attempted.push(port);
      if (port === 8321) throw new Error("held");
      return { url: `http://127.0.0.1:${port}`, stop() {} };
    }, async () => null);
    expect(attempted).toEqual([8321, 8322]);
    expect(result).toMatchObject({ ours: true, server: { url: "http://127.0.0.1:8322" } });
  });

  test("default mode reuses a detected Bunzai after its bind fails", async () => {
    const attempted: number[] = [];
    const result = await claimDesktopPort(null, (port) => {
      attempted.push(port);
      throw new Error("held");
    }, async (port) => port === 8321 ? "http://127.0.0.1:8321" : null);
    expect(attempted).toEqual([8321]);
    expect(result).toMatchObject({ ours: false, server: { url: "http://127.0.0.1:8321" } });
  });
});
