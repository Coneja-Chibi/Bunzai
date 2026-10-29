/** HTTP-boundary regression: opening several pieces of an encrypted library at once must not trip the cold-read budget. */
import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { fakeComputer } from "../stage/crypto/fake-device-vault";
import { SettingsStore } from "../studio/settings";
import { StudioStore } from "../studio/store";
import { createLibrary } from "./library-root";
import { createHandler } from "./server";
import { apiReq, filledSec } from "./server-test-rig";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

test("three pieces opened at the same moment (the one running plus the two the lane lets wait) all load; none is refused as reserved by other work", async () => {
  const root = await mkdtemp(join(tmpdir(), "bunzai-concurrent-get-"));
  roots.push(root);
  const library = createLibrary(root, { vault: fakeComputer(), sessionsDir: join(root, "sessions") });
  await library.open();
  const store = new StudioStore(root);
  const security = filledSec();
  const handler = createHandler(store, new SettingsStore(root), undefined, security, undefined, undefined, undefined, undefined, undefined, undefined, undefined, library);
  const pieces = [
    { kind: "persona", id: "p", body: { name: "P", content: "" } },
    { kind: "pack", id: "k", body: { name: "K", pack: { items: [], enabled: true } } },
    { kind: "htmldoc", id: "h", body: { name: "H", html: "<b>x</b>" } },
  ];
  for (const piece of pieces) await store.save({ schemaVersion: CANONICAL_SCHEMA_VERSION, ...piece } as never);
  const statuses = await Promise.all(pieces.map(async (piece) => {
    const response = await handler(apiReq(`/api/studio/get?kind=${piece.kind}&id=${piece.id}&revision=1`, { token: security.token }));
    return { id: piece.id, status: response.status, body: response.status === 200 ? "" : await response.text() };
  }));
  library.close();
  expect(statuses.filter((s) => s.status !== 200)).toEqual([]);
});

test("five at once: the overflow is a retryable 503 with a code and Retry-After, never a 500", async () => {
  const root = await mkdtemp(join(tmpdir(), "bunzai-concurrent-get-"));
  roots.push(root);
  const library = createLibrary(root, { vault: fakeComputer(), sessionsDir: join(root, "sessions") });
  await library.open();
  const store = new StudioStore(root);
  const security = filledSec();
  const handler = createHandler(store, new SettingsStore(root), undefined, security, undefined, undefined, undefined, undefined, undefined, undefined, undefined, library);
  const ids = ["a", "b", "c", "d", "e"];
  for (const id of ids) await store.save({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "persona", id, body: { name: id, content: "" } } as never);
  const responses = await Promise.all(ids.map((id) => handler(apiReq(`/api/studio/get?kind=persona&id=${id}&revision=1`, { token: security.token }))));
  library.close();
  expect(responses.map((r) => r.status).filter((s) => s !== 200 && s !== 503)).toEqual([]);
  const refused = responses.filter((r) => r.status === 503);
  expect(refused.length).toBeGreaterThan(0);
  for (const r of refused) {
    expect(r.headers.get("retry-after")).toBe("1");
    expect(((await r.json()) as { code: string }).code).toBe("studio_busy");
  }
});
