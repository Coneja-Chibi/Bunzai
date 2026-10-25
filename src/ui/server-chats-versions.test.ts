/**
 * Removing one version of a reply over HTTP (ChatStore rule 32): cut it from the scene, find it in the
 * Trash, bring it back, and the refusals: a stale write is 409, the last version and a version of
 * another scene are refused and change nothing.
 */
import { afterEach, expect, test } from "bun:test";
import { libraryChatsFor } from "../studio/library-content";
import type { OpenScene, SceneGrave } from "../studio/scenes";
import { chatRouteRig, cleanupChatRouteRigs, vera } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";

afterEach(cleanupChatRouteRigs);

/** A scene whose greeting has three versions, the third showing, and a person's message after it. */
async function threeVersions() {
  const r = await chatRouteRig();
  await r.store.save(vera);
  const { id } = (await (await r.post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  const chats = libraryChatsFor(r.store.studioPath())!;
  const open = async (chatId = id) => (await (await r.handler(apiReq(`/api/chats/open?id=${chatId}`))).json()) as OpenScene;
  const first = await open();
  const sent = (await (await r.post("/api/chats/send", { chatId: id, content: "one", greetingIndex: 0, expectedVersion: first.branchVersion })).json()) as OpenScene;
  const greeting = sent.messages[0]!;
  await chats.addSwipe(greeting.id, { content: "Second hello." });
  const ids = (await chats.addSwipe(greeting.id, { content: "Third hello." }))!.swipes.map((s) => s.id);
  const act = async (path: string, body: Record<string, unknown>) => {
    const res = await r.post(path, { chatId: id, ...body });
    return { status: res.status, scene: (res.ok ? await res.json() : null) as OpenScene | null };
  };
  const trash = async () => (await (await r.handler(apiReq("/api/chats/trash"))).json()) as SceneGrave[];
  return { ...r, id, chats, open, act, trash, greeting, ids };
}
const counter = (s: OpenScene) => [s.messages[0]!.transcript!.currentIndex, s.messages[0]!.transcript!.swipeCount, s.messages[0]!.swipes[0]!.content];

test("a removed version leaves the counter and waits in the Trash; restoring puts it back and the shown version stays", async () => {
  const { act, open, trash, greeting, ids, post } = await threeVersions();
  const before = await open();
  expect(counter(before)).toEqual([2, 3, "Third hello."]);
  const cut = (await act("/api/chats/cut-version", { messageId: greeting.id, swipeId: ids[1]!, expectedVersion: before.branchVersion })).scene!;
  expect(counter(cut)).toEqual([1, 2, "Third hello."]);
  const [grave, ...rest] = await trash();
  expect(rest).toEqual([]);
  expect(grave).toMatchObject({ kind: "version", id: `${greeting.id}:${ids[1]}`, name: "Second hello.", of: "Vera", at: 1 });
  const back = (await (await post("/api/chats/restore-version", { id: grave!.id })).json()) as OpenScene;
  expect(counter(back)).toEqual([2, 3, "Third hello."]);
  expect(await trash()).toEqual([]);
  expect((await post("/api/chats/restore-version", { id: grave!.id })).status).toBe(404);
});

test("a stale cut is 409, the last version and a malformed restore are refused, and nothing changes", async () => {
  const { act, open, greeting, ids, post, trash } = await threeVersions();
  const before = await open();
  expect((await act("/api/chats/cut-version", { messageId: greeting.id, swipeId: ids[0]!, expectedVersion: before.branchVersion - 1 })).status).toBe(409);
  expect((await act("/api/chats/cut-version", { messageId: greeting.id, swipeId: ids[0]! })).status).toBe(400);
  const one = (await act("/api/chats/cut-version", { messageId: greeting.id, swipeId: ids[0]!, expectedVersion: before.branchVersion })).scene!;
  const two = (await act("/api/chats/cut-version", { messageId: greeting.id, swipeId: ids[1]!, expectedVersion: one.branchVersion })).scene!;
  expect(counter(two)).toEqual([0, 1, "Third hello."]);
  const refused = await act("/api/chats/cut-version", { messageId: greeting.id, swipeId: ids[2]!, expectedVersion: two.branchVersion });
  expect(refused.status).toBe(400);
  expect(counter(await open())).toEqual([0, 1, "Third hello."]);
  expect((await trash()).map((g) => g.kind)).toEqual(["version", "version"]);
  expect((await post("/api/chats/restore-version", { id: "nonsense" })).status).toBe(400);
});

test("a version of a message from another scene is refused and changes nothing", async () => {
  const a = await threeVersions();
  const other = (await (await a.post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  const opened = await a.open(other.id);
  const res = await a.post("/api/chats/cut-version", { chatId: other.id, messageId: a.greeting.id, swipeId: a.ids[1]!, expectedVersion: opened.branchVersion });
  expect(res.status).toBe(404);
  expect(counter(await a.open())).toEqual([2, 3, "Third hello."]);
  expect(await a.trash()).toEqual([]);
});
