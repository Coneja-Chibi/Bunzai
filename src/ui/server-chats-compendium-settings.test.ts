/**
 * The Compendium settings route over HTTP, on the real encrypted library:
 * the one writer a scene's Compendium choices go through, patch semantics, and a refusal that changes nothing.
 */
import { afterEach, expect, setDefaultTimeout, test } from "bun:test";
import { COMPENDIUM_DEFAULTS, resolveCompendium } from "../core/compendium/defaults";
import { chatRouteRig as rig, cleanupChatRouteRigs, vera } from "./fake-server-chats-rig";

afterEach(cleanupChatRouteRigs);
setDefaultTimeout(30_000);

type Saved = { compendium?: Record<string, unknown> };

test("a scene's Compendium choices are saved by patch and read back through the one resolver", async () => {
  const { store, post } = await rig();
  await store.save(vera);
  const chat = (await (await post("/api/chats/start", { characterId: "vera" })).json()) as { id: string } & Saved;
  expect(chat.compendium).toBeUndefined();
  expect(resolveCompendium(chat.compendium).on).toBe(COMPENDIUM_DEFAULTS.on);

  const first = (await (await post("/api/chats/compendium", { chatId: chat.id, compendium: { on: true, books: { a: { access: "read_write" } }, writeBook: "a" } })).json()) as Saved;
  expect(first.compendium).toEqual({ on: true, books: { a: { access: "read_write" } }, writeBook: "a" });
  const second = (await (await post("/api/chats/compendium", { chatId: chat.id, compendium: { recall: { maxEntries: 5 } } })).json()) as Saved;
  expect(second.compendium).toEqual({ on: true, books: { a: { access: "read_write" } }, writeBook: "a", recall: { maxEntries: 5 } });
  const third = (await (await post("/api/chats/compendium", { chatId: chat.id, compendium: { recall: { guidance: "Prefer places." } } })).json()) as Saved;
  expect(third.compendium?.["recall"]).toEqual({ maxEntries: 5, guidance: "Prefer places." });
});

test("a bad patch is a 400 that changes nothing, and a gone scene is a 404", async () => {
  const { store, post } = await rig();
  await store.save(vera);
  const chat = (await (await post("/api/chats/start", { characterId: "vera" })).json()) as { id: string };
  await post("/api/chats/compendium", { chatId: chat.id, compendium: { on: true } });
  expect((await post("/api/chats/compendium", { chatId: chat.id, compendium: { recall: { maxEntries: 99 } } })).status).toBe(400);
  expect((await post("/api/chats/compendium", { chatId: chat.id, compendium: { nope: 1 } })).status).toBe(400);
  expect((await post("/api/chats/compendium", { chatId: chat.id, compendium: "on" })).status).toBe(400);
  const kept = (await (await post("/api/chats/compendium", { chatId: chat.id, compendium: {} })).json()) as Saved;
  expect(kept.compendium).toEqual({ on: true });
  expect((await post("/api/chats/compendium", { chatId: "nope", compendium: {} })).status).toBe(404);
});
