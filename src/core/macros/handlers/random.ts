/**
 * Random and dice macros: RoleCall's handler inside
 * ADR-012.
 *
 * Changed from RoleCall, and why:
 * - Every `Math.random()` call becomes `run.random()`, in the same order and count. RoleCall's
 *   `SeededRandom`/`context.randomSeed` branch never actually ran: no caller in RoleCall (including
 *   the parity recorder) ever sets `context.randomSeed`, so `getRandom` always fell through to
 *   `Math.random()`, which the recording seeded with this engine's own mulberry32 stream
 *   (tools/rc-recorder/record-macros.test.ts). Dropping the dead seeded-LCG branch changes no
 *   recorded output.
 * - `{{random}}` (text mode), `{{pick}}`, `{{coinflip}}`, and `{{weighted}}` carry `choices`, so the
 *   preset preview can show the option that rolled. `{{random}}` in numeric-range mode has no
 *   discrete option list, so its `choices` returns `[]`; `{{roll}}`, `{{range}}`, `{{percent}}`, and
 *   `{{shuffle}}` don't pick one of a provided set, so they carry none.
 * - `{{pick}}`'s direct `context.localVariables.set(...)` is dropped: `evaluateMacro` (evaluate.ts)
 *   already applies a handler's returned `sideEffects` onto the map with `context.now`, so the
 *   handler writing it too was a same-value redundant write. The `localVariables.get(key)` read is
 *   kept: it's what records the touched-variable key.
 *
 * Found in RoleCall, kept as-is (parity, not a fix):
 * - `{{random::min::max}}` with min > max (e.g. `{{random::10::1}}`) computes `range = max - min + 1`,
 *   which goes negative; the result lands in `[min - range + 2, min]` and never reaches the true
 *   bottom of the (reversed) span. Not fixed here.
 * - `{{pick}}`'s `_pick_` key is stored as an ordinary chat variable, so a pick persists for the
 *   chat's life, not "per assembly" as its own comment claims. The definition also has no
 *   `hasSideEffects: true`. Not fixed here.
 * - `{{weighted}}`: a zero-weight first option can still win when the draw is exactly 0
 *   (`roll -= item.weight` leaves `roll` at 0, and `roll <= 0` is true). Not fixed here.
 */
import { readDice, rollDice } from "../../dice";
import type { HandlerRun, MacroContext, MacroDefinition, MacroResult } from "../types";

/** SillyTavern compat: split a single comma-bearing arg, honoring `\,` as a literal comma. */
function splitCommaArg(args: readonly string[]): string[] {
  const first = args[0];
  if (args.length !== 1 || first === undefined || !first.includes(",")) return [...args];
  const PLACEHOLDER = "\x00COMMA\x00";
  return first
    .replace(/\\,/g, PLACEHOLDER)
    .split(",")
    .map((item) => item.trim().replaceAll(PLACEHOLDER, ","));
}

/** 3+ options, or any non-numeric option: {{random}} behaves like {{pick}} (SillyTavern compat). */
const isTextMode = (args: readonly string[]): boolean =>
  args.length >= 3 || (args.length > 0 && args.some((a) => Number.isNaN(Number(a))));

const randomMacro: MacroDefinition = {
  name: "random",
  aliases: ["rand"],
  description: "Random integer. {{random}} for 0-100, {{random::min::max}} for range, {{random::opt1::opt2::opt3}} to pick one",
  args: [
    { name: "min", description: "Minimum value (default 0)", required: false, defaultValue: "0" },
    { name: "max", description: "Maximum value (default 100)", required: false, defaultValue: "100" },
  ],
  category: "random",
  choices: (args) => {
    const effective = splitCommaArg(args);
    return isTextMode(effective) ? effective : [];
  },
  handler: (args: string[], _context: MacroContext, run: HandlerRun): MacroResult => {
    const effective = splitCommaArg(args);
    if (isTextMode(effective) && effective.length > 0) {
      const index = Math.floor(run.random() * effective.length);
      return { value: effective[index] ?? "", success: true };
    }

    const min = parseInt(effective[0] || "0", 10);
    const max = parseInt(effective[1] || "100", 10);
    if (Number.isNaN(min) || Number.isNaN(max)) {
      return { value: "", success: false, error: "Invalid min/max values" };
    }
    const range = max - min + 1;
    const value = Math.floor(run.random() * range) + min;
    return { value: value.toString(), success: true };
  },
};

/** Deterministic key for one option-set: sorted so {{pick::a::b}} and {{pick::b::a}} share a slot. */
const pickKey = (options: readonly string[]): string => "_pick_" + [...options].sort().join("\x01");

const pickMacro: MacroDefinition = {
  name: "pick",
  aliases: ["choose", "select"],
  description: "Pick a random option from the provided list. Same options always return the same pick within one context.",
  args: [{ name: "options", description: "Options to pick from (multiple)", required: true }],
  category: "random",
  choices: (args) => splitCommaArg(args),
  handler: (args: string[], context: MacroContext, run: HandlerRun): MacroResult => {
    const effective = splitCommaArg(args);
    if (effective.length === 0) return { value: "", success: false, error: "No options provided" };

    const key = pickKey(effective);
    const existing = context.localVariables.get(key);
    if (existing !== undefined) return { value: String(existing.value), success: true };

    const index = Math.floor(run.random() * effective.length);
    const picked = effective[index] ?? "";
    if (context.readOnly) return { value: picked, success: true };

    return { value: picked, success: true, sideEffects: [{ type: "setLocalVar", key, value: picked }] };
  },
};

