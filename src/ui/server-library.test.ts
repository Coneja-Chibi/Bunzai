/**
 * The library's routes (server-library.ts) over a real library in a throwaway folder: the status the
 * stage door reads, the whole words-then-password-then-lock-then-unlock journey, a wrong password
 * that never echoes the secret into a response or a log, the remote and LAN surfaces refused, and
 * the idle lock fed by real API activity but not by status polling.
 */
import { afterEach, expect, spyOn, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakeComputer } from "../stage/crypto/fake-device-vault";
import { fastPasswords } from "../stage/crypto/fake-password-lock";
import { SettingsStore } from "../studio/settings";
import { StudioStore } from "../studio/store";
import { createLibrary, type LibraryHandle } from "./library-root";
import { createHandler } from "./server";
import { apiReq, filledSec } from "./server-test-rig";
import { removeTempDir } from "../studio/test-temp-dir";

const handles: LibraryHandle[] = [];
const dirs: string[] = [];
afterEach(async () => {
  for (const h of handles.splice(0)) h.close();
  await Promise.all(dirs.splice(0).map(removeTempDir));
});

const PASSWORD = "moonlit harbor lantern";

async function rig(opts: { timer?: () => number; idleCheckMs?: number; dir?: string; vault?: ReturnType<typeof fakeComputer> } = {}) {
  const dir = opts.dir ?? join(mkdtempSync(join(tmpdir(), "bunraku-server-library-")), "Bunraku Studio");
  if (!opts.dir) dirs.push(join(dir, ".."));
  const vault = opts.vault ?? fakeComputer();
  const library = createLibrary(dir, {
    vault,
    sessionsDir: join(dir, "..", "sessions"),
    ...(opts.idleCheckMs ? { idleCheckMs: opts.idleCheckMs } : {}),
    keyring: { passwords: fastPasswords(), ...(opts.timer ? { timer: opts.timer } : {}) },
  });
  handles.push(library);
  await library.open();
  const sec = filledSec();
  const handler = createHandler(new StudioStore(dir), new SettingsStore(dir), undefined, sec, undefined, undefined, undefined, undefined, undefined, undefined, undefined, library);
  const get = (p: string) => handler(apiReq(p));
  const post = (p: string, body: unknown = {}) =>
    handler(apiReq(p, { method: "POST", token: sec.token, contentType: "application/json", body: JSON.stringify(body) }));
  return { dir, vault, library, handler, sec, get, post };
}

/** Words, then a password: the order the keyring requires (words first). */
async function withPassword(r: Awaited<ReturnType<typeof rig>>, lockPolicy: unknown = { mode: "each-open" }) {
  const begun = (await (await r.post("/api/library/words/begin")).json()) as { words: string[] };
  expect(begun.words).toHaveLength(12);
  expect((await r.post("/api/library/words/confirm", { words: begun.words.join(" ") })).status).toBe(200);
  expect((await r.post("/api/library/password", { password: PASSWORD, lockPolicy })).status).toBe(200);
  return begun.words;
}

test("the status says where the library is, and never carries a secret", async () => {
  const r = await rig();
  const status = (await (await r.get("/api/library/status")).json()) as Record<string, unknown>;
  expect(status).toMatchObject({ phase: "unlocked", hasPassword: false, hasWords: false, cleanupPending: null, lockPolicy: null, copied: null });
  expect(status).not.toHaveProperty("words");
});

test("the plain status the gate polls never carries deviceLock; the detail status Security reads does", async () => {
  const r = await rig();
  const plain = (await (await r.get("/api/library/status")).json()) as Record<string, unknown>;
  expect(plain).not.toHaveProperty("deviceLock");

  const detail = (await (await r.get("/api/library/status?detail=1")).json()) as Record<string, unknown>;
  expect(detail).toHaveProperty("deviceLock");
  expect(detail["deviceLock"]).toMatchObject({ lock: "dpapi", weak: false, strongerAvailable: false });

  // The rest of the shape is unchanged by the query param.
  expect(detail).toMatchObject({ phase: "unlocked", hasPassword: false, hasWords: false });
});

