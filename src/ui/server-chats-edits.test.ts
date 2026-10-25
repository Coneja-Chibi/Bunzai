/**
 * Scene edits over HTTP: cutting and restoring messages (in place, and as a new take once the scene
 * moved on), takes (fork, switch, rename, delete, the original refused), moving a scene to the latest
 * card and back, the scene half of the Trash, stale writes answering 409, and a locked library 423.
 */
import { afterEach, expect, test } from "bun:test";
import { addLibrary, CLAIMED, libraryChatsFor } from "../studio/library-content";
import type { OpenScene } from "../studio/scenes";
import { chatRouteRig, cleanupChatRouteRigs, vera } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";

afterEach(cleanupChatRouteRigs);

/** A scene with the greeting and three sends: four messages on the original take. */
async function played() {
  const r = await chatRouteRig();
  await r.store.save(vera);
  const { id } = (await (await r.post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  let scene = (await (await r.handler(apiReq(`/api/chats/open?id=${id}`))).json()) as OpenScene;
  for (const content of ["one", "two", "three"]) {
    scene = (await (await r.post("/api/chats/send", { chatId: id, content, greetingIndex: 0, expectedVersion: scene.branchVersion })).json()) as OpenScene;
  }
  const act = async (path: string, body: Record<string, unknown>) => {
    const res = await r.post(path, { chatId: id, ...body });
    return { status: res.status, scene: (res.ok ? await res.json() : null) as OpenScene | null };
  };
  const shown = (s: OpenScene) => s.messages.map((m) => (m.cut ? `(${m.swipes[m.current]!.content})` : m.swipes[m.current]!.content));
  return { ...r, id, scene, act, shown };
}

test("a cut leaves a restore line, a stale cut is 409, and restoring puts it back", async () => {
  const { scene, act, shown } = await played();
  const two = scene.messages[2]!;
  expect((await act("/api/chats/cut", { messageId: two.id, scope: "one", expectedVersion: scene.branchVersion - 1 })).status).toBe(409);
  expect((await act("/api/chats/cut", { messageId: two.id, scope: "sideways", expectedVersion: scene.branchVersion })).status).toBe(400);
  const cut = (await act("/api/chats/cut", { messageId: two.id, scope: "one", expectedVersion: scene.branchVersion })).scene!;
  expect(shown(cut)).toEqual(["Hello {{user}}.", "one", "(two)", "three"]);
  const back = (await act("/api/chats/restore-cut", { cutId: cut.messages[2]!.cut!.id, expectedVersion: cut.branchVersion })).scene!;
  expect(shown(back)).toEqual(["Hello {{user}}.", "one", "two", "three"]);
});

test("a message or take from another scene is refused and changes nothing", async () => {
  const a = await played();
  const b = await a.post("/api/chats/start", { characterId: "vera" });
  const other = (await b.json()) as { id: string };
  const forked = (await a.act("/api/chats/fork", { messageId: a.scene.messages[1]!.id, expectedVersion: a.scene.branchVersion })).scene!;
  const take = forked.takes[1]!;
  expect((await a.post("/api/chats/rename-take", { chatId: other.id, branchId: take.id, name: "Stolen" })).status).toBe(404);
  expect((await a.post("/api/chats/delete-take", { chatId: other.id, branchId: take.id })).status).toBe(404);
  const opened = (await (await a.handler(apiReq(`/api/chats/open?id=${other.id}`))).json()) as OpenScene;
  expect((await a.post("/api/chats/cut", { chatId: other.id, messageId: a.scene.messages[1]!.id, scope: "one", expectedVersion: opened.branchVersion })).status).toBe(404);
  const again = (await a.act("/api/chats/take", { branchId: take.id })).scene!;
  expect(again.takes.map((t) => t.name)).toEqual(["main", "Take 2"]);
  expect(a.shown(again).every((t) => !t.startsWith("("))).toBe(true);
});

test("a 'from here' cut restored after a new send comes back as its own take", async () => {
  const { id, post, scene, act, shown } = await played();
  const cut = (await act("/api/chats/cut", { messageId: scene.messages[2]!.id, scope: "from", expectedVersion: scene.branchVersion })).scene!;
  expect(shown(cut)).toEqual(["Hello {{user}}.", "one", "(two)", "(three)"]);
  const sent = (await (await post("/api/chats/send", { chatId: id, content: "elsewhere", greetingIndex: 0, expectedVersion: cut.branchVersion })).json()) as OpenScene;
  const back = (await act("/api/chats/restore-cut", { cutId: cut.messages[2]!.cut!.id, expectedVersion: sent.branchVersion })).scene!;
  expect(shown(back)).toEqual(["Hello {{user}}.", "one", "two", "three"]);
  expect(back.takes.map((t) => t.name)).toEqual(["main", "Restored take"]);
  const original = (await act("/api/chats/take", { branchId: back.takes[0]!.id })).scene!;
  // The cut messages moved to the restored take; the original keeps what was sent instead.
  expect(shown(original)).toEqual(["Hello {{user}}.", "one", "elsewhere"]);
});

test("takes: fork names Take 2, switch, rename, delete to the Trash and back; the original cannot be deleted", async () => {
  const { handler, post, scene, act, shown } = await played();
  const forked = (await act("/api/chats/fork", { messageId: scene.messages[1]!.id, expectedVersion: scene.branchVersion })).scene!;
  expect(forked.takes.map((t) => t.name)).toEqual(["main", "Take 2"]);
  expect(forked.chat.activeBranchId).toBe(forked.takes[1]!.id);
  expect(shown(forked)).toEqual(["Hello {{user}}.", "one"]);
  const renamed = (await act("/api/chats/rename-take", { branchId: forked.takes[1]!.id, name: "The quiet version" })).scene!;
  expect(renamed.takes[1]!.name).toBe("The quiet version");
  expect((await act("/api/chats/delete-take", { branchId: forked.takes[0]!.id })).status).toBe(400);
  const after = (await act("/api/chats/delete-take", { branchId: forked.takes[1]!.id })).scene!;
  expect(after.takes.map((t) => t.name)).toEqual(["main"]);
  expect(shown(after)).toEqual(["Hello {{user}}.", "one", "two", "three"]);
  const trash = (await (await handler(apiReq("/api/chats/trash"))).json()) as { kind: string; name: string; of: string; messageCount: number }[];
  expect(trash).toEqual([expect.objectContaining({ kind: "take", name: "The quiet version", of: "Vera", messageCount: 2 })]);
  expect((await post("/api/chats/restore-take", { id: forked.takes[1]!.id })).status).toBe(200);
  expect((await post("/api/chats/restore-take", { id: forked.takes[1]!.id })).status).toBe(404);
});

test("a cut scene sits in the Trash with its count, and restores", async () => {
  const { id, handler, post } = await played();
  await post("/api/chats/delete", { id });
  const trash = (await (await handler(apiReq("/api/chats/trash"))).json()) as { kind: string; id: string; messageCount: number }[];
  expect(trash).toEqual([expect.objectContaining({ kind: "scene", id, messageCount: 4 })]);
  expect((await post("/api/chats/restore-scene", { id })).status).toBe(200);
  expect(((await (await handler(apiReq("/api/chats/list"))).json()) as unknown[]).length).toBe(1);
});

test("a newer card is offered, taken, and put back; messages never change", async () => {
  const { store, act, shown, scene } = await played();
  expect(scene.latestCardVersion).toBe(1);
  await store.save({ ...vera, body: { ...vera.body, identity: { name: "Vera Lune" } } }, { overwrite: true });
  const reopened = (await act("/api/chats/take", { branchId: scene.chat.activeBranchId })).scene!;
  expect(reopened.latestCardVersion).toBe(2);
  expect(reopened.chat.cast.character.version).toBe(1);
  const updated = (await act("/api/chats/update-card", {})).scene!;
  expect(updated.chat.cast.character).toMatchObject({ version: 2, name: "Vera Lune" });
  expect(updated.chat.previousCast!.character.version).toBe(1);
  expect(shown(updated)).toEqual(shown(scene));
  expect((await act("/api/chats/revert-card", {})).status).toBe(400);
  const back = (await act("/api/chats/revert-card", { fromVersion: 2 })).scene!;
  expect(back.chat.cast.character.version).toBe(1);
  // A second click (or a second window) names the version it saw, which is gone: refused, not flipped back.
  expect((await act("/api/chats/revert-card", { fromVersion: 2 })).status).toBe(409);
  await store.delete("character", "vera");
  const gone = (await act("/api/chats/take", { branchId: scene.chat.activeBranchId })).scene!;
  expect(gone.latestCardVersion).toBeNull();
  expect((await act("/api/chats/update-card", {})).status).toBe(404);
});

test("with the library locked, every new scene route answers 423", async () => {
  const { handler, post, store } = await chatRouteRig();
  const unclaim = addLibrary((root) => (root === store.studioPath() ? CLAIMED : null));
  try {
    expect((await handler(apiReq("/api/chats/trash"))).status).toBe(423);
    const b = { chatId: "x", messageId: "x", branchId: "x", cutId: "x", id: "x", scope: "one", name: "n", expectedVersion: 1, fromVersion: 1 };
    for (const path of ["cut", "restore-cut", "take", "fork", "rename-take", "delete-take", "update-card", "revert-card", "restore-scene", "restore-take"]) {
      expect((await post(`/api/chats/${path}`, b)).status).toBe(423);
    }
  } finally {
    unclaim();
  }
});

test("choosing another version of a message shows it, refuses a stale version, and never reaches another scene's message", async () => {
  const r = await played();
  const chats = libraryChatsFor(r.store.studioPath())!;
  const greeting = r.scene.messages[0]!;
  await chats.addSwipe(greeting.id, { content: "A second greeting." });
  const now = (await (await r.handler(apiReq(`/api/chats/open?id=${r.id}`))).json()) as OpenScene;
  expect((await r.post("/api/chats/select-swipe", { chatId: r.id, messageId: greeting.id, index: 0, expectedVersion: now.branchVersion - 1 })).status).toBe(409);
  const shown = (await (await r.post("/api/chats/select-swipe", { chatId: r.id, messageId: greeting.id, index: 0, expectedVersion: now.branchVersion })).json()) as OpenScene;
  expect(shown.messages[0]!.current).toBe(0);
  const other = (await (await r.post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  expect((await r.post("/api/chats/select-swipe", { chatId: other.id, messageId: greeting.id, index: 1, expectedVersion: 1 })).status).toBe(404);
});

test("a message's edit history is read from the current take at the version the page shows, and a restore through edit keeps the history", async () => {
  const r = await played();
  const one = r.scene.messages[1]!;
  const edit = async (content: string, expectedVersion: number) => (await r.post("/api/chats/edit", { messageId: one.id, swipeId: one.swipes[0]!.id, content, expectedVersion })).status;
  const openNow = async () => (await (await r.handler(apiReq(`/api/chats/open?id=${r.id}`))).json()) as OpenScene;
  const history = (messageId: string, index: number, version: number, chatId = r.id, branchId?: string) =>
    r.handler(apiReq(`/api/chats/swipe-history?${new URLSearchParams({ chatId, branchId: branchId ?? r.scene.chat.activeBranchId, messageId, index: String(index), expectedVersion: String(version) })}`));
  // Never edited: an empty list, with the swipe it belongs to.
  const fresh = await openNow();
  const none = (await (await history(one.id, 0, fresh.branchVersion)).json()) as { swipeId: string; texts: string[] };
  expect(none).toEqual({ swipeId: one.swipes[0]!.id, texts: [] });
  expect(await edit("one, better", fresh.branchVersion)).toBe(200);
  expect(await edit("one, best", (await openNow()).branchVersion)).toBe(200);
  const now = await openNow();
  expect(((await (await history(one.id, 0, now.branchVersion)).json()) as { texts: string[] }).texts).toEqual(["one", "one, better"]);
  // Restoring the older text is an ordinary edit: the text it replaces joins the history.
  expect(await edit("one", now.branchVersion)).toBe(200);
  const after = await openNow();
  expect(((await (await history(one.id, 0, after.branchVersion)).json()) as { texts: string[] }).texts).toEqual(["one", "one, better", "one, best"]);
  // Stale version, an index that is not there, another scene's message, and a missing field are all refused.
  expect((await history(one.id, 0, after.branchVersion - 1)).status).toBe(409);
  expect((await history(one.id, 5, after.branchVersion)).status).toBe(404);
  const other = (await (await r.post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  const otherScene = (await (await r.handler(apiReq(`/api/chats/open?id=${other.id}`))).json()) as OpenScene;
  expect((await history(one.id, 0, otherScene.branchVersion, other.id, otherScene.chat.activeBranchId)).status).toBe(409);
  expect((await r.handler(apiReq(`/api/chats/swipe-history?chatId=${r.id}`))).status).toBe(400);
});

test("the edited opening message is kept per greeting over HTTP, refused when blank, and the first send saves it", async () => {
  const r = await chatRouteRig();
  await r.store.save(vera);
  const { id } = (await (await r.post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  expect((await r.post("/api/chats/opening", { chatId: id, opening: { edits: [{ index: 0, text: "  " }] } })).status).toBe(400);
  const kept = (await (await r.post("/api/chats/opening", { chatId: id, opening: { edits: [{ index: 0, text: "  Mine.  " }] } })).json()) as OpenScene;
  expect(kept.chat.opening).toEqual({ edits: [{ index: 0, text: "Mine." }] });
  expect(((await (await r.handler(apiReq(`/api/chats/open?id=${id}`))).json()) as OpenScene).chat.opening).toEqual(kept.chat.opening!);
  const sent = (await (await r.post("/api/chats/send", { chatId: id, content: "hi", greetingIndex: 0, expectedVersion: 1 })).json()) as OpenScene;
  expect(sent.messages.map((m) => m.swipes[m.current]!.content)).toEqual(["Mine.", "hi"]);
});
