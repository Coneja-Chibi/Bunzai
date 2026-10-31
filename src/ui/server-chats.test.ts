/**
 * Scene routes over HTTP, on the test sandbox's encrypted library: start a scene from a character
 * (its cast frozen at the current version, the default persona included), open it, send the first
 * message (the chosen greeting is saved first), refuse a repeated send, and rename, list, delete.
 */
import { afterEach, expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { chatRouteRig as rig, cleanupChatRouteRigs, vera } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";

afterEach(cleanupChatRouteRigs);

test("start, open, first send saves the chosen greeting then the message, and a repeated send is refused", async () => {
  const { store, settings, handler, post } = await rig();
  await store.save(vera);
  await store.save({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "persona", id: "chi", body: { name: "Chi", content: "" } });
  await settings.update({ "persona.default": "chi" });

  expect((await post("/api/chats/start", { characterId: "nobody" })).status).toBe(404);
  const chat = (await (await post("/api/chats/start", { characterId: "vera" })).json()) as { id: string; title: string; cast: unknown };
  expect(chat).toMatchObject({ title: "Vera", cast: { character: { id: "vera", version: 1 }, persona: { id: "chi", version: 1 } } });

  const open = (await (await handler(apiReq(`/api/chats/open?id=${chat.id}`))).json()) as { messages: unknown[]; branchVersion: number; snapshot: { persona?: unknown } };
  expect(open.messages).toEqual([]);
  expect(open.snapshot.persona).toMatchObject({ id: "chi" });

  const sent = (await (await post("/api/chats/send", { chatId: chat.id, content: "Hi Vera", greetingIndex: 1, expectedVersion: open.branchVersion })).json()) as {
    messages: { role: string; swipes: { content: string }[] }[];
  };
  expect(sent.messages.map((m) => [m.role, m.swipes[0]!.content])).toEqual([["assistant", "Evening."], ["user", "Hi Vera"]]);

  const again = await post("/api/chats/send", { chatId: chat.id, content: "Hi Vera", greetingIndex: 1, expectedVersion: open.branchVersion });
  expect(again.status).toBe(409);
});

test("list, rename, delete, and bad input", async () => {
  const { store, handler, post } = await rig();
  await store.save(vera);
  const chat = (await (await post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  expect(((await (await handler(apiReq("/api/chats/list"))).json()) as unknown[]).length).toBe(1);
  expect(await (await post("/api/chats/rename", { id: chat.id, title: "Tavern night" })).json()).toMatchObject({ title: "Tavern night" });
  expect((await post("/api/chats/send", { chatId: chat.id, content: "x" })).status).toBe(400);
  expect((await post("/api/chats/send", { chatId: chat.id, content: "  ", greetingIndex: 0, expectedVersion: 1 })).status).toBe(400);
  expect(await (await post("/api/chats/delete", { id: chat.id })).json()).toEqual({ deleted: true });
  expect((await handler(apiReq(`/api/chats/open?id=${chat.id}`))).status).toBe(404);
});

test("scene export preserves the frozen cast and each take's text", async () => {
  const { store, handler, post } = await rig();
  await store.save(vera);
  const chat = (await (await post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  await post("/api/chats/send", { chatId: chat.id, content: "Hi Vera", greetingIndex: 0, expectedVersion: 1 });
  const response = await handler(apiReq(`/api/chats/export?id=${chat.id}`));
  expect(response.status).toBe(200);
  expect(response.headers.get("content-disposition")).toContain("attachment");
  const lines = (await response.text()).trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
  expect(lines[0]).toMatchObject({ type: "bunzai.scene/1", snapshot: { character: { id: "vera" } } });
  expect(lines.filter((line) => line["type"] === "message").map((line) => (line["message"] as { swipes: { content: string }[] }).swipes[0]!.content)).toEqual(["Hello {{user}}.", "Hi Vera"]);
});

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

test("a scene keeps its frozen cast: a later card edit changes neither its name nor its art (spec rule 10)", async () => {
  const { store, handler, post } = await rig();
  await store.save({ ...vera, body: { ...vera.body, media: { portrait: { role: "portrait", ref: `data:image/png;base64,${PNG}`, mime: "image/png" } } } });
  const chat = (await (await post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  await store.save({ ...vera, body: { ...vera.body, identity: { name: "Renamed" } } }, { overwrite: true });

  const open = (await (await handler(apiReq(`/api/chats/open?id=${chat.id}`))).json()) as { hasPortrait: boolean; snapshot: { character: { original: unknown; body: { identity: { name: string }; media: unknown } } } };
  expect(open.snapshot.character.body.identity.name).toBe("Vera");
  expect(open.hasPortrait).toBe(true);
  expect(open.snapshot.character.body.media).toBeNull();
  expect(open.snapshot.character.original).toBeNull();

  const art = await handler(apiReq(`/api/chats/portrait?id=${chat.id}`));
  expect(art.status).toBe(200);
  expect(art.headers.get("content-type")).toBe("image/png");
  expect((await handler(apiReq("/api/studio/portrait?kind=character&id=vera"))).status).toBe(404);
});

test("a greeting that does not exist, and an edit without text or a version, are refused; a stale edit is 409", async () => {
  const { store, handler, post } = await rig();
  await store.save(vera);
  const chat = (await (await post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  expect((await post("/api/chats/send", { chatId: chat.id, content: "Hi", greetingIndex: 7, expectedVersion: 1 })).status).toBe(400);
  const sent = (await (await post("/api/chats/send", { chatId: chat.id, content: "Hi", greetingIndex: 0, expectedVersion: 1 })).json()) as {
    branchVersion: number; messages: { id: string; swipes: { id: string; content: string }[] }[];
  };
  const [greet] = sent.messages;
  const edit = (body: Record<string, unknown>) => post("/api/chats/edit", { messageId: greet!.id, swipeId: greet!.swipes[0]!.id, ...body });
  expect((await edit({ content: 5, expectedVersion: sent.branchVersion })).status).toBe(400);
  expect((await edit({ content: "  ", expectedVersion: sent.branchVersion })).status).toBe(400);
  expect((await edit({ content: "Changed" })).status).toBe(400);
  expect((await edit({ content: "Changed", expectedVersion: sent.branchVersion - 1 })).status).toBe(409);
  expect((await edit({ content: "Changed", expectedVersion: sent.branchVersion })).status).toBe(200);
  const reopened = (await (await handler(apiReq(`/api/chats/open?id=${chat.id}`))).json()) as { messages: { swipes: { content: string }[] }[] };
  expect(reopened.messages[0]!.swipes[0]!.content).toBe("Changed");
});

test("with the library locked, every scene route answers 423", async () => {
  const { handler, post } = await rig();
  expect((await post("/api/library/lock", {})).status).toBe(200);
  for (const path of ["list", "open?id=x", "portrait?id=x"]) expect((await handler(apiReq(`/api/chats/${path}`))).status).toBe(423);
  const body = { id: "x", chatId: "x", characterId: "vera", messageId: "x", swipeId: "x", title: "t", content: "Hi", greetingIndex: 0, expectedVersion: 1 };
  for (const path of ["start", "send", "edit", "rename", "delete"]) expect((await post(`/api/chats/${path}`, body)).status).toBe(423);
});