test("a locked or not-yet-open library never carries deviceLock, detail or not", async () => {
  const r = await rig();
  await withPassword(r);
  await r.post("/api/library/lock");
  const locked = (await (await r.get("/api/library/status?detail=1")).json()) as Record<string, unknown>;
  expect(locked).toMatchObject({ phase: "locked" });
  expect(locked).not.toHaveProperty("deviceLock");
});

test("words, a password, locking, a wrong password, and unlocking again", async () => {
  const r = await rig();
  const words = await withPassword(r);
  expect(await (await r.get("/api/library/status")).json()).toMatchObject({ hasPassword: true, hasWords: true, lockPolicy: { mode: "each-open" } });

  expect((await r.post("/api/library/lock")).status).toBe(200);
  expect(await (await r.get("/api/library/status")).json()).toMatchObject({ phase: "locked", hasPassword: true });
  expect((await r.get("/api/studio/list")).status).toBe(423);

  const logged: string[] = [];
  const spies = (["log", "warn", "error"] as const).map((k) => spyOn(console, k).mockImplementation((...a: unknown[]) => void logged.push(a.map(String).join(" "))));
  const wrong = await r.post("/api/library/unlock", { password: "moonlit harbour lantern" });
  for (const s of spies) s.mockRestore();
  expect(wrong.status).toBe(401);
  const wrongText = await wrong.text();
  expect(wrongText).not.toContain("harbour");
  expect(logged.join("\n")).not.toContain("harbour");

  expect((await r.post("/api/library/unlock", { password: PASSWORD })).status).toBe(200);
  expect((await r.get("/api/studio/list")).status).toBe(200);

  // The words open it too, after locking again.
  await r.post("/api/library/lock");
  expect((await r.post("/api/library/unlock", { words: words.join(" ") })).status).toBe(200);
  expect(await (await r.get("/api/library/status")).json()).toMatchObject({ phase: "unlocked" });
});

test("changing a secret without a fresh proof is refused and says a proof is needed", async () => {
  let now = 0;
  const r = await rig({ timer: () => now });
  await withPassword(r);
  now += 10 * 60_000; // past the five-minute proof window
  const refused = await r.post("/api/library/password/remove");
  expect(refused.status).toBe(428);
  expect(await refused.json()).toMatchObject({ proof: true });
  expect((await r.post("/api/library/prove", { password: PASSWORD })).status).toBe(200);
  expect((await r.post("/api/library/password/remove")).status).toBe(200);
});

test("a bad request is refused plainly, and actions need the session token", async () => {
  const r = await rig();
  expect((await r.post("/api/library/password", { password: PASSWORD })).status).toBe(400);
  expect((await r.post("/api/library/unlock", {})).status).toBe(400);
  const noToken = await r.handler(apiReq("/api/library/lock", { method: "POST", contentType: "application/json", body: "{}" }));
  expect(noToken.status).toBe(403);
  expect(await (await r.get("/api/library/status")).json()).toMatchObject({ phase: "unlocked" });
});

test("a LAN or remote device can never reach the library's controls", async () => {
  const r = await rig();
  const lan = createHandler(new StudioStore(r.dir), new SettingsStore(r.dir), undefined, r.sec, undefined, undefined, undefined, undefined, true, undefined, undefined, r.library);
  const res = await lan(apiReq("/api/library/status"));
  expect(res.status).toBe(403);
  const unowned = createHandler(new StudioStore(r.dir), new SettingsStore(r.dir), undefined, r.sec);
  expect((await unowned(apiReq("/api/library/status"))).status).toBe(404);
});

test("the idle lock counts real API activity, but not status polling", async () => {
  let now = 0;
  const r = await rig({ timer: () => now, idleCheckMs: 5 });
  await withPassword(r, { mode: "idle", idleMinutes: 1 });

  now += 50_000;
  await r.get("/api/studio/list"); // activity
  now += 50_000;
  await Bun.sleep(30);
  expect(await (await r.get("/api/library/status")).json()).toMatchObject({ phase: "unlocked" });

  now += 20_000; // 70 s since the last real activity; the status polls above do not count
  await Bun.sleep(30);
  expect(await (await r.get("/api/library/status")).json()).toMatchObject({ phase: "locked" });
});

