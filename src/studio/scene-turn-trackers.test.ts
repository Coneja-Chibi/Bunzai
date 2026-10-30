/**
 * A turn with the tracker Props (ChatStore rules 21 and 43): the state a switched-on tracker keeps reaches the request, a switched-off one
 * does not however much it kept (VVS-825), and the trace names the block so the Tokens sheet can show it. RoleCall never sends this to the
 * narrator; this proves Bunzai does.
 */
import { describe, expect, test } from "bun:test";
import { createTurnRuntime } from "./scene-turn-runtime";
import { typedEntry } from "../core/compendium/fixture-book";
import { emptyLorebookBody } from "../core/lore";
import { DEFAULT_RESOURCES } from "../core/trackers/resources";
import { dataAt, personEdit } from "./fake-director-rig";
import type { Provider, ProviderCompletion, ProviderRequest } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { runTurn, type Connected } from "./scene-turn";

const veraWith = (card: Record<string, unknown>) => ({
  kind: "character",
  id: "vera",
  body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {}, ...card },
});

type Book = { id: string; name: string; body: ReturnType<typeof emptyLorebookBody> } | null;
async function scene(card: Record<string, unknown> = {}, readLorebook: (id: string) => Promise<Book> = async () => null) {
  let now = 1_000;
  const chats = memoryChatStore(() => now);
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: veraWith(card) } });
  await chats.setConnection(chat.id, { id: "conn", model: "vera-1" });
  await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Evening." }, { role: "user", content: "Any storms?" }]);
  const sent: ProviderRequest[] = [];
  const flags = { failing: false };
  const provider: Provider = { id: "fake", async send(request) { sent.push(request); if (flags.failing) throw new Error("down"); return { content: "Maybe.", finish_reason: "stop", raw: {} } as ProviderCompletion; } };
  const deps = { runtime: createTurnRuntime(), chats, state: memoryStateStore(), connect: async (): Promise<Connected | null> => ({ provider, kind: "openrouter", context: 32_000 }), readPreset: async () => null, readLorebook, now: () => (now += 10), randomSeed: () => 7 };
  const turn = async () => {
    const version = (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion!;
    await runTurn(deps, { chatId: chat.id, kind: "reply", expectedVersion: version }, () => undefined);
  };
  /** A module's whole next data, kept as the person's edit of the newest message. */
  const keep = (module: Parameters<typeof personEdit>[2], data: unknown) => personEdit(chats, chat.activeBranchId, module, data);
  const read = (module: Parameters<typeof personEdit>[2]) => dataAt(chats, chat.activeBranchId, module);
  return { chats, chat, sent, turn, keep, read, flags, deps };
}
const hurt = { ...DEFAULT_RESOURCES, hp: 40 };
const sentTrackers = (r: ProviderRequest) => r.messages.filter((m) => m.content.startsWith("### Current Game State"));

describe("a turn with tracker Props", () => {
  test("a tracker that is on sends its state in front of the conversation", async () => {
    const s = await scene();
    await s.chats.setProps(s.chat.id, { on: ["tracker-resources"] });
    await s.keep("resources", hurt);
    await s.turn();
    const blocks = sentTrackers(s.sent[0]!);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.role).toBe("system");
    expect(blocks[0]!.content).toContain("HP 40/100");
    expect(s.sent[0]!.messages.indexOf(blocks[0]!)).toBeLessThan(s.sent[0]!.messages.findIndex((m) => m.content === "Evening."));
  });

  test("a tracker that was switched off sends nothing, though its state is still kept, and switching it on again brings it back", async () => {
    const s = await scene();
    await s.keep("resources", hurt);
    await s.turn();
    expect(sentTrackers(s.sent[0]!)).toHaveLength(0);
    expect(await s.read("resources")).toEqual(hurt);
    await s.chats.setProps(s.chat.id, { on: ["tracker-resources"] });
    await s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content: "Again" });
    await s.turn();
    expect(sentTrackers(s.sent[1]!)[0]!.content).toContain("HP 40/100");
  });

  test("a scene with no trackers sends none, and nothing of the block is written into the transcript", async () => {
    const s = await scene();
    await s.chats.setProps(s.chat.id, { on: ["tracker-resources"] });
    await s.chats.setTracker(s.chat.id, "resources", { context: "never" });
    await s.turn();
    expect(sentTrackers(s.sent[0]!)).toHaveLength(0);
    await s.chats.setTracker(s.chat.id, "resources", { context: "always" });
    await s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content: "Again" });
    await s.turn();
    const stored = (await s.chats.readMessages((await s.chats.getChat(s.chat.id))!.activeBranchId, { limit: 100 })).messages;
    expect(JSON.stringify(stored)).not.toContain("Immersion Trackers");
  });
});

