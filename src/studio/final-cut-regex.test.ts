/**
 * Final Cut's "Apply your AI-output regex scripts to input" (RoleCall PostProductionPanel.tsx:1484-1491, service.ts:322-334). The scene's
 * display-phase rules are imported data, so they run only in the page's sandbox worker (ADR-009): the stage asks the page with a regex
 * event and uses the answer. It runs no rule itself, fails closed, and a scene with no such rule asks nothing.
 */
import { describe, expect, test } from "bun:test";
import { createTurnRuntime } from "./scene-turn-runtime";
import type { RegexSetBody } from "../entities/regex/schema";
import type { TurnEvent } from "./scene-turn";
import { answerRegex } from "./scene-turn-regex";
import { FinalCutRegexError, finalCutRegexInput } from "./final-cut-regex";

const rule = (id: string, over: Record<string, unknown> = {}) => ({ id, label: id, find: "cold", flags: "g", replace: "warm", phases: ["display"], enabled: true, sortOrder: 0, ...over });
const set = (...rules: ReturnType<typeof rule>[]): RegexSetBody => ({ name: "s", rules } as unknown as RegexSetBody);

function rig(sets: Record<string, RegexSetBody | null>, signal = new AbortController().signal) {
  const runtime = createTurnRuntime();
  const events: TurnEvent[] = [];
  const make = () => finalCutRegexInput({ runtime, setIds: Object.keys(sets), readRegex: async (id) => sets[id] ?? null, turnId: "t1", chatId: "c1", names: { user: "Ann", char: "Vera" }, signal, emit: (e) => events.push(e) });
  return { runtime, events, make };
}
const tick = () => new Promise((r) => setTimeout(r, 5));

describe("finalCutRegexInput", () => {
  test("asks the page to run the scene's display rules on a pass's input and uses its answer", async () => {
    const r = rig({ s1: set(rule("r1")) });
    const prep = (await r.make())!;
    const out = prep("The cold came.");
    await tick();
    const asked = r.events[0] as Extract<TurnEvent, { type: "regex" }>;
    expect(asked.type).toBe("regex");
    expect(asked.phase).toBe("display");
    expect(asked.rules.map((x) => x.id)).toEqual(["0:r1"]);
    expect(asked.items).toEqual([{ index: 0, role: "assistant", depth: 0, text: "The cold came." }]);
    expect(asked.macros).toEqual({ user: "Ann", char: "Vera" });
    expect(answerRegex(r.runtime, "c1", "t1", { kind: "done", texts: { 0: "The warm came." } })).toBe(true);
    expect(await out).toBe("The warm came.");
  });
  test("a text the page leaves alone comes back unchanged, and each pass asks again", async () => {
    const r = rig({ s1: set(rule("r1")) });
    const prep = (await r.make())!;
    const one = prep("a");
    await tick();
    answerRegex(r.runtime, "c1", "t1", { kind: "done", texts: {} });
    expect(await one).toBe("a");
    const two = prep("b");
    await tick();
    expect(r.events).toHaveLength(2);
    answerRegex(r.runtime, "c1", "t1", { kind: "done", texts: { 0: "B" } });
    expect(await two).toBe("B");
  });
  test("no sets, no display rule, only disabled or prompt-only rules, or overlay rules: nothing is asked", async () => {
    expect(await rig({}).make()).toBeNull();
    expect(await rig({ s1: set(rule("p", { phases: ["prompt"] })) }).make()).toBeNull();
    expect(await rig({ s1: set(rule("d", { enabled: false })) }).make()).toBeNull();
    expect(await rig({ s1: set(rule("o", { overlay: true })) }).make()).toBeNull();
    expect(await rig({ s1: null }).make()).toBeNull();
  });
  test("a worker that cannot run, an answer for a text not asked about, or Stop is an error, never the unchanged text", async () => {
    const r = rig({ s1: set(rule("r1")) });
    const prep = (await r.make())!;
    const failed = prep("x");
    await tick();
    answerRegex(r.runtime, "c1", "t1", { kind: "failed", error: "blocked by policy" });
    await expect(failed).rejects.toThrow(FinalCutRegexError);
    const odd = prep("x");
    await tick();
    answerRegex(r.runtime, "c1", "t1", { kind: "done", texts: { 5: "y" } });
    await expect(odd).rejects.toThrow("not asked about");
    const stop = new AbortController();
    const s = rig({ s1: set(rule("r1")) }, stop.signal);
    const prep2 = (await s.make())!;
    const cancelled = prep2("x");
    await tick();
    stop.abort();
    await expect(cancelled).rejects.toThrow(FinalCutRegexError);
  });
});
