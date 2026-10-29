/**
 * A cast rides only the NEXT reply (Spellbook, ChatStore rule 43). The person records a cast on the newest message; when that message is a reply being given a new version, the
 * new version's prompt and tick leave the cast alone and it stays pending for the reply after, which carries it once and spends it. Run through the real turn on both stores.
 */
import { afterEach, describe, expect, test } from "bun:test";
import type { ChatStore } from "../stage/contracts/chat-store";
import type { Provider, ProviderCompletion, ProviderRequest } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { sqliteChatStore } from "../stage/store/sqlite-chat-store";
import type { StageDatabase } from "../stage/store/sqlite/database";
import { freshDatabase, testCipher } from "../stage/store/sqlite/test-support";
import { dataAt, personEdit } from "./fake-director-rig";
import { runTurn, type Connected } from "./scene-turn";

const open: StageDatabase[] = [];
afterEach(() => { for (const d of open.splice(0)) d.close(); });
const STORES: [string, () => ChatStore][] = [["memory", () => memoryChatStore()], ["sqlite", () => sqliteChatStore(freshDatabase(open), testCipher())]];
const NOTE = '[SPELL CAST] The player invokes "Firebolt" (attack, Level 3).';
const spell = { id: "s1", name: "Firebolt", template: "attack", description: "d", level: 3, status: "learned", cooldownRemaining: 2 };

describe.each(STORES)("a cast and a regenerate of the reply it was recorded on (%s)", (_name, make) => {
  async function scene() {
    const chats = make();
    const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: { kind: "character", id: "vera", body: { identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } } } });
    await chats.setConnection(chat.id, { id: "conn", model: "vera-1" });
    await chats.setProps(chat.id, { on: ["tracker-spellbook"] });
    await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Evening." }, { role: "user", content: "Any storms?" }]);
    const sent: ProviderRequest[] = [];
    const says = { text: "Maybe." };
    const provider: Provider = { id: "fake", async send(request) { sent.push(request); return { content: says.text, finish_reason: "stop", raw: {} } as ProviderCompletion; } };
    const deps = { chats, state: memoryStateStore(), connect: async (): Promise<Connected | null> => ({ provider, kind: "openrouter", context: 32_000 }), readPreset: async () => null, readLorebook: async () => null, now: () => 1_000, randomSeed: () => 7 };
    const turn = async (kind: "reply" | "swipe" | "continue" = "reply") => runTurn(deps, { chatId: chat.id, kind, expectedVersion: (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion! }, () => undefined);
    const book = async () => (await dataAt(chats, chat.activeBranchId, "spellbook")) as { spells: { cooldownRemaining: number }[]; pendingCast?: string };
    return { chats, chat, sent, turn, book, says };
  }
  const carried = (r: ProviderRequest): number => r.messages.filter((m) => m.content === NOTE).length;

  test("regenerating the reply the cast was recorded on neither carries nor spends it; the next reply carries it once and spends it", async () => {
    const s = await scene();
    await personEdit(s.chats, s.chat.activeBranchId, "spellbook", { spells: [spell], subs: {} });
    await s.turn();
    await personEdit(s.chats, s.chat.activeBranchId, "spellbook", { spells: [spell], subs: {}, pendingCast: NOTE });
    await s.turn("swipe");
    expect(carried(s.sent.at(-1)!)).toBe(0);
    expect((await s.book()).pendingCast).toBe(NOTE);
    await s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content: "And then?" });
    await s.turn();
    expect(carried(s.sent.at(-1)!)).toBe(1);
    expect((await s.book()).pendingCast).toBeUndefined();
    await s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content: "Again" });
    await s.turn();
    expect(carried(s.sent.at(-1)!)).toBe(0);
  });

  test("continuing the reply the cast was recorded on neither carries nor spends it either", async () => {
    const s = await scene();
    await personEdit(s.chats, s.chat.activeBranchId, "spellbook", { spells: [spell], subs: {} });
    await s.turn();
    await personEdit(s.chats, s.chat.activeBranchId, "spellbook", { spells: [spell], subs: {}, pendingCast: NOTE });
    s.says.text = " And the glass.";
    await s.turn("continue");
    expect(carried(s.sent.at(-1)!)).toBe(0);
    const book = await s.book();
    expect([book.pendingCast, book.spells[0]!.cooldownRemaining]).toEqual([NOTE, 2]); // the cast edit wrote the row at 2 on the reply; a continue ticks nothing
    await s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content: "And then?" });
    s.says.text = "Maybe.";
    await s.turn();
    expect(carried(s.sent.at(-1)!)).toBe(1);
    expect((await s.book()).pendingCast).toBeUndefined();
  });

  test("a cast recorded before the reply that is regenerated is still that reply's: the new version carries it and spends it", async () => {
    const s = await scene();
    await personEdit(s.chats, s.chat.activeBranchId, "spellbook", { spells: [spell], subs: {}, pendingCast: NOTE });
    await s.turn();
    expect((await s.book()).pendingCast).toBeUndefined();
    await s.turn("swipe");
    expect(carried(s.sent.at(-1)!)).toBe(1);
    expect((await s.book()).pendingCast).toBeUndefined();
  });
});
