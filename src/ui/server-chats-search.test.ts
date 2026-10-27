/**
 * In-scene search over HTTP (ChatStore rule 35; RoleCall's Ctrl+F): a POST with the scene and the words, the active take
 * searched newest first, each hit cut to a 50-character context, the refusals clear, and nothing changes in the scene.
 */
import { afterEach, expect, test } from "bun:test";
import { libraryChatsFor } from "../studio/library-content";
import type { SceneSearchResult } from "../studio/scene-search";
import type { OpenScene } from "../studio/scenes";
import { chatRouteRig, cleanupChatRouteRigs, vera } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";

afterEach(cleanupChatRouteRigs);

async function scene() {
  const r = await chatRouteRig();
  await r.store.save(vera);
  const { id } = (await (await r.post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  const chats = libraryChatsFor(r.store.studioPath())!;
  const opened = (await (await r.handler(apiReq(`/api/chats/open?id=${id}`))).json()) as OpenScene;
  const lines = [
    "The Crimson lantern swung over the harbor.",
    `${"x".repeat(90)} ember ${"y".repeat(90)}`,
    "<think>the lantern is a clue</think> She said nothing.",
    "A lantern, unlit.",
  ];
  const added = (await chats.appendMessages(opened.chat.activeBranchId, lines.map((content, i) => ({ role: i % 2 === 0 ? "user" as const : "assistant" as const, content }))))!;
  const search = async (query: unknown, chatId = id) => {
    const res = await r.post("/api/chats/search", { chatId, query });
    return { status: res.status, body: (res.ok ? await res.json() : await res.text()) as SceneSearchResult };
  };
  return { ...r, id, chats, added, branchId: opened.chat.activeBranchId, search };
}

test("finds the messages that hold every word, newest first, each with the live ordinal and a trimmed context", async () => {
  const { search, added } = await scene();
  const { status, body } = await search("lantern");
  expect(status).toBe(200);
  expect(body.hits.map((h) => h.messageId)).toEqual([added[3]!.id, added[2]!.id, added[0]!.id]);
  expect(body.hits.map((h) => h.index)).toEqual([3, 2, 0]);
  expect(body.truncated).toBe(false);
  expect(body.totalCount).toBe(4);
  const long = (await search("ember")).body.hits[0]!;
  expect(long.context.startsWith("...")).toBe(true);
  expect(long.context.endsWith("...")).toBe(true);
  expect(long.context.length).toBeLessThan(120);
  expect((await search("crimson harbor")).body.hits.map((h) => h.index)).toEqual([0]);
  expect((await search("harbor lantern ember")).body.hits).toEqual([]);
});

test("a match inside a think block is marked thinking, and a hidden message is found and says so", async () => {
  const { search, added, chats } = await scene();
  await chats.setHidden(added[3]!.id, true);
  const { body } = await search("lantern");
  expect(body.hits.find((h) => h.messageId === added[2]!.id)).toMatchObject({ thinking: true, hidden: false });
  expect(body.hits.find((h) => h.messageId === added[3]!.id)).toMatchObject({ thinking: false, hidden: true });
});

test("a cut message is not found, and searching changes nothing", async () => {
  const { search, added, chats, branchId, id } = await scene();
  await chats.cutMessages(branchId, added[0]!.id, "one");
  const before = await chats.listBranches(id);
  const { body } = await search("lantern");
  expect(body.hits.map((h) => h.messageId)).toEqual([added[3]!.id, added[2]!.id]);
  expect(body.hits.map((h) => h.index)).toEqual([2, 1]);
  expect(await chats.listBranches(id)).toEqual(before);
});

test("a query with no word of two characters finds nothing; a missing or non-text query and a gone scene are refused", async () => {
  const { search } = await scene();
  expect((await search("a")).body.hits).toEqual([]);
  expect((await search("   ")).body.hits).toEqual([]);
  expect((await search(7)).status).toBe(400);
  expect((await search("lantern", "no-such-scene")).status).toBe(404);
});

test("a pasted word past the store's length limit still answers instead of failing", async () => {
  const { search } = await scene();
  const { status, body } = await search(`lantern ${"x".repeat(201)}`);
  expect(status).toBe(200);
  expect(body.hits).toEqual([]);
});

test("a hit inside the scene preset's own reasoning markers reports as thinking", async () => {
  const { store, chats, branchId, post, id, search } = await scene();
  const prompt = (pid: string, content: string) => ({ id: pid, name: pid, content, role: "system", enabled: true, systemPrompt: true, marker: false, placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false });
  await store.save({ schemaVersion: vera.schemaVersion, kind: "preset", id: "quill", body: { name: "Quill", prompts: [prompt("main", "Write.")], samplers: {}, reasoning: { prefix: "[[", suffix: "]]", separator: "" } } });
  expect((await post("/api/chats/preset", { chatId: id, preset: { kind: "preset", id: "quill", toggles: {}, samplers: {} } })).status).toBe(200);
  await chats.appendMessages(branchId, [{ role: "assistant", content: "Out [[hidden zephyr]] in" }, { role: "assistant", content: "Out zephyr in" }]);
  const { body } = await search("zephyr");
  expect(body.hits.map((h) => h.thinking)).toEqual([false, true]);
});
