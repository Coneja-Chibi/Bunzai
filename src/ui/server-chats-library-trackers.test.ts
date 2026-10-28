/**
 * The Trackers panel's library-tracker routes: the read (`GET /api/chats/library-trackers`) and the person's edit (`POST /api/chats/tracker-edit`). The routes over the memory store for the
 * answers and every refusal, and the real server for the wiring (the read needs no token, the write does) through a tracker saved in a real library.
 */
import { afterEach, expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { trackerSlot } from "../core/tracker";
import type { TrackerBody } from "../entities/tracker/schema";
import { memoryChatStore } from "../stage/store/chat-store";
import type { OpenScene } from "../studio/scenes";
import type { SceneTrackers } from "../studio/scene-trackers";
import { chatRouteRig, cleanupChatRouteRigs } from "./fake-server-chats-rig";
import { handleLibraryTrackersRoute, parseTrackerEdit } from "./server-chats-library-trackers";
import { studioErr } from "./server-security";
import { apiReq } from "./server-test-rig";

const health: TrackerBody = {
  name: "Health", description: "", layout: "record", note: "", changes: "chips",
  fields: [{ name: "hp", description: "", type: "number", min: 0, maxField: "hp_max", default: 20 }, { name: "hp_max", description: "", type: "number", min: 1, default: 20 }],
};
const read = async (id: string): Promise<TrackerBody | null> => (id === "health" ? health : null);
const now = () => 5_000;

async function rig() {
  const chats = memoryChatStore(() => 1_000);
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: { kind: "character", id: "vera", body: { identity: { name: "Vera" } } } } });
  await chats.setPrompting(chat.id, { trackers: ["health"] });
  const branch = chat.activeBranchId;
  await chats.appendMessage(branch, { role: "user", content: "hi" });
  const open = await chats.beginTurn(branch, { kind: "reply" });
  await chats.saveCheckpoint(open!.id, { content: "t", deltas: [{ slot: trackerSlot("health", health), path: ["hp"], value: 7, at: 5 }] });
  const reply = (await chats.commitTurn(open!.id, { content: "t" }))!;
  const version = (await chats.readMessagesBefore(branch, { limit: 1, liveOnly: true })).branchVersion!;
  /** The route as the server runs it: a refusal the route throws is turned into its status and sentence by the same mapper the server uses. */
  const run = async (req: Request, url: string, body: Record<string, unknown> | null): Promise<{ status: number; body: unknown }> => {
    try {
      const res = await handleLibraryTrackersRoute(req, new URL(url), chats, read, now, body);
      return { status: res!.status, body: await res!.json() };
    } catch (e) {
      const res = studioErr(e);
      return { status: res.status, body: await res.json() };
    }
  };
  const get = (chatId: string) => run(new Request("http://local/x"), `http://local/api/chats/library-trackers?chatId=${chatId}`, null);
  const edit = (over: Record<string, unknown>) => run(
    new Request("http://local/x", { method: "POST" }), "http://local/api/chats/tracker-edit",
    { chatId: chat.id, branchId: branch, messageId: reply.id, trackerId: "health", update: { set: { hp: 12 } }, expectedVersion: version, ...over },
  );
  return { chats, chat, branch, reply, version, get, edit };
}

test("the read answers each linked tracker with its value at the tip and the reply that last changed it, and writes nothing", async () => {
  const { chats, branch, reply, get, chat } = await rig();
  const res = await get(chat.id);
  expect(res.status).toBe(200);
  const found = res.body as SceneTrackers;
  expect(found.tipId).toBe(reply.id);
  expect(found.trackers).toEqual([{ id: "health", body: health, value: { hp: 7, hp_max: 20 }, last: { messageId: reply.id, number: 2 } }]);
  expect((await chats.sceneState(branch))![trackerSlot("health", health)]).toBeDefined();
});

test("a scene that is gone is a 404 and a malformed id is a 400", async () => {
  const { get } = await rig();
  expect((await get("nope")).status).toBe(404);
  expect((await get("a b")).status).toBe(400);
});

