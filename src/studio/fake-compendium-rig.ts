/**
 * The Compendium passes' test rig: a real library on a throwaway Studio root holding two books, an in-memory scene that reads them,
 * and a scripted provider that answers each model call from a queue. Used by tests only (a `fake-` stand-in, never imported by app
 * code).
 */
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { emptyLoreEntry, emptyLorebookBody } from "../core/lore";
import type { LorebookEntry } from "../entities/lorebook/schema";
import type { Provider, ProviderCompletion, ProviderRequest } from "../stage/contracts/provider";
import type { ChatCompendiumPatch } from "../stage/contracts/chat-store";
import { memoryChatStore } from "../stage/store/chat-store";
import { typedEntry } from "../core/compendium/fixture-book";
import type { CompendiumDeps } from "./compendium-deps";
import { StudioStore } from "./store";
import { tempDir } from "./test-temp-dir";
import type { BookStore } from "./world-book-writer";

const vera = (refs: string[]) => ({ kind: "character", id: "vera", body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {}, knowledgeRefs: refs } });

export const WOLF = typedEntry("c1", "Lycanthrope", "character", { name: "Lycanthrope", aliases: ["Wolfman"], tier: "B", memories: ["a"] }, {}, { content: "Hand-written prose about the wolf." });
export const HARBOR: LorebookEntry = { ...emptyLoreEntry("k1"), title: "Harbor Lore", content: "prose" };

export const answer = (...filings: unknown[]): string => JSON.stringify({ filings });

export async function compendiumRig(config: ChatCompendiumPatch | null = { on: true, books: { bk: { access: "read_write" } } }, bookEntries: LorebookEntry[] = [WOLF, HARBOR]) {
  let clock = 1_000;
  let ids = 0;
  const library = new StudioStore(await tempDir("vaude-compendium-"));
  const book = (id: string, name: string, entries: LorebookEntry[]) => library.save({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "lorebook", id, body: { ...emptyLorebookBody(name), entries } });
  await book("bk", "Book", bookEntries);
  await book("bk2", "Second", []);
  const chats = memoryChatStore(() => (clock += 1));
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera(["bk", "bk2"]) } });
  await chats.setConnection(chat.id, { id: "conn", model: "vera-1" });
  if (config) await chats.setCompendium(chat.id, config);
  const [, user, reply] = (await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Evening." }, { role: "user", content: "Who howls?" }, { role: "assistant", content: "Wolfman howls at the lamp." }]))!;

  const requests: ProviderRequest[] = [];
  const script: (string | Error)[] = [];
  const provider: Provider = {
    id: "fake",
    async send(request) {
      requests.push(request);
      const next = script.shift() ?? answer();
      if (next instanceof Error) throw next;
      return { content: next, finish_reason: "stop", raw: {} } as ProviderCompletion;
    },
  };
  /** The store the writer sees; `between` runs once after the first read and before the first patch, as the person's edit would. */
  let between: (() => Promise<void>) | undefined;
  const store: BookStore = {
    read: (kind, id) => library.read(kind, id),
    async comparePatch(...args) {
      const run = between;
      between = undefined;
      await run?.();
      return library.comparePatch(...args);
    },
  };
  const deps: CompendiumDeps = { chats, state: { read: async () => null }, store, connect: async () => ({ provider, kind: "openrouter", context: 32_000 }), now: () => (clock += 1), newId: () => `id-${++ids}` };
  const target = { chatId: chat.id, branchId: chat.activeBranchId, messageId: reply!.id, swipeId: reply!.swipes[0]!.id, reply: "Wolfman howls at the lamp.", covered: ["Who howls?"] };
  const entries = async (id = "bk") => ((await library.read("lorebook", id)) as unknown as { body: { entries: LorebookEntry[] } }).body.entries;
  return { library, chats, chat, deps, provider, script, requests, target, user: user!, reply: reply!, entries, onNextPatch: (fn: () => Promise<void>) => void (between = fn) };
}
