/**
 * The scene macro route (`GET /api/chats/macro-messages`) on the encrypted SQLite library: off-page
 * ordinals resolve through readMessagesAt, and a stale version or take is refused.
 */
import { afterEach, expect, test } from "bun:test";
import { chatRouteRig as rig, cleanupChatRouteRigs, vera } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";

afterEach(cleanupChatRouteRigs);

async function readyScene() {
  const r = await rig();
  await r.store.save(vera);
  await r.store.save({ schemaVersion: vera.schemaVersion, kind: "persona", id: "chi", body: { name: "Chi", content: "" } });
  await r.settings.update({ "persona.default": "chi" });
  const chat = (await (await r.post("/api/chats/start", { characterId: "vera" })).json()) as { id: string; activeBranchId: string };
  let version = (await (await r.handler(apiReq(`/api/chats/open?id=${chat.id}`))).json() as { branchVersion: number }).branchVersion;
  for (let i = 0; i < 4; i++) {
    const sent = (await (await r.post("/api/chats/send", { chatId: chat.id, content: `line ${i}`, greetingIndex: 0, expectedVersion: version })).json()) as { branchVersion: number };
    version = sent.branchVersion;
  }
  return { ...r, chatId: chat.id, branchId: chat.activeBranchId, version };
}

test("resolves off-page ordinals from the library, skipping ones past the end", async () => {
  const { handler, chatId, branchId, version } = await readyScene();
  const res = await handler(apiReq(`/api/chats/macro-messages?chatId=${chatId}&branchId=${branchId}&expectedVersion=${version}&indices=0,3,4,99`));
  expect(res.status).toBe(200);
  const page = (await res.json()) as { branchId: string; branchVersion: number; messages: { index: number; role: string; content: string }[] };
  expect(page.branchId).toBe(branchId);
  expect(page.branchVersion).toBe(version);
  expect(page.messages.map((m) => m.index)).toEqual([0, 3, 4]);
  expect(page.messages[0]!.role).toBe("assistant");
  expect(page.messages.slice(1).map((m) => m.content)).toEqual(["line 2", "line 3"]);
});

test("a stale version is refused rather than answered", async () => {
  const { handler, chatId, branchId, version } = await readyScene();
  const res = await handler(apiReq(`/api/chats/macro-messages?chatId=${chatId}&branchId=${branchId}&expectedVersion=${version - 1}&indices=0`));
  expect(res.status).toBe(409);
});