// -- Storyboards: dossiers of the books the scene reads (RoleCall prompt-assembly.ts:2136-2146) -------------------------

describe("a turn with Storyboard Props", () => {
  const book = (...entries: ReturnType<typeof typedEntry>[]) => ({ id: "b1", name: "Harbor", body: { ...emptyLorebookBody("Harbor"), entries } });
  const plot = typedEntry("p1", "The Missing Lantern", "plot", { status: "active", tagline: "Three clues left." });
  const place = typedEntry("l1", "Harbor City", "location", { name: "Harbor City", dangerLevel: "low" });
  const heard = (r: ProviderRequest) => r.messages.find((m) => m.content.startsWith("[COMPENDIUM STORYBOARDS CONTEXT]"));

  async function boardScene(entries: ReturnType<typeof typedEntry>[], over: { access?: "write_only" | "read_only" } = {}) {
    const s = await scene({ knowledgeRefs: ["b1"] }, async (id: string) => (id === "b1" ? book(...entries) : null));
    if (over.access) await s.chats.setCompendium(s.chat.id, { on: true, books: { b1: { access: over.access } } });
    return s;
  }

  test("Quest Board, switched on, sends its digest of the plots in front of the conversation, after the trackers", async () => {
    const s = await boardScene([plot]);
    await s.chats.setProps(s.chat.id, { on: ["tracker-quests", "tracker-resources"] });
    await s.turn();
    const messages = s.sent[0]!.messages;
    const text = heard(s.sent[0]!)!.content;
    expect(text).toContain("--- Harbor / Quest Board / Focused ---\n[QUEST BOARD]");
    expect(text).toContain("- {the-missing-lantern} The Missing Lantern: Three clues left..");
    const at = (needle: string) => messages.findIndex((m) => m.content.startsWith(needle));
    expect(at("### Current Game State")).toBeLessThan(at("[COMPENDIUM STORYBOARDS CONTEXT]"));
    expect(at("[COMPENDIUM STORYBOARDS CONTEXT]")).toBeLessThan(messages.findIndex((m) => m.content === "Evening."));
  });

  test("a Storyboard that is off, or has nothing to say, or is set Off, sends nothing; Map and Renown start Off and Map speaks once chosen", async () => {
    const s = await boardScene([plot, place]);
    await s.turn();
    expect(heard(s.sent[0]!)).toBeUndefined();
    await s.chats.setProps(s.chat.id, { on: ["tracker-map", "tracker-renown", "tracker-quests"] });
    await s.chats.setTracker(s.chat.id, "quests", { context: "never" });
    await s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content: "Again" });
    await s.turn();
    expect(heard(s.sent[1]!)).toBeUndefined();
    await s.chats.setTracker(s.chat.id, "map", { context: "always", data: { mode: "compact" } });
    await s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content: "Once more" });
    await s.turn();
    expect(heard(s.sent[2]!)!.content).toContain("--- Harbor / Map / Compact ---\n[MAP]");
    expect(heard(s.sent[2]!)!.content).not.toContain("Quest Board");
    expect(heard(s.sent[2]!)!.content).not.toContain("Renown");
  });

  test("a book the scene may only write to is never read into the prompt", async () => {
    const s = await boardScene([plot], { access: "write_only" });
    await s.chats.setProps(s.chat.id, { on: ["tracker-quests"] });
    await s.turn();
    expect(heard(s.sent[0]!)).toBeUndefined();
  });
});

describe("a turn with the Combat tracker", () => {
  test("a fight in progress sends RoleCall's Combat line, with the turn named and a removed enemy left out, after the Stats line; no fight sends nothing", async () => {
    const s = await scene();
    await s.chats.setProps(s.chat.id, { on: ["tracker-resources", "tracker-battle"] });
    const gone = { id: "e2", name: "Rat", hp: 5, maxHp: 5, isBoss: false, statusEffects: [], threat: "low", removedAt: 9 };
    await s.keep("resources", hurt);
    await s.keep("battle", { inCombat: false, enemies: [], turnOrder: [], currentTurn: null, log: [], round: 0, dice: [] });
    await s.turn();
    expect(sentTrackers(s.sent[0]!)[0]!.content).not.toContain("**Combat**");
    await s.keep("battle", { inCombat: true, enemies: [{ id: "e1", name: "Gorm", hp: 30, maxHp: 50, isBoss: true, statusEffects: [], threat: "high" }, gone], turnOrder: ["e1"], currentTurn: "e1", log: [], round: 3, dice: [] });
    await s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content: "Strike" });
    await s.turn();
    const lines = sentTrackers(s.sent[1]!)[0]!.content.split("\n");
    expect(lines.at(-1)).toBe("**Combat**: In combat! Round 3 | Turn: Gorm | Enemies: Gorm (HP 30/50, high threat)");
    expect(lines.findIndex((l) => l.startsWith("**Player**"))).toBeLessThan(lines.findIndex((l) => l.startsWith("**Combat**")));
  });
});

