/**
 * The Send-time assembly budget: `assemble()` must not scale
 * with a scene's whole stored history, only with what the budget can possibly keep. Builds a
 * synthetic 4,000-message scene (a real, non-trivial preset, a card with a depth note, and a token
 * measure that calls the real tokenizer, the same shape `scene-turn.ts`'s live path uses) and times
 * one assembly. Exported so `perf-gate.ts` can fold it into its own results table; also runnable on
 * its own for a quick before/after check while iterating on `budget-app.ts`'s pre-trim.
 */
import type { CharacterBody } from "../src/entities/character/schema";
import type { PresetBody, PresetPrompt } from "../src/entities/preset/schema";
import { assemble } from "../src/core/assembly/assemble";
import { appBudgeter } from "../src/core/assembly/budget-app";
import type { HistoryMessage } from "../src/core/assembly/types";
import { countFramed, countPrompt, estimate, estimatePart, newCalibration } from "../src/core/tokens";
import { mulberry32 } from "../src/core/lore/rng";
import { sampleWords } from "./scale/word-sampler";

const WORDS = "lamp oil gull rail salt storm keeper stair window kettle ship harbor tide rope chart the a is was".split(" ");
function prose(rand: () => number, words: number): string {
  return sampleWords(rand, WORDS, words).join(" ");
}

const block = (id: string, content: string, over: Partial<PresetPrompt> = {}): PresetPrompt => ({
  id,
  name: id,
  content,
  role: "system",
  enabled: true,
  systemPrompt: true,
  marker: false,
  placement: "relative",
  injectionDepth: 4,
  injectionOrder: 100,
  forbidOverrides: false,
  ...over,
});

/** A preset with the shapes real ones carry: several relative prompts, two in-chat blocks (so the
 * intermediate woven macro pass runs) and an append block, so this exercises more than the bare
 * default set. */
const PRESET: PresetBody = {
  name: "Gate preset",
  prompts: [
    block("desc", "{{description}}"),
    block("pers", "{{personality}}"),
    block("scenario", "{{scenario}}"),
    block("lore", "{{lore}}"),
    block("examples", "{{mesExamples}}"),
    block("history", "{{message_history}}", { placement: "in_chat", injectionDepth: 0 }),
    block("style", "Stay in character.", { placement: "in_chat", injectionDepth: 3, role: "system" }),
    block("recap", "Recap the scene so far.", { placement: "append", injectionDepth: 6, role: "user" }),
  ],
};

const CARD: CharacterBody = {
  identity: { name: "Vera", description: "Vera keeps the lighthouse at Gull Point." },
  persona: { personality: "Dry and patient.", scenario: "A storm night." },
  prompts: { depthInjections: [{ text: "The storm is getting worse.", depth: 5 }] },
  greetings: {},
  examples: { exampleMessages: "Vera: Evening.\nYou: Any storms?\nVera: Not yet." },
  media: {},
  attribution: {},
  discovery: {},
};

function scene(turns: number): HistoryMessage[] {
  const rand = mulberry32(turns);
  const history: HistoryMessage[] = [{ id: "g", role: "assistant", content: "Evening. The lighthouse beam sweeps the water." }];
  for (let i = 0; i < turns; i++) history.push({ id: `h${i}`, role: i % 2 ? "assistant" : "user", content: prose(rand, 20 + Math.floor(rand() * 60)) });
  return history;
}

/**
 * Assembles a `turns`-message scene once, history already built (so a caller timing this call never
 * also times this file's own synthetic-scene generation). A realistic calibration measure (the same
 * `estimate`/`estimatePart` the live meter uses), not a toy character count.
 */
export function assembleScene(turns: number): void {
  const cal = newCalibration("gemini", 0);
  const measure = { whole: (texts: readonly string[]) => estimate(cal, countPrompt(texts)).bound, part: (text: string) => estimatePart(cal, countFramed(text)).bound };
  const history = scene(turns);
  assemble({
    character: CARD,
    preset: PRESET,
    history,
    current: { id: "now", role: "user", content: "Any storms tonight?" },
    localVariables: new Map(),
    globalVariables: new Map(),
    now: 0,
    randomSeed: 1,
    window: { context: 8_000, reply: 1_000 },
    budgeter: appBudgeter(measure),
  });
}

/** `assembleScene`, timed around just the `assemble()` call (the scene itself is built first, same
 * as `assembleScene`, but outside the clock). */
export function timeAssembly(turns: number): number {
  const cal = newCalibration("gemini", 0);
  const measure = { whole: (texts: readonly string[]) => estimate(cal, countPrompt(texts)).bound, part: (text: string) => estimatePart(cal, countFramed(text)).bound };
  const history = scene(turns);
  const started = performance.now();
  assemble({
    character: CARD,
    preset: PRESET,
    history,
    current: { id: "now", role: "user", content: "Any storms tonight?" },
    localVariables: new Map(),
    globalVariables: new Map(),
    now: 0,
    randomSeed: 1,
    window: { context: 8_000, reply: 1_000 },
    budgeter: appBudgeter(measure),
  });
  return performance.now() - started;
}

/**
 * The median of `reps` timed calls to `assembleScene(turns)`. A single cold sample of this size (a
 * few tens of ms) is noisy enough on a shared machine (AGENTS.md: "treat single numbers as plus or
 * minus 20%") to make a 50 ms gate flaky either way; the median of a handful of back-to-back calls
 * is what `perf-gate.ts` actually gates on.
 */
export function medianAssemblyMs(turns: number, reps = 7): number {
  const times: number[] = [];
  for (let i = 0; i < reps; i++) {
    const started = performance.now();
    assembleScene(turns);
    times.push(performance.now() - started);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)]!;
}

if (import.meta.main) {
  const BUDGET_MS = 50;
  // One warm-up run first: gpt-tokenizer's module init and the JIT's first pass through assemble()
  // are one-time costs that have nothing to do with history length, and would otherwise swamp a
  // single cold measurement (this file's own first version measured 400 messages slower than 4,000
  // for exactly this reason). The reported numbers are medians (medianAssemblyMs's own docblock): a
  // single sample is noisy enough to flip a 50 ms gate either way.
  timeAssembly(50);
  const at400 = medianAssemblyMs(400);
  const at4000 = medianAssemblyMs(4_000);
  console.log(`assemble() at 400 messages: ${at400.toFixed(1)} ms (median of 7)`);
  console.log(`assemble() at 4,000 messages: ${at4000.toFixed(1)} ms (median of 7, budget ${BUDGET_MS} ms)`);
  if (at4000 > BUDGET_MS) {
    console.log("perf-gate-assembly: OVER budget");
    process.exit(1);
  }
  console.log("perf-gate-assembly: within budget");
}
