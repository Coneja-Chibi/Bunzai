/**
 * The Cast wing's scene routes over HTTP (ChatStore rules 13, 26, 27): playing as another persona,
 * saving the scene's persona or card through the editor's patch envelope and following it, the chosen
 * alt-art variant, and a persona's scene count. Stale and busy answer 409, a locked library 423.
 */
import { afterEach, expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { libraryChatsFor } from "../studio/library-content";
import type { OpenScene } from "../studio/scenes";
import { chatRouteRig, cleanupChatRouteRigs, vera } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";

afterEach(cleanupChatRouteRigs);

const persona = (id: string, name: string) => ({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "persona" as const, id, body: { name, content: `${name} speaks.` } });

async function started() {
  const r = await chatRouteRig();
  const withLook = { ...vera, body: { ...vera.body, variants: [{ id: "storm", label: "Storm", overrides: {} }] } };
  await r.store.save(withLook);
  const nuit = await r.store.save(persona("nuit", "Nuit"));
  await r.store.save(persona("corvin", "Corvin"));
  const chat = (await (await r.post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  const open = async () => (await (await r.handler(apiReq(`/api/chats/open?id=${chat.id}`))).json()) as OpenScene;
  const patch = (kind: string, id: string, revision: string, body: Record<string, unknown>, entity: Record<string, unknown>) => ({
    chatId: chat.id, member: kind, save: { kind, id, expectedRevision: revision, head: { ...entity, body } },
  });
  return { ...r, chat, open, patch, nuit };
}

test("playing as another persona changes this scene only, stamps the next message, and refuses bad bodies", async () => {
  const { post, chat, open, settings } = await started();
  expect((await post("/api/chats/persona", { chatId: chat.id, personaId: 5 })).status).toBe(400);
  expect((await post("/api/chats/persona", { chatId: chat.id, personaId: "ghost" })).status).toBe(404);
  const swapped = (await (await post("/api/chats/persona", { chatId: chat.id, personaId: "corvin" })).json()) as OpenScene;
  expect(swapped.chat.cast.persona).toEqual({ id: "corvin", version: 1, name: "Corvin" });
  const sent = (await (await post("/api/chats/send", { chatId: chat.id, content: "hi", greetingIndex: 0, expectedVersion: swapped.branchVersion })).json()) as OpenScene;
  expect(sent.messages.at(-1)!.persona).toEqual({ id: "corvin", name: "Corvin" });
  expect((await post("/api/chats/persona", { chatId: chat.id, personaId: "nuit", expectedSnapshotVersion: swapped.chat.snapshotVersion - 1 })).status).toBe(409);
  expect((await open()).chat.cast.persona!.id).toBe("corvin");
  expect(((await settings.read()) as Record<string, unknown>)["persona.default"]).toBeUndefined();
});

test("a reply being written refuses the swap with 409 and changes nothing", async () => {
  const { post, chat, store } = await started();
  const chats = libraryChatsFor(store.studioPath())!;
  const scene = (await chats.getChat(chat.id))!;
  await chats.appendMessage(scene.activeBranchId, { role: "user", content: "hi" });
  await chats.beginTurn(scene.activeBranchId, { kind: "reply" });
  const refused = await post("/api/chats/persona", { chatId: chat.id, personaId: "corvin" });
  expect(refused.status).toBe(409);
  expect(((await refused.json()) as { error: string }).error).toContain("reply is being written");
  expect((await chats.getChat(chat.id))!.cast.persona).toBeUndefined();
});

test("saving the scene's persona writes the Library, moves the scene to it, and a stale save is 409", async () => {
  const { post, chat, open, patch, nuit, store } = await started();
  await post("/api/chats/persona", { chatId: chat.id, personaId: "nuit" });
  const entity = persona("nuit", "Nuit");
  const saved = await post("/api/chats/save-member", patch("persona", "nuit", nuit.revision!, { ...entity.body, name: "Nuit the Late" }, entity));
  expect(saved.status).toBe(200);
  const result = (await saved.json()) as { applied: boolean; scene: OpenScene };
  expect(result.applied).toBe(true);
  expect(result.scene.chat.cast.persona).toMatchObject({ id: "nuit", name: "Nuit the Late", version: 2 });
  expect((await store.read("persona", "nuit"))!.body).toMatchObject({ name: "Nuit the Late" });
  const stale = await post("/api/chats/save-member", patch("persona", "nuit", nuit.revision!, { ...entity.body, name: "Again" }, entity));
  expect(stale.status).toBe(409);
  expect((await open()).chat.cast.persona!.name).toBe("Nuit the Late");
});

test("a save names only the piece the scene plays, and is refused before it writes while a reply is open", async () => {
  const { post, chat, patch, nuit, store } = await started();
  await post("/api/chats/persona", { chatId: chat.id, personaId: "nuit" });
  const corvin = persona("corvin", "Corvin");
  const other = (await store.list("persona")).find((p) => p.id === "corvin")!;
  expect((await post("/api/chats/save-member", patch("persona", "corvin", other.revision!, { ...corvin.body, name: "Stolen" }, corvin))).status).toBe(404);
  expect((await post("/api/chats/save-member", { chatId: chat.id, member: "persona", save: { nope: 1 } })).status).toBe(400);
  expect((await store.read("persona", "corvin"))!.body).toMatchObject({ name: "Corvin" });

  const chats = libraryChatsFor(store.studioPath())!;
  const scene = (await chats.getChat(chat.id))!;
  await chats.appendMessage(scene.activeBranchId, { role: "user", content: "hi" });
  await chats.beginTurn(scene.activeBranchId, { kind: "reply" });
  const nuitEntity = persona("nuit", "Nuit");
  expect((await post("/api/chats/save-member", patch("persona", "nuit", nuit.revision!, { ...nuitEntity.body, name: "Blocked" }, nuitEntity))).status).toBe(409);
  expect((await store.read("persona", "nuit"))!.body).toMatchObject({ name: "Nuit" });
});

test("the chosen look is saved on the scene, a look the card lacks is 400, and null plays the base", async () => {
  const { post, chat } = await started();
  const set = (await (await post("/api/chats/variant", { chatId: chat.id, variantId: "storm" })).json()) as OpenScene;
  expect(set.chat.variantId).toBe("storm");
  expect((await post("/api/chats/variant", { chatId: chat.id, variantId: "nope" })).status).toBe(400);
  expect((await post("/api/chats/variant", { chatId: chat.id, variantId: 3 })).status).toBe(400);
  expect(((await (await post("/api/chats/variant", { chatId: chat.id, variantId: null })).json()) as OpenScene).chat.variantId).toBeUndefined();
});

test("a persona's stats are messages, scenes and streak, and follow the scenes that play it now", async () => {
  const { post, handler, chat } = await started();
  await post("/api/chats/start", { characterId: "vera" });
  await post("/api/chats/persona", { chatId: chat.id, personaId: "nuit" });
  const stats = async (id: string) => (await (await handler(apiReq(`/api/chats/persona-stats?id=${id}`))).json()) as { messages: number; scenes: number; streak: number };
  expect(await stats("nuit")).toEqual({ messages: 0, scenes: 1, streak: 0 });
  expect((await stats("corvin")).scenes).toBe(0);
});

test("with the library locked, the new scene routes answer 423", async () => {
  const { post, handler } = await chatRouteRig();
  expect((await post("/api/library/lock", {})).status).toBe(200);
  expect((await handler(apiReq("/api/chats/persona-stats?id=x"))).status).toBe(423);
  const save = { kind: "persona", id: "x", expectedRevision: "a".repeat(64), head: {} };
  for (const path of ["persona", "variant", "backdrop", "save-member"]) expect((await post(`/api/chats/${path}`, { chatId: "x", personaId: null, variantId: null, member: "persona", save })).status).toBe(423);
});

test("a look cannot be changed while a reply is being written: 409, and the scene keeps its look", async () => {
  const { post, chat, store } = await started();
  const chats = libraryChatsFor(store.studioPath())!;
  const scene = (await chats.getChat(chat.id))!;
  await chats.appendMessage(scene.activeBranchId, { role: "user", content: "hi" });
  await chats.beginTurn(scene.activeBranchId, { kind: "reply" });
  const refused = await post("/api/chats/variant", { chatId: chat.id, variantId: "storm" });
  expect(refused.status).toBe(409);
  expect(((await refused.json()) as { error: string }).error).toContain("reply is being written");
  expect((await chats.getChat(chat.id))!.variantId).toBeUndefined();
});
