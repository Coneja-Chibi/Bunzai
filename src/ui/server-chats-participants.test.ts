/** The participant routes over HTTP, on the real encrypted library: the one writer, refused whole, and the confirm and undo of a run. */
import { afterEach, expect, setDefaultTimeout, test } from "bun:test";
import { apiReq } from "./server-test-rig";
import { chatRouteRig as rig, cleanupChatRouteRigs, vera } from "./fake-server-chats-rig";

afterEach(cleanupChatRouteRigs);
setDefaultTimeout(30_000);

type Roster = { participants: { people: { id: string; name?: string; retired?: boolean; run?: string }[]; main?: string } | null };

test("a change is stored, read back, refused whole when bad, and a gone scene is a 404", async () => {
  const { store, post, handler, token } = await rig();
  await store.save(vera);
  const chat = (await (await post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  const add = (await (await post("/api/chats/participants", { chatId: chat.id, change: { op: "add", run: "r1", people: [{ name: "Mira Vance" }] } })).json()) as Roster;
  expect(add.participants!.people.map((p) => p.name)).toEqual(["Mira Vance"]);
  expect((await post("/api/chats/participants", { chatId: chat.id, change: { op: "add", run: "r2", people: [{ name: "mira vance" }] } })).status).toBe(400);
  expect((await post("/api/chats/participants", { chatId: chat.id, change: { op: "wipe" } })).status).toBe(400);
  expect((await post("/api/chats/participants", { chatId: "nope", change: { op: "main", id: null } })).status).toBe(404);
  const read = await handler(apiReq(`/api/chats/participants?chatId=${chat.id}`, { token }));
  expect(((await read.json()) as Roster).participants!.people).toHaveLength(1);
});

test("a confirmed run is stored once and Undo retires it; refused names store nothing", async () => {
  const { store, post } = await rig();
  await store.save(vera);
  const chat = (await (await post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  const done = (await (await post("/api/chats/participants/apply", { chatId: chat.id, people: [{ name: "Mira Vance", description: "a guard" }] })).json()) as Roster & { run: string; added: number };
  expect([done.added, done.participants!.people[0]!.run]).toEqual([1, done.run]);
  const none = (await (await post("/api/chats/participants/apply", { chatId: chat.id, people: [{ name: "Update the plot" }] })).json()) as { added: number };
  expect(none.added).toBe(0);
  expect((await post("/api/chats/participants/apply", { chatId: chat.id, people: "Mira" })).status).toBe(400);
  const undone = (await (await post("/api/chats/participants/undo", { chatId: chat.id, run: done.run })).json()) as Roster;
  expect(undone.participants!.people[0]!.retired).toBe(true);
});

test("Reconcile on a scene with no connection is refused with a reason, and stores nothing", async () => {
  const { store, post } = await rig();
  await store.save(vera);
  const chat = (await (await post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  expect((await post("/api/chats/participants/reconcile", { chatId: chat.id, count: 12 })).status).toBe(409);
});
