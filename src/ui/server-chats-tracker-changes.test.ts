/**
 * `GET /api/chats/tracker-changes` (the Messenger's change visuals): what each message of a range changed in the library trackers, read only. The route over the
 * memory store for the answers, and the real server for the wiring and its refusals.
 */
import { afterEach, expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { trackerSlot } from "../core/tracker";
import type { TrackerBody } from "../entities/tracker/schema";
import { memoryChatStore } from "../stage/store/chat-store";
import type { OpenScene } from "../studio/scenes";
import type { MessageTrackerChanges } from "../studio/tracker-changes";
import { chatRouteRig, cleanupChatRouteRigs } from "./fake-server-chats-rig";
import { handleTrackerChangesRoute } from "./server-chats-tracker-changes";
import { apiReq } from "./server-test-rig";

const health: TrackerBody = { name: "Health", description: "", layout: "record", note: "", changes: "toast", fields: [{ name: "hp", description: "", type: "number", default: 20, icon: "lucide:activity" }] };
const query = (params: Record<string, string>): URL => new URL(`http://local/api/chats/tracker-changes?${new URLSearchParams(params)}`);

async function rig() {
  const chats = memoryChatStore(() => 1_000);
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: { kind: "character", id: "vera", body: { identity: { name: "Vera" } } } } });
  const branch = chat.activeBranchId;
  const first = (await chats.appendMessage(branch, { role: "user", content: "hi" }))!;
  const open = await chats.beginTurn(branch, { kind: "reply" });
  await chats.saveCheckpoint(open!.id, { content: "t", deltas: [{ slot: trackerSlot("health", health), path: ["hp"], value: 7, at: 5 }] });
  const reply = (await chats.commitTurn(open!.id, { content: "t" }))!;
  return { chats, branch, first, reply, read: async (id: string) => (id === "health" ? health : null) };
}

test("a range answers each message's tracker changes, with the style and icons, and writes nothing", async () => {
  const { chats, branch, first, reply, read } = await rig();
  const res = await handleTrackerChangesRoute(query({ branchId: branch, from: first.id }), chats, read);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ messages: [{ messageId: reply.id, trackers: [{ trackerId: "health", name: "Health", style: "toast", fieldIcons: { hp: "lucide:activity" }, changes: [{ field: "hp", before: 20, after: 7 }] }] }] satisfies MessageTrackerChanges[] });
  const to = await handleTrackerChangesRoute(query({ branchId: branch, from: first.id, to: first.id }), chats, read);
  expect(await to.json()).toEqual({ messages: [] });
  expect((await chats.sceneState(branch))![trackerSlot("health", health)]).toBeDefined(); // read only: the state is as it was
});

test("a missing branch or message answers 404, and a request without its parts answers 400", async () => {
  const { chats, branch, first, read } = await rig();
  expect((await handleTrackerChangesRoute(query({ branchId: "nope", from: first.id }), chats, read)).status).toBe(404);
  expect((await handleTrackerChangesRoute(query({ branchId: branch, from: "nope" }), chats, read)).status).toBe(404);
  expect((await handleTrackerChangesRoute(query({ branchId: branch, from: first.id, to: "nope" }), chats, read)).status).toBe(404);
  expect((await handleTrackerChangesRoute(query({ branchId: branch }), chats, read)).status).toBe(400);
  expect((await handleTrackerChangesRoute(query({ from: first.id }), chats, read)).status).toBe(400);
});

afterEach(cleanupChatRouteRigs);

test("the real server answers GET /api/chats/tracker-changes for a started scene", async () => {
  const { store, handler, post } = await chatRouteRig();
  await store.save({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "character", id: "vera", body: { identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: { firstMessage: "Evening." }, examples: {}, media: {}, attribution: {}, discovery: {} } });
  const chat = (await (await post("/api/chats/start", { characterId: "vera" })).json()) as { id: string; activeBranchId: string };
  const opened = (await (await handler(apiReq(`/api/chats/open?id=${chat.id}`))).json()) as OpenScene;
  const sent = (await (await post("/api/chats/send", { chatId: chat.id, content: "hi", greetingIndex: 0, expectedVersion: opened.branchVersion })).json()) as OpenScene;
  const res = await handler(apiReq(`/api/chats/tracker-changes?branchId=${chat.activeBranchId}&from=${sent.messages[0]!.id}`));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ messages: [] });
  expect((await handler(apiReq(`/api/chats/tracker-changes?branchId=${chat.activeBranchId}&from=nope`))).status).toBe(404);
});

test("an empty to means the tip, and a malformed to is a 400", async () => {
  const { chats, branch, first, reply, read } = await rig();
  const tip = await handleTrackerChangesRoute(query({ branchId: branch, from: first.id, to: "" }), chats, read);
  expect(tip.status).toBe(200);
  expect(((await tip.json()) as { messages: { messageId: string }[] }).messages.map((m) => m.messageId)).toEqual([reply.id]);
  for (const bad of ["a b", "x/y", "a\nb", "%%"]) {
    expect((await handleTrackerChangesRoute(query({ branchId: branch, from: first.id, to: bad }), chats, read)).status, `to ${bad}`).toBe(400);
    expect((await handleTrackerChangesRoute(query({ branchId: branch, from: bad }), chats, read)).status, `from ${bad}`).toBe(400);
    expect((await handleTrackerChangesRoute(query({ branchId: bad, from: first.id }), chats, read)).status, `branchId ${bad}`).toBe(400);
  }
});