test("an edit goes through the tool's update and answers the trackers as they now stand", async () => {
  const { edit } = await rig();
  const res = await edit({ update: { set: { hp: 99 } } });
  expect(res.status).toBe(200);
  expect((res.body as SceneTrackers).trackers[0]!.value).toEqual({ hp: 20, hp_max: 20 }); // held inside its top, not refused
});

test("every refusal is a sentence with the right status, and writes nothing", async () => {
  const { edit, chats, branch, version } = await rig();
  const before = JSON.stringify(await chats.sceneState(branch));
  expect(await edit({ trackerId: "other" })).toEqual({ status: 400, body: { error: "this scene does not use that tracker" } });
  expect(await edit({ messageId: "m-gone" })).toEqual({ status: 409, body: { error: "The scene moved on since this was read, so nothing was changed. Try again." } });
  expect(await edit({ expectedVersion: version + 1 })).toEqual({ status: 409, body: { error: "The scene moved on since this was read, so nothing was changed. Try again." } });
  expect((await edit({ branchId: "nope" })).status).toBe(404);
  expect(await edit({ update: { set: { nope: 1 } } })).toEqual({ status: 400, body: { error: "Unknown fields: nope." } });
  expect(await edit({ update: { set: { hp: 1 }, tracker: "Health" } })).toEqual({ status: 400, body: { error: "Unknown keys: tracker." } });
  expect(await edit({ update: "nope" })).toEqual({ status: 400, body: { error: "update must be an object" } });
  expect(await edit({ expectedVersion: "1" })).toEqual({ status: 400, body: { error: "expectedVersion must be a whole number" } });
  for (const field of ["chatId", "branchId", "messageId", "trackerId"]) expect((await edit({ [field]: "a b" })).body, field).toEqual({ error: `${field} must be an id` });
  expect(JSON.stringify(await chats.sceneState(branch))).toBe(before);
});

test("parseTrackerEdit keeps the tool's update as it came", () => {
  const input = { chatId: "c", branchId: "b", messageId: "m", trackerId: "t", expectedVersion: 3, update: { row: "rope", remove: true } };
  expect(parseTrackerEdit(input)).toEqual(input);
});

afterEach(cleanupChatRouteRigs);

test("the real server reads without a token, refuses the write without one and answers it with one", async () => {
  const { store, handler, post, token } = await chatRouteRig();
  await store.save({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "character", id: "vera", body: { identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: { firstMessage: "Evening." }, examples: {}, media: {}, attribution: {}, discovery: {} } });
  await store.save({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "tracker", id: "health", body: health });
  const chat = (await (await post("/api/chats/start", { characterId: "vera" })).json()) as { id: string; activeBranchId: string };
  await post("/api/chats/prompting", { chatId: chat.id, prompting: { trackers: ["health"] } });
  const opened = (await (await handler(apiReq(`/api/chats/open?id=${chat.id}`))).json()) as OpenScene;
  await post("/api/chats/send", { chatId: chat.id, content: "hi", greetingIndex: 0, expectedVersion: opened.branchVersion });
  const read = await handler(apiReq(`/api/chats/library-trackers?chatId=${chat.id}`));
  expect(read.status).toBe(200);
  const found = (await read.json()) as SceneTrackers;
  expect(found.trackers.map((t) => [t.id, t.value])).toEqual([["health", { hp: 20, hp_max: 20 }]]);
  const send = { chatId: chat.id, branchId: chat.activeBranchId, messageId: found.tipId, trackerId: "health", update: { set: { hp: 5 } }, expectedVersion: found.branchVersion };
  expect((await handler(apiReq("/api/chats/tracker-edit", { method: "POST", contentType: "application/json", body: JSON.stringify(send) }))).status).toBe(403);
  const done = await handler(apiReq("/api/chats/tracker-edit", { method: "POST", token, contentType: "application/json", body: JSON.stringify(send) }));
  expect(done.status).toBe(200);
  expect(((await done.json()) as SceneTrackers).trackers[0]!.value).toEqual({ hp: 5, hp_max: 20 });
});
