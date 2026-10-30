/** Unauthenticated LAN requests are bounded and approval credentials require encrypted transport. */
import { expect, test } from "bun:test";
import { createLanHandler } from "./lan-server";
import { LanHost } from "./lan-host";

test("LAN login caps chunked JSON before verifying and issues only a Secure approval cookie", async () => {
  let verifications = 0;
  let served = 0;
  const host = new LanHost({ now: () => 1, hash: async (s) => s, verify: async (s, hash) => { verifications++; return s === hash; } });
  const code = await host.reset();
  const handle = createLanHandler({ lanHost: host, appHandler: async () => { served++; return new Response("private"); } });
  const oversized = new Request("https://studio/lan/code", { method: "POST", headers: { "content-type": "application/json" }, body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(JSON.stringify({ code, extra: "x".repeat(2048) }))); c.close(); } }) });
  expect((await handle(oversized, "ip")).status).toBe(413);
  expect(verifications).toBe(0);
  const login = await handle(new Request("https://studio/lan/code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) }), "ip");
  expect(login.headers.get("set-cookie")).toContain("; Secure;");
  const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
  const id = cookie.slice(cookie.indexOf("=") + 1);
  await handle(new Request("https://studio/", { headers: { cookie } }), "ip");
  expect(served).toBe(0);
  host.approve(id);
  await handle(new Request("https://studio/", { headers: { cookie } }), "ip");
  expect(served).toBe(1);
});
