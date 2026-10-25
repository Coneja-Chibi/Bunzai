/**
 * The trackers' block of the request (RoleCall worker.ts:2426-2461, immersion-context.ts): which tracker Props put their state in front of the
 * model, where, and when. Every expectation is the exact list of messages. VVS-825's rule is pinned here: a tracker that is off adds nothing.
 */
import { describe, expect, test } from "bun:test";
import type { CharacterBody } from "../../entities/character/schema";
import type { ChatTrackers } from "../../stage/contracts/chat-tracker-types";
import { assemble } from "./assemble";
import type { AssemblyGuide } from "./guides";
import { TRACKERS_HEADER, trackersText } from "./trackers";
import type { AssemblyInput, HistoryMessage } from "./types";

const card = { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } as CharacterBody;
const msg = (id: string, role: HistoryMessage["role"], content: string): HistoryMessage => ({ id, role, content });
const input = (over: Partial<AssemblyInput> = {}): AssemblyInput => ({
  character: card,
  history: [msg("g", "assistant", "Evening."), msg("u1", "user", "Hi"), msg("a1", "assistant", "Hello.")],
  current: msg("u2", "user", "Any storms?"),
  localVariables: new Map(),
  globalVariables: new Map(),
  now: Date.UTC(2026, 9, 12),
  randomSeed: 1,
  ...over,
});
const lines = (over: Partial<AssemblyInput> = {}) => assemble(input(over)).messages.map((m) => `${m.role}:${m.content}`);
const PLAYER = "**Player**: Level 1 | HP 100/100 | MP 50/50 | AP 3/3 | XP 0 | Gold 100";
const BLOCK = `system:${TRACKERS_HEADER}\n\n${PLAYER}`;
const BASE = ["system:Keeps the light.", "assistant:Evening.", "user:Hi", "assistant:Hello.", "user:Any storms?"];
const on = (entries: ChatTrackers = {}, props: string[] = ["tracker-resources"]) => ({ trackers: { entries, on: props } });

describe("a tracker that is on", () => {
  test("rides as one system message after the leading system messages and before the conversation, headed as RoleCall heads it", () => {
    expect(lines(on())).toEqual(["system:Keeps the light.", BLOCK, ...BASE.slice(1)]);
  });

  test("a module nothing has changed in reads as its defaults, and one that kept a change says so", () => {
    const entries: ChatTrackers = { resources: { data: { hp: 40, maxHp: 100, mp: 50, maxMp: 50, ap: 3, maxAp: 3, shield: 0, xp: 0, level: 1, currency: 100, needs: {}, log: [] } } };
    expect(lines(on(entries))[1]).toContain("HP 40/100");
  });

  test("it follows the guides' system block, so the guides stay where they were", () => {
    const g: AssemblyGuide = { id: "g1", content: "Be brief.", role: "system", mode: "standard" };
    expect(lines({ ...on(), guides: [g] }).slice(0, 4)).toEqual(["system:Keeps the light.", "system:[Take the following into special consideration for your next message: Be brief.]", BLOCK, "assistant:Evening."]);
  });

  test("it is traced as its own source, so the Tokens sheet can show what it cost", () => {
    const result = assemble(input(on()));
    const traced = result.trace.find((t) => t.source.kind === "trackers");
    expect(traced?.role).toBe("system");
    expect(traced?.tokens).toBeGreaterThan(0);
  });
});

describe("a tracker that adds nothing", () => {
  test("is off: its state is kept but the prompt never sees it (VVS-825)", () => {
    const entries: ChatTrackers = { resources: { data: { hp: 1, maxHp: 100, mp: 50, maxMp: 50, ap: 3, maxAp: 3, shield: 0, xp: 0, level: 1, currency: 100, needs: {}, log: [] } } };
    expect(lines(on(entries, []))).toEqual(BASE);
    expect(lines({})).toEqual(BASE);
  });

  test("has AI Context set to Never", () => {
    expect(lines(on({ resources: { context: "never" } }))).toEqual(BASE);
  });
});

describe("AI Context cadence (immersion-context.ts:46-62)", () => {
  const due = (context: "always" | "every2" | "every5" | "never", turn: number): boolean => trackersText({ entries: { resources: { context } }, on: ["tracker-resources"] }, turn) !== "";
  test("Every 2 Turns rides on even turn numbers, Every 5 on multiples of five, Always on all, and turn 0 counts as due", () => {
    expect([1, 2, 3, 4].map((t) => due("every2", t))).toEqual([false, true, false, true]);
    expect([4, 5, 10].map((t) => due("every5", t))).toEqual([false, true, true]);
    expect([1, 2].map((t) => due("always", t))).toEqual([true, true]);
    expect(due("every2", 0)).toBe(true);
  });

  test("the turn counts the user messages including the one being answered", () => {
    // history holds one user message, the current is the second: turn 2, so Every 2 Turns rides.
    expect(lines(on({ resources: { context: "every2" } }))[1]).toBe(BLOCK);
    // two earlier user messages and the current: turn 3.
    const longer = [msg("g", "assistant", "Evening."), msg("u1", "user", "Hi"), msg("a1", "assistant", "Hello."), msg("u2", "user", "More"), msg("a2", "assistant", "Yes.")];
    expect(lines({ ...on({ resources: { context: "every2" } }), history: longer, current: msg("u3", "user", "Storms?") })).not.toContain(BLOCK);
  });
});

describe("a note the Spellbook is holding for the next reply (RoleCall worker.ts:2463)", () => {
  const book = (pending: string | undefined) => ({ spellbook: { data: { spells: [], subs: {}, ...(pending ? { pendingCast: pending } : {}) } } }) as ChatTrackers;
  const NOTE = '[SPELL CAST] The player invokes "Firebolt" (attack, Level 3).';
  test("rides as its own system message right after the trackers' block, and is traced with it", () => {
    const result = assemble(input(on(book(NOTE), ["tracker-resources", "tracker-spellbook"])));
    const texts = result.messages.map((m) => `${m.role}:${m.content}`);
    expect(texts.slice(0, 3)).toEqual(["system:Keeps the light.", BLOCK, `system:${NOTE}`]);
    expect(result.trace.filter((t) => t.source.kind === "trackers")).toHaveLength(2);
  });
  test("is sent with no other tracker on; nothing when the Spellbook is off, holds no note, or its AI Context is Never", () => {
    expect(lines(on(book(NOTE), ["tracker-spellbook"]))).toEqual(["system:Keeps the light.", `system:${NOTE}`, ...BASE.slice(1)]);
    expect(lines(on(book(NOTE), []))).toEqual(BASE);
    expect(lines(on(book(undefined), ["tracker-spellbook"]))).toEqual(BASE);
    expect(lines(on({ spellbook: { ...book(NOTE).spellbook!, context: "never" } }, ["tracker-spellbook"]))).toEqual(BASE);
  });
});
