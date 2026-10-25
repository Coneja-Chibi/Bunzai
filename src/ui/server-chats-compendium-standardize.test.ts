/**
 * The Standardize routes on the real handler: the poll (runs and what Revert holds), a start refused in words (off, read only,
 * not this scene's book, nothing waiting), malformed bodies, Cancel and Dismiss with nothing to act on, and the pause the run puts on
 * Reconcile and Undo while it works (RoleCall's lock banner, enforced here and not only drawn).
 */
import { afterEach, expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { emptyLoreEntry, emptyLorebookBody } from "../core/lore/empty-book";
import type { Provider } from "../stage/contracts/provider";
import { cancelRun, dismissRun, startStandardize } from "../studio/compendium-standardize";
import { libraryChatsFor } from "../studio/library-content";
import { testCharacter } from "../studio/test-character";
import { chatRouteRig as rig, cleanupChatRouteRigs } from "./fake-server-chats-rig";
import { apiReq } from "./server-test-rig";

afterEach(cleanupChatRouteRigs);

async function ready() {
  const r = await rig();
  await r.store.save(testCharacter("vera", ["bk"], { firstMessage: "Evening." }));
  await r.store.save({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "lorebook", id: "bk", body: { ...emptyLorebookBody("Book"), entries: [{ ...emptyLoreEntry("e1"), title: "Aria", content: "Aria sings." }] } });
  const chat = (await (await r.post("/api/chats/start", { characterId: "vera" })).json()) as { id: string; activeBranchId: string };
  const chats = libraryChatsFor(r.store.studioPath())!;
  const turnOn = (access: "read_write" | "read_only" = "read_write") => r.post("/api/chats/compendium", { chatId: chat.id, compendium: { on: true, books: { bk: { access } } } });
  return { ...r, chat, chats, turnOn, std: (path: string, body: unknown) => r.post(`/api/chats/compendium/standardize${path}`, body) };
}

test("the poll lists no runs and nothing to revert for a fresh scene, and an unknown scene is 404", async () => {
  const r = await ready();
  const poll = async (id: string) => r.handler(apiReq(`/api/chats/compendium/standardize?chatId=${id}`));
  expect(await (await poll(r.chat.id)).json()).toEqual({ runs: [], revertable: {} });
  expect((await poll("nope")).status).toBe(404);
});

test("a start is refused in words: Compendium off, book read only, not this scene's book", async () => {
  const r = await ready();
  const start = async (bookId = "bk") => {
    const res = await r.std("", { chatId: r.chat.id, bookId, by: "entries" });
    return { status: res.status, error: ((await res.json()) as { error: string }).error };
  };
  expect(await start()).toEqual({ status: 409, error: "The Compendium is off for this scene. Turn it on in Settings to standardize." });
  await r.turnOn("read_only");
  expect(await start()).toMatchObject({ status: 409, error: expect.stringContaining("does not allow writing") });
  await r.turnOn("read_write");
  expect(await start("elsewhere")).toEqual({ status: 404, error: "that book is not one this scene reads" });
});

test("malformed bodies are 400, Cancel with no run is 404, Dismiss with none is a quiet false, Revert with nothing to revert says so", async () => {
  const r = await ready();
  expect((await r.std("", { chatId: r.chat.id, bookId: "bk", by: "sideways" })).status).toBe(400);
  expect((await r.std("", { chatId: r.chat.id, bookId: "bk", by: "tokens", tokenBudget: "lots" })).status).toBe(400);
  expect((await r.std("", { chatId: r.chat.id })).status).toBe(400);
  expect((await r.std("/cancel", { chatId: r.chat.id, bookId: "bk" })).status).toBe(404);
  expect(await (await r.std("/dismiss", { chatId: r.chat.id, bookId: "bk" })).json()).toEqual({ dismissed: false });
  expect(await (await r.std("/revert", { chatId: r.chat.id, bookId: "bk" })).json()).toEqual({ receipts: 0, rewrites: 0, merges: 0, splits: 0, consumed: 0, skipped: [] });
  expect((await r.std("/nope", { chatId: r.chat.id, bookId: "bk" })).status).toBe(404);
});

test("while a run works the book's Reconcile and Undo are paused, Revert is refused, and all of it frees when the run ends", async () => {
  const r = await ready();
  await r.turnOn();
  await r.chats.setConnection(r.chat.id, { id: "conn", model: "m" });
  let release!: () => void;
  const provider: Provider = {
    id: "slow",
    send: () => new Promise((resolve) => { release = () => resolve({ content: JSON.stringify({ entries: [{ source: 1, items: [{ type: "character", entry: { name: "Aria" } }] }] }), finish_reason: "stop", raw: {} } as never); }),
  };
  const deps = { chats: r.chats, state: { read: async () => null }, store: r.store, connect: async () => ({ provider, kind: "openrouter" as const, context: 32_000 }), now: Date.now, newId: () => crypto.randomUUID() };
  const started = await startStandardize(deps, r.chat.id, "bk", { by: "entries" });
  if (!started.ok) throw new Error(started.error);
  const paused = "Standardization in progress. Edits are paused to avoid clobbering work in flight";

  const reconcile = await r.post("/api/chats/compendium/reconcile", { chatId: r.chat.id, bookId: "bk", action: "mirror", pairs: [{ sourceEntryId: "a", targetEntryId: "b" }] });
  expect([reconcile.status, ((await reconcile.json()) as { error: string }).error]).toEqual([409, paused]);
  const undo = await r.post("/api/chats/compendium/undo", { chatId: r.chat.id, receiptId: "any" });
  expect([undo.status, ((await undo.json()) as { error: string }).error]).toEqual([409, paused]);
  expect((await r.post("/api/chats/compendium/undo-take", { chatId: r.chat.id, branchId: r.chat.activeBranchId })).status).toBe(409);
  expect((await r.std("/revert", { chatId: r.chat.id, bookId: "bk" })).status).toBe(409);
  const live = (await (await r.handler(apiReq(`/api/chats/compendium/standardize?chatId=${r.chat.id}`))).json()) as { runs: { status: string; total: number }[]; revertable?: unknown };
  expect(live).toMatchObject({ runs: [{ status: "running", total: 1 }] });
  expect(live).not.toHaveProperty("revertable");

  // Opening the scene mid-run must not sweep the run's in-flight receipt as a crash's (rule 39); a restart, with no run, does.
  const inFlight = (await r.chats.appendReceipt(r.chat.id, { branchId: r.chat.activeBranchId, kind: "standardize", status: "running" }))!;
  expect((await r.handler(apiReq(`/api/chats/open?id=${r.chat.id}`))).status).toBe(200);
  expect((await r.chats.receipt(inFlight.id))!.status).toBe("running");

  while (!release) await new Promise((resolve) => setTimeout(resolve, 5));
  expect(cancelRun(r.chat.id, "bk")?.status).toBe("cancelling");
  release();
  await started.done;
  expect(dismissRun(r.chat.id, "bk")).toBe(true);
  const free = await r.post("/api/chats/compendium/undo", { chatId: r.chat.id, receiptId: "any" });
  expect(free.status).toBe(404);
  expect((await r.handler(apiReq(`/api/chats/open?id=${r.chat.id}`))).status).toBe(200);
  expect((await r.chats.receipt(inFlight.id))!.status).toBe("interrupted");
});