describe("a turn with the Inventory tracker", () => {
  const item = (id: string, over: Record<string, unknown>) => ({ id, name: "Rusty Key", description: "x", category: "key", rarity: "common", quantity: 1, obtainedAt: 1, ...over });
  test("what is carried is sent as RoleCall's Inventory block, a deleted item is left out, and an empty inventory sends nothing", async () => {
    const s = await scene();
    await s.chats.setProps(s.chat.id, { on: ["tracker-inventory"] });
    await s.keep("inventory", { items: [], equipment: {}, currency: 0 });
    await s.turn();
    expect(s.sent[0]!.messages.some((m) => String(m.content).includes("[MECHANICS: INVENTORY]"))).toBe(false);
    await s.keep("inventory", { items: [item("a", { name: "Fire Sword", category: "weapon", rarity: "rare" }), item("b", { name: "Old Map", removedAt: 5 })], equipment: {}, currency: 12 });
    await s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content: "Look" });
    await s.turn();
    const block = sentTrackers(s.sent[1]!)[0]!.content;
    expect(block).toContain("[MECHANICS: INVENTORY]\nPreset: freeform\nCurrency: 12\nCarried:\n- Fire Sword | weapon | rare");
    expect(block).not.toContain("Old Map");
  });
  test("switched off, it sends nothing however much it kept", async () => {
    const s = await scene();
    await s.keep("inventory", { items: [item("a", {})], equipment: {}, currency: 0 });
    await s.turn();
    expect(s.sent[0]!.messages.some((m) => String(m.content).includes("[MECHANICS: INVENTORY]"))).toBe(false);
  });
});

describe("a turn with the Spellbook tracker", () => {
  const spell = { id: "s1", name: "Firebolt", template: "attack", description: "d", level: 3, status: "learned", cooldownRemaining: 2 };
  const NOTE = '[SPELL CAST] The player invokes "Firebolt" (attack, Level 3).';
  const book = () => ({ spells: [spell], subs: {}, pendingCast: NOTE });
  test("a cast waiting for the next reply rides it once and is then spent; the reply that carried it does not count down a cooldown", async () => {
    const s = await scene();
    await s.chats.setProps(s.chat.id, { on: ["tracker-spellbook"] });
    await s.keep("spellbook", book());
    await s.turn();
    expect(s.sent[0]!.messages.filter((m) => m.content === NOTE)).toHaveLength(1);
    const after = (await s.read("spellbook")) as { spells: { cooldownRemaining: number }[]; pendingCast?: string };
    expect(after.pendingCast).toBeUndefined();
    expect(after.spells[0]!.cooldownRemaining).toBe(2);
    await s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content: "Again" });
    await s.turn();
    expect(s.sent[1]!.messages.some((m) => m.content === NOTE)).toBe(false);
    expect(((await s.read("spellbook")) as { spells: { cooldownRemaining: number }[] }).spells[0]!.cooldownRemaining).toBe(1);
  });
  test("the countdown is the reply's own: a new version of the reply ticks once, not twice, and a cut reply takes its tick with it", async () => {
    const s = await scene();
    await s.chats.setProps(s.chat.id, { on: ["tracker-spellbook"] });
    await s.keep("spellbook", { spells: [spell], subs: {} });
    const cooling = async () => ((await s.read("spellbook")) as { spells: { cooldownRemaining: number }[] }).spells[0]!.cooldownRemaining;
    await s.turn();
    expect(await cooling()).toBe(1);
    const reply = (await s.chats.readMessagesBefore(s.chat.activeBranchId, { limit: 1, liveOnly: true })).messages[0]!;
    const version = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 1 })).branchVersion!;
    const { runTurn } = await import("./scene-turn");
    await runTurn(s.deps, { chatId: s.chat.id, kind: "swipe", expectedVersion: version }, () => undefined);
    await runTurn(s.deps, { chatId: s.chat.id, kind: "swipe", expectedVersion: (await s.chats.readMessages(s.chat.activeBranchId, { limit: 1 })).branchVersion! }, () => undefined);
    expect(await cooling()).toBe(1);
    await s.chats.selectSwipe(reply.id, 0);
    expect(await cooling()).toBe(1);
    await s.chats.cutMessages(s.chat.activeBranchId, reply.id, "one");
    expect(await cooling()).toBe(2);
  });
  test("a continue does not run the countdown again", async () => {
    const s = await scene();
    await s.chats.setProps(s.chat.id, { on: ["tracker-spellbook"] });
    await s.keep("spellbook", { spells: [spell], subs: {} });
    await s.turn();
    const { runTurn } = await import("./scene-turn");
    await runTurn(s.deps, { chatId: s.chat.id, kind: "continue", expectedVersion: (await s.chats.readMessages(s.chat.activeBranchId, { limit: 1 })).branchVersion! }, () => undefined);
    expect(((await s.read("spellbook")) as { spells: { cooldownRemaining: number }[] }).spells[0]!.cooldownRemaining).toBe(1);
  });
  test("a turn that fails keeps the cast and the cooldown for the retry", async () => {
    const s = await scene();
    await s.chats.setProps(s.chat.id, { on: ["tracker-spellbook"] });
    await s.keep("spellbook", book());
    s.flags.failing = true;
    await s.turn();
    const kept = (await s.read("spellbook")) as { spells: { cooldownRemaining: number }[]; pendingCast?: string };
    expect(kept.pendingCast).toBe(NOTE);
    expect(kept.spells[0]!.cooldownRemaining).toBe(2);
    s.flags.failing = false;
    await s.turn();
    expect(s.sent.at(-1)!.messages.filter((m) => m.content === NOTE)).toHaveLength(1);
    expect(((await s.read("spellbook")) as { pendingCast?: string }).pendingCast).toBeUndefined();
  });
  test("a Spellbook that is off neither sends nor counts down", async () => {
    const s = await scene();
    await s.keep("spellbook", book());
    await s.turn();
    expect(s.sent[0]!.messages.some((m) => m.content === NOTE)).toBe(false);
    const kept = (await s.read("spellbook")) as { spells: { cooldownRemaining: number }[]; pendingCast?: string };
    expect(kept.pendingCast).toBe(NOTE);
    expect(kept.spells[0]!.cooldownRemaining).toBe(2);
  });
});

