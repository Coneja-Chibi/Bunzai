/**
 * The tree-walking evaluator: RoleCall's handler inside ADR-012.
 *
 * RoleCall's behavior, kept exactly: args evaluate depth-first and trimmed; a lazy handler gets its
 * args unevaluated; a result carrying macros is normalized and evaluated again, one level down; an
 * unknown or failing macro renders as its reconstructed text and records an error; side effects
 * apply at once so later macros in the same run see them; block-if evaluates only the branch taken.
 *
 * Changed, with the reason:
 * - Bounds (ADR-012, limits.ts): depth 100 as RoleCall, plus a cap on the length of any string a
 *   node, handler, variable write, or whole run produces and a step budget, all of which RoleCall
 *   lacks. When one trips, the run records one error and stops: no handler is called after the
 *   breach, a lazy handler is unwound out of the arg that tripped it before it can write, and no
 *   cut-off value reaches a variable or macro store. An expansion bomb stops with an error, never a hang.
 * - Randomness is a seeded stream from `randomSeed` handed to handlers; timestamps come from
 *   `context.now`. Nothing ambient.
 * - RoleCall's interceptor hooks are gone: nothing in a turn registers one.
 * - RoleCall's parse cache is gone: parsing is not where assembly spends its time.
 */
import { mulberry32 } from "../lore/rng";
import { toErrorMessage } from "../../error-message";
import { evaluateConditionExpression, resolveConditionShorthands } from "./conditions";
import { normalizeMacroText } from "./normalize";
import { splitMacroArgs, parseMacroNodes, type ASTNode, type BlockIfNode, type MacroCallNode } from "./parse";
import { DEADLINE_MESSAGE, stopsRun } from "./deadline";
import { DEADLINE_CHECK_EVERY, MAX_EVAL_DEPTH, MAX_EVAL_STEPS, MAX_OUTPUT_CHARS } from "./limits";
import { getMacro, isVolatileMacro } from "./registry";
import type {
  HandlerRun,
  LazyMacroArg,
  MacroContext,
  MacroDefinition,
  MacroError,
  MacroExpansion,
  MacroResult,
  MacroSideEffect,
  GlobalWrite,
  MacroVariable,
} from "./types";

export { MAX_EVAL_DEPTH, MAX_EVAL_STEPS, MAX_OUTPUT_CHARS };

export interface EvalState {
  expansions: MacroExpansion[];
  errors: MacroError[];
  sideEffects: MacroSideEffect[];
  expansionCounter: number;
  touched: Set<string>;
  volatileHit: boolean;
  steps: number;
  /** A bound tripped: no handler runs and no variable is written for the rest of the run. */
  overBudget: boolean;
  run: HandlerRun;
  /** Which way each block-if went, for the preview's segment detail. */
  branchTaken: WeakMap<BlockIfNode, "then" | "else">;
  /** The option each choice macro rolled, for the preview's segment detail. */
  chosen: WeakMap<MacroCallNode, { options: string[]; value: string }>;
}

export function newState(context: MacroContext): EvalState {
  return {
    expansions: [],
    errors: [],
    sideEffects: [],
    expansionCounter: 0,
    touched: new Set(),
    volatileHit: false,
    steps: 0,
    overBudget: false,
    run: { random: mulberry32(context.randomSeed ?? 1) },
    branchTaken: new WeakMap(),
    chosen: new WeakMap(),
  };
}

