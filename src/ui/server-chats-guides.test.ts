/**
 * The Prompting wing's routes over HTTP, on the real encrypted library: the guide library (make, change,
 * list, delete softly, refuse bad fields) and a scene's guides and note (ChatStore rule 37).
 */
import { afterEach, expect, setDefaultTimeout, test } from "bun:test";
import { chatRouteRig as rig, cleanupChatRouteRigs, vera } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";

afterEach(cleanupChatRouteRigs);
setDefaultTimeout(30_000);

test("guides are made, listed, changed and deleted over HTTP, and a bad one is a 400", async () => {
  const { handler, post } = await rig();
  expect(await (await handler(apiReq("/api/chats/guides"))).json()).toEqual([]);
  const made = (await (await post("/api/chats/guides/save", { guide: { title: "Slow burn", content: "Let it simmer.", category: "thinking" } })).json()) as { id: string; category: string; role: string };
  expect(made).toMatchObject({ category: "thinking", role: "user" });
  const edited = (await (await post("/api/chats/guides/save", { guide: { id: made.id, title: "Slower", content: "Let it simmer.", mode: "depth", depth: 3 } })).json()) as { mode: string; depth: number };
  expect(edited).toMatchObject({ mode: "depth", depth: 3 });
  expect(((await (await handler(apiReq("/api/chats/guides"))).json()) as { title: string }[]).map((g) => g.title)).toEqual(["Slower"]);
  expect((await post("/api/chats/guides/save", { guide: { title: "", content: "x" } })).status).toBe(400);
  expect((await post("/api/chats/guides/save", { guide: { id: "nope", title: "x", content: "x" } })).status).toBe(404);
  expect(await (await post("/api/chats/guides/delete", { id: made.id })).json()).toEqual({ deleted: true });
  expect(await (await post("/api/chats/guides/delete", { id: made.id })).json()).toEqual({ deleted: false });
  expect(await (await handler(apiReq("/api/chats/guides"))).json()).toEqual([]);
});

test("a scene keeps its switched-on guides and note, a patch leaves the other alone, and a bad one is a 400", async () => {
  const { store, post } = await rig();
  await store.save(vera);
  const chat = (await (await post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  const note = { text: "Tense.", position: "in_chat", depth: 4, frequency: 2 };
  const first = (await (await post("/api/chats/prompting", { chatId: chat.id, prompting: { guides: ["a", "b"] } })).json()) as { prompting: unknown };
  expect(first.prompting).toEqual({ guides: ["a", "b"] });
  const second = (await (await post("/api/chats/prompting", { chatId: chat.id, prompting: { note } })).json()) as { prompting: unknown };
  expect(second.prompting).toEqual({ guides: ["a", "b"], note });
  expect((await post("/api/chats/prompting", { chatId: chat.id, prompting: { note: { ...note, frequency: 9 } } })).status).toBe(400);
  expect((await post("/api/chats/prompting", { chatId: "nope", prompting: {} })).status).toBe(404);
});

test("a scene keeps a tracker's SETTINGS over HTTP and its state through the state route, and a bad change or module is a 400", async () => {
  const { store, post, handler } = await rig();
  await store.save(vera);
  const chat = (await (await post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  const hurt = { hp: 40, maxHp: 100, mp: 50, maxMp: 50, ap: 3, maxAp: 3, shield: 0, xp: 0, level: 1, currency: 100, needs: {}, log: [] };
  const first = (await (await post("/api/chats/trackers", { chatId: chat.id, module: "resources", patch: { context: "every2" } })).json()) as { trackers: unknown };
  expect(first.trackers).toEqual({ resources: { context: "every2" } });
  const second = (await (await post("/api/chats/trackers", { chatId: chat.id, module: "spellbook", patch: { subs: { wildMagic: true } } })).json()) as { trackers: unknown };
  expect(second.trackers).toEqual({ resources: { context: "every2" }, spellbook: { subs: { wildMagic: true } } });
  // A module's state is not a setting.
  expect((await post("/api/chats/trackers", { chatId: chat.id, module: "resources", patch: { data: hurt } })).status).toBe(400);
  expect((await post("/api/chats/trackers", { chatId: chat.id, module: "spellbook", patch: { subs: { secrets: true } } })).status).toBe(400);
  expect((await post("/api/chats/trackers", { chatId: chat.id, module: "wizardry", patch: { context: "never" } })).status).toBe(400);
  expect((await post("/api/chats/trackers", { chatId: "nope", module: "resources", patch: {} })).status).toBe(404);
  // The state is written on the newest reply and read back at the tip.
  const read = async () => (await (await handler(apiReq(`/api/chats/tracker-state?chatId=${chat.id}`))).json()) as { branchId: string; branchVersion: number; tipId: string | null; data: Record<string, unknown> };
  // A scene with no message has nothing to keep a change with; one message gives it a place.
  expect((await read()).tipId).toBeNull();
  expect((await post("/api/chats/send", { chatId: chat.id, content: "hi", greetingIndex: 0, expectedVersion: (await read()).branchVersion })).status).toBe(200);
  const open = await read();
  expect(open).toMatchObject({ data: {} });
  expect(open.tipId).not.toBeNull();
  const body = { chatId: chat.id, branchId: open.branchId, messageId: open.tipId, expectedVersion: open.branchVersion };
  const wrote = (await (await post("/api/chats/tracker-state", { ...body, writes: [{ module: "resources", data: hurt, base: null }] })).json()) as { data: Record<string, unknown> };
  expect(wrote.data["resources"]).toEqual(hurt);
  expect((await post("/api/chats/tracker-state", { ...body, writes: [{ module: "resources", data: { ...hurt, hp: 101 } }] })).status).toBe(400);
  expect((await post("/api/chats/tracker-state", { ...body, writes: [{ module: "quests", data: {} }] })).status).toBe(400);
  expect((await post("/api/chats/tracker-state", { ...body, branchId: "nope", writes: [{ module: "resources", data: hurt }] })).status).toBe(404);
});