describe("every legacy tracker that keeps something reaches the request, in RoleCall's order, only while its Prop is on", () => {
  const state = {
    party: { name: "Adventuring Party", members: [{ name: "Brann", combatRole: "tank", formationPosition: "front", hp: 5, maxHp: 9, mp: 1, maxMp: 2, level: 1, profileId: "m1", isOnline: true, isLeader: false }], formation: { mode: "lanes", lanes: { front: ["m1"], mid: [], back: [] } }, tactics: { preset: "balanced", conserveMana: false, focus: "auto" }, sharedCurrency: 0, currencySplit: "shared" },
    inventory: { items: [{ id: "i1", name: "Lamp", description: "", category: "misc", rarity: "common", quantity: 1, obtainedAt: 1 }], equipment: {}, currency: 3 },
    corruption: { values: { corruption: 60, submission: 60, dependence: 60, obsession: 60, identityLoss: 60 }, log: [], npcs: [] },
    bonds: { bonds: [{ id: "b1", bondType: "soul_link", partnerName: "Vera", intensityValue: 60, activeEffects: [], canBeBroken: true, isActive: true, formedAt: 1 }] },
    knowledge: { entries: [{ id: "k1", subject: "The Duke", content: "x", reliability: "certain", category: "fact", learnedAt: 1 }], subs: {} },
    events: { events: [{ id: "e1", title: "Siege", description: "", locationName: "Fort", urgency: "high", canIntervene: true, involvedNpcs: [], startedAt: 1, isOngoing: true }] },
    spellbook: { spells: [{ id: "s1", name: "Firebolt", template: "attack", description: "", level: 1, status: "learned" }], subs: {} },
    codex: { species: [{ id: "x1", name: "Moth", classification: "Beast", rarity: "rare", disposition: "neutral", habitat: "Caves", description: "", appearance: "", baseTraits: [], baseBehaviors: [] }], creatures: [], subs: {} },
    memories: { memories: [{ id: "m1", npcName: "Vera", content: "The Promise: x", category: "promise", emotionalWeight: "minor", sentiment: "positive", timestamp: 1 }] },
    cycles: { cycles: [{ id: "c1", characterName: "Vera", cycleType: "heat", currentPhase: "Peak", intensity: 70 }], subs: {} },
  } as const;
  test("their lines come after Stats, in the order the module list gives, and none appear with the Props off", async () => {
    const s = await scene();
    for (const [module, data] of Object.entries(state)) await s.keep(module as never, data);
    await s.turn();
    expect(sentTrackers(s.sent[0]!)).toHaveLength(0);
    await s.chats.setProps(s.chat.id, { on: Object.keys(state).map((m) => `tracker-${m}`) });
    await s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content: "Again" });
    await s.turn();
    const text = sentTrackers(s.sent[1]!)[0]!.content;
    const heads = ["**Party**", "[MECHANICS: INVENTORY]", "**Corruption**", "**Bonds**", "**Knowledge**", "**Parallel Events**", "**Spellbook**", "**Creature Codex**", "**Memory Journal**", "**Biological Cycles**"];
    const at = heads.map((h) => text.indexOf(h));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });
});