const rollMacro: MacroDefinition = {
  name: "roll",
  aliases: ["dice"],
  description: "Roll dice in NdS format (e.g., 2d6, 1d20+5)",
  args: [{ name: "dice", description: "Dice notation like 2d6 or 1d20+5", required: true }],
  category: "random",
  handler: (args: string[], _context: MacroContext, run: HandlerRun): MacroResult => {
    const diceStr = args[0];
    if (!diceStr) return { value: "", success: false, error: "No dice notation provided" };
    const dice = readDice(diceStr);
    if (!dice) return { value: "", success: false, error: `Invalid dice notation: ${diceStr}` };
    if (dice.count < 1 || dice.count > 100) return { value: "", success: false, error: "Number of dice must be between 1 and 100" };
    if (dice.sides < 1 || dice.sides > 99999) return { value: "", success: false, error: "Dice sides must be between 1 and 99999" };
    return { value: rollDice(dice, () => run.random()).total.toString(), success: true };
  },
};

const rangeMacro: MacroDefinition = {
  name: "range",
  description: "Pick a random number from range with optional step",
  args: [
    { name: "start", description: "Start of range", required: true },
    { name: "end", description: "End of range", required: true },
    { name: "step", description: "Step size (default 1)", required: false, defaultValue: "1" },
  ],
  category: "random",
  handler: (args: string[], _context: MacroContext, run: HandlerRun): MacroResult => {
    const start = parseFloat(args[0] ?? "");
    const end = parseFloat(args[1] ?? "");
    const step = parseFloat(args[2] || "1");
    if (Number.isNaN(start) || Number.isNaN(end) || Number.isNaN(step)) {
      return { value: "", success: false, error: "Invalid range parameters" };
    }
    if (step <= 0) return { value: "", success: false, error: "Step must be positive" };

    const numSteps = Math.floor((end - start) / step) + 1;
    const randomStep = Math.floor(run.random() * numSteps);
    const value = start + randomStep * step;
    const formatted = Number.isInteger(value) ? value.toString() : value.toFixed(2);
    return { value: formatted, success: true };
  },
};

const coinflipMacro: MacroDefinition = {
  name: "coinflip",
  aliases: ["coin", "flip"],
  description: 'Flip a coin (Heads/Tails) or custom binary choice',
  args: [
    { name: "heads", description: 'Value for heads (default "Heads")', required: false },
    { name: "tails", description: 'Value for tails (default "Tails")', required: false },
  ],
  category: "random",
  choices: (args) => [args[0] || "Heads", args[1] || "Tails"],
  handler: (args: string[], _context: MacroContext, run: HandlerRun): MacroResult => {
    const heads = args[0] || "Heads";
    const tails = args[1] || "Tails";
    return { value: run.random() < 0.5 ? heads : tails, success: true };
  },
};

const percentMacro: MacroDefinition = {
  name: "percent",
  aliases: ["pct"],
  description: "Random percentage from 0 to 100",
  category: "random",
  handler: (_args: string[], _context: MacroContext, run: HandlerRun): MacroResult => ({
    value: Math.floor(run.random() * 101).toString(),
    success: true,
  }),
};

const shuffleMacro: MacroDefinition = {
  name: "shuffle",
  description: "Shuffle items and return all in random order",
  args: [{ name: "items", description: "Items to shuffle", required: true }],
  category: "random",
  handler: (args: string[], _context: MacroContext, run: HandlerRun): MacroResult => {
    if (args.length === 0) return { value: "", success: false, error: "No items to shuffle" };
    const items = [...args];
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(run.random() * (i + 1));
      const a = items[i] as string;
      const b = items[j] as string;
      items[i] = b;
      items[j] = a;
    }
    return { value: items.join(", "), success: true };
  },
};

const weightedMacro: MacroDefinition = {
  name: "weighted",
  description: "Pick from weighted options (item::weight pairs)",
  args: [{ name: "pairs", description: "Alternating item::weight pairs", required: true }],
  category: "random",
  choices: (args) => args.filter((_, i) => i % 2 === 0),
  handler: (args: string[], _context: MacroContext, run: HandlerRun): MacroResult => {
    if (args.length < 2 || args.length % 2 !== 0) return { value: "", success: false, error: "Need pairs of item::weight" };

    const items: Array<{ value: string; weight: number }> = [];
    let totalWeight = 0;
    for (let i = 0; i < args.length; i += 2) {
      const value = args[i] ?? "";
      const weightArg = args[i + 1];
      const weight = parseFloat(weightArg ?? "");
      if (Number.isNaN(weight) || weight < 0) return { value: "", success: false, error: `Invalid weight: ${weightArg}` };
      items.push({ value, weight });
      totalWeight += weight;
    }
    if (totalWeight === 0) return { value: "", success: false, error: "Total weight cannot be zero" };

    let roll = run.random() * totalWeight;
    for (const item of items) {
      roll -= item.weight;
      if (roll <= 0) return { value: item.value, success: true };
    }
    return { value: items[items.length - 1]?.value ?? "", success: true };
  },
};

export const RANDOM_MACROS: readonly MacroDefinition[] = [
  randomMacro,
  pickMacro,
  rollMacro,
  rangeMacro,
  coinflipMacro,
  percentMacro,
  shuffleMacro,
  weightedMacro,
];