test("requests the gate refuses, and status polls, never keep an idle library unlocked", async () => {
  let now = 0;
  const r = await rig({ timer: () => now, idleCheckMs: 5 });
  await withPassword(r, { mode: "idle", idleMinutes: 1 });
  now += 50_000;
  expect((await r.handler(apiReq("/api/studio/list", { fetchSite: "cross-site" }))).status).toBe(403);
  expect((await r.handler(apiReq("/api/studio/list", { host: "evil.example" }))).status).toBe(403);
  await r.get("/api/remote/status");
  await r.get("/api/library/status");
  now += 20_000; // 70 s since the last real activity
  await Bun.sleep(30);
  expect(await (await r.get("/api/library/status")).json()).toMatchObject({ phase: "locked" });
});

test("mistakes get a plain answer, not a server error", async () => {
  const r = await rig();
  const early = await r.post("/api/library/password", { password: PASSWORD, lockPolicy: { mode: "each-open" } });
  expect(early.status).toBe(409);
  expect(await early.json()).toEqual({ error: "make recovery words first, so a forgotten password can never lose the library" });
  expect((await r.post("/api/library/password", { password: PASSWORD, lockPolicy: { mode: "idle", idleMinutes: 0 } })).status).toBe(400);
  expect((await r.post("/api/library/computers/forget", { id: "no-such-computer" })).status).toBe(409);
});

test("remote access may resume the moment the library is unlocked, not on the next idle tick", async () => {
  const first = await rig();
  await withPassword(first);
  first.library.close();
  const r = await rig({ dir: first.dir, vault: first.vault });
  expect(await (await r.get("/api/library/status")).json()).toMatchObject({ phase: "locked" });
  let resolved = false;
  void r.library.unlocked().then(() => (resolved = true));
  expect((await r.post("/api/library/unlock", { password: PASSWORD })).status).toBe(200);
  await Bun.sleep(10);
  expect(resolved).toBe(true);
});

/**
 * The end-to-end proof for the scale design's lock/unlock push: server.ts threads
 * `library` into handleAgentRoutes into studioEvents, and the explicit lock route has to announce
 * itself (LibraryHandle.noticeLocked) since it is the one lock path createLibrary does not itself
 * call. A unit test that calls `library.noticeLocked()` by hand proves the API, not this wiring.
 */
test("POST /api/library/lock pushes a lock frame over the studio-events stream", async () => {
  const r = await rig();
  await withPassword(r, { mode: "each-open" });

  const events = await r.handler(apiReq("/api/agent/events"));
  expect(events.status).toBe(200);
  const reader = events.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const readEvent = async (): Promise<string> => {
    while (!buf.includes("\n\n")) {
      const { value, done } = await reader.read();
      if (done) throw new Error("stream closed before an event arrived");
      buf += decoder.decode(value, { stream: true });
    }
    const at = buf.indexOf("\n\n");
    const frame = buf.slice(0, at);
    buf = buf.slice(at + 2);
    return /^event: (.+)$/m.exec(frame)?.[1] ?? "";
  };
  expect(await readEvent()).toBe("ready");

  expect((await r.post("/api/library/lock")).status).toBe(200);
  expect(await readEvent()).toBe("lock");

  await reader.cancel();
});

test("a rehearsal with the right words records its date; wrong words change nothing", async () => {
  const r = await rig();
  const words = await withPassword(r);
  const before = (await (await r.get("/api/library/status")).json()) as { wordsWrittenAt: number; wordsRehearsedAt: number };
  expect(before.wordsRehearsedAt).toBe(before.wordsWrittenAt);
  expect((await r.post("/api/library/words/rehearse", { words: [...words].reverse().join(" ") })).status).toBe(401);
  await Bun.sleep(5);
  expect((await r.post("/api/library/words/rehearse", { words: words.join(" ") })).status).toBe(200);
  const after = (await (await r.get("/api/library/status")).json()) as { wordsRehearsedAt: number };
  expect(after.wordsRehearsedAt).toBeGreaterThan(before.wordsRehearsedAt);
});

test("an owed cleanup can be retried on demand, and reports when there is none", async () => {
  const r = await rig();
  expect(await (await r.post("/api/library/cleanup/retry")).json()).toEqual({ ok: true, cleanup: "done" });
});