/** A variable map that records every read ("local:x") and passes everything else through. */
export function recordingMap(map: Map<string, MacroVariable>, scope: "local" | "global", sink: Set<string>): Map<string, MacroVariable> {
  return new Proxy(map, {
    get(target, prop, receiver) {
      if (prop === "get") return (key: string) => (sink.add(`${scope}:${key}`), target.get(key));
      if (prop === "has") return (key: string) => (sink.add(`${scope}:${key}`), target.has(key));
      // The Map itself as receiver, so accessors such as `size` read the real map, not the proxy.
      const value: unknown = Reflect.get(target, prop, target);
      void receiver;
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
}

/** Does the text hold a complete `{{...}}` tag? RoleCall's test for "evaluate this again". */
export const containsMacros = (text: string): boolean => /\{\{(?:[^{}]|\{(?!\{)|\}(?!\}))+\}\}/.test(text);

const overflow = (state: EvalState, message: string): void => {
  if (state.overBudget) return;
  state.overBudget = true;
  state.errors.push({ macro: "", message });
};

/** Thrown out of a lazy arg once a bound trips, so the lazy handler never reaches its own writes. */
const BUDGET_STOP = new Error("evaluation stopped by a bound");

/** Cap one string at the output ceiling. The cap is per string, so nested text is never counted twice. */
export function capped(state: EvalState, text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  overflow(state, `output ceiling of ${MAX_OUTPUT_CHARS} characters hit; truncated`);
  return text.slice(0, MAX_OUTPUT_CHARS);
}

export function evaluateNodes(nodes: ASTNode[], context: MacroContext, state: EvalState, depth: number): string {
  if (depth > MAX_EVAL_DEPTH) return "";
  let out = "";
  for (const node of nodes) {
    if (state.overBudget) return out;
    if (++state.steps > MAX_EVAL_STEPS) {
      overflow(state, `evaluation step budget of ${MAX_EVAL_STEPS} hit; truncated`);
      return out;
    }
    if (context.deadline && state.steps % DEADLINE_CHECK_EVERY === 1 && stopsRun(context)) {
      overflow(state, DEADLINE_MESSAGE);
      return out;
    }
    switch (node.type) {
      case "text":
        out += node.value;
        break;
      case "macro":
        out += evaluateMacro(node, context, state, depth);
        break;
      case "blockIf": {
        const condition = evaluateNodes(node.condition, context, state, depth + 1);
        const taken = evaluateConditionExpression(resolveConditionShorthands(condition, context));
        state.branchTaken.set(node, taken ? "then" : "else");
        out += evaluateNodes(taken ? node.thenBranch : node.elseBranch, context, state, depth + 1);
        break;
      }
      case "blockSetvar":
        blockSetvar(node.varName, node.content, node.scope, context, state, depth);
        break;
      case "blockTrim":
        out += evaluateNodes(node.content, context, state, depth + 1).trim();
        break;
    }
    if (out.length > MAX_OUTPUT_CHARS) return capped(state, out);
  }
  return out;
}

function blockSetvar(
  nameNodes: ASTNode[],
  contentNodes: ASTNode[],
  scope: "local" | "global",
  context: MacroContext,
  state: EvalState,
  depth: number,
): void {
  const key = evaluateNodes(nameNodes, context, state, depth + 1).trim();
  const value = evaluateNodes(contentNodes, context, state, depth + 1).trim();
  if (!key || context.readOnly || state.overBudget) return;
  const effect: MacroSideEffect = {
    type: scope === "global" ? "setGlobalVar" : "setLocalVar",
    key,
    value,
    cause: scope === "global" ? "setglobalvar" : "setvar",
  };
  applySideEffects([effect], context);
  state.sideEffects.push(effect);
}

function callHandler(def: MacroDefinition | undefined, node: MacroCallNode, args: string[], context: MacroContext, state: EvalState): MacroResult {
  if (!def) return { value: "", success: false, error: unknownMessage(node.name) };
  if (!def.handler) return { value: "", success: false, error: "Macro has no eager handler" };
  try {
    return def.handler(args, context, state.run);
  } catch (error) {
    return { value: "", success: false, error: toErrorMessage(error, "Macro handler threw an exception") };
  }
}

function evaluateMacro(node: MacroCallNode, context: MacroContext, state: EvalState, depth: number): string {
  if (state.overBudget) return "";
  const def = getMacro(node.name);
  let result: MacroResult;
  let original: string;
  let failed: string;
  if (def?.lazyHandler) {
    const raw = splitMacroArgs(node.rawContent).slice(1);
    const lazy: LazyMacroArg[] = node.args.map((argNodes, i) => ({
      raw: raw[i] ?? "",
      evaluate: () => {
        const value = evaluateNodes(argNodes, context, state, depth + 1);
        if (state.overBudget) throw BUDGET_STOP;
        return value;
      },
    }));
    try {
      result = def.lazyHandler(lazy, context, state.run);
    } catch (error) {
      result = { value: "", success: false, error: toErrorMessage(error, "Macro handler threw an exception") };
    }
    original = failed = `{{${node.rawContent}}}`;
  } else {
    const args = node.args.map((argNodes) => evaluateNodes(argNodes, context, state, depth + 1).trim());
    // An arg cut short by a bound must not reach a handler: some write straight to the context.
    if (state.overBudget) return "";
    result = callHandler(def, node, args, context, state);
    original = failed = args.length === 0 ? `{{${node.name}}}` : `{{${node.name}::${args.join("::")}}}`;
    if (def?.choices && result.success) state.chosen.set(node, { options: def.choices(args), value: result.value });
  }
  // A handler that ran past the run's deadline (the work it did is not trusted to have been small): stop the run, whatever it answered.
  if (stopsRun(context)) overflow(state, DEADLINE_MESSAGE);
  // A bound that tripped while a lazy handler ran its args: drop the result and its side effects.
  if (state.overBudget) return "";
  const order = state.expansionCounter++;
  if (!state.volatileHit && isVolatileMacro(node.name)) state.volatileHit = true;

  if (!result.success) {
    state.errors.push({ macro: failed, message: result.error || "Unknown error" });
    return failed;
  }
  state.expansions.push({ original, expanded: result.value, macroName: node.name, depth: order });
  if (result.sideEffects) {
    // A value past the ceiling (addvar concatenating two long strings) is refused, never stored cut off.
    if (result.sideEffects.some((fx) => typeof fx.value === "string" && fx.value.length > MAX_OUTPUT_CHARS)) {
      overflow(state, `output ceiling of ${MAX_OUTPUT_CHARS} characters hit by a variable write; stopped`);
      return "";
    }
    const annotated = result.sideEffects.map((fx) => (fx.cause ? fx : { ...fx, cause: node.name }));
    state.sideEffects.push(...annotated);
    applySideEffects(annotated, context);
  }
  const value = result.value;
  if (containsMacros(value)) {
    return evaluateNodes(parseMacroNodes(normalizeMacroText(value).text), context, state, depth + 1);
  }
  return value;
}

/**
 * A global write as the operation it was: a delete, an add of a number onto a number (or onto nothing), an append of text onto text (or
 * onto nothing), or a set. An add onto a value of another kind (numeric text, null, an object) is kept as a set of the value the engine
 * made, so folding the operation always gives what this reply's prompt saw.
 */
const globalWriteOf = (fx: MacroSideEffect, before: MacroVariable["value"] | undefined): GlobalWrite =>
  fx.type === "deleteGlobalVar" ? { name: fx.key, op: "delete" }
  : typeof fx.add === "number" && (before === undefined || typeof before === "number") ? { name: fx.key, op: "inc", v: fx.add }
  : typeof fx.add === "string" && (before === undefined || typeof before === "string") ? { name: fx.key, op: "append", v: fx.add }
  : { name: fx.key, op: "set", v: fx.value! };

/** Apply variable changes to the context now, so later macros in the run see them. */
export function applySideEffects(effects: readonly MacroSideEffect[], context: MacroContext): void {
  const now = context.now ?? 0;
  for (const fx of effects) {
    const global = fx.type === "setGlobalVar" || fx.type === "deleteGlobalVar";
    const map = global ? context.globalVariables : context.localVariables;
    const before = map.get(fx.key)?.value;
    if (fx.type === "deleteLocalVar" || fx.type === "deleteGlobalVar") map.delete(fx.key);
    else if (fx.value !== undefined) map.set(fx.key, { value: fx.value, createdAt: map.get(fx.key)?.createdAt ?? now, updatedAt: now });
    if (global && context.globalWrites && (fx.type === "deleteGlobalVar" || fx.value !== undefined)) context.globalWrites.push(globalWriteOf(fx, before));
  }
}

/** RoleCall's unknown-macro message, with its near-miss suggestion from a short list of common names. */
function unknownMessage(name: string): string {
  const common = ["char", "user", "time", "date", "random", "pick", "roll", "getvar", "setvar", "if", "upper", "lower", "trim"];
  for (const macro of common) {
    if (Math.abs(name.length - macro.length) > 2) continue;
    const [shorter, longer] = name.length < macro.length ? [name, macro] : [macro, name];
    let diff = longer.length - shorter.length;
    for (let i = 0; i < shorter.length; i++) if (shorter[i] !== longer[i]) diff++;
    if (diff <= 2) return `Unknown macro "${name}". Did you mean "${macro}"?`;
  }
  return `Unknown macro "${name}"`;
}
