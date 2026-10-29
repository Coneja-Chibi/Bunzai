/**
 * Conditional macros: if/else, switch, comparison operators, and the plain-English shortcuts
 * ({{when_all}}, {{when_any}}, {{whenempty}}, {{ifset}}). Ported verbatim from RoleCall
 * inside ADR-012.
 *
 * Changed from RoleCall: `evaluateConditionExpression` comes from `../conditions` (Bunzai split
 * RoleCall's `processor.ts` into `conditions.ts` plus the evaluator), not `../processor`.
 * `readScopedValue`/`isEmptyValue` still come from `./state`. RoleCall's `valueToString`
 * (variables.ts) is its own duplicate of `listItemToString` (../lists); variables.ts imports it
 * under that name without re-exporting it (one implementation, not two), so this file does the same.
 * compare's `matches` runs only when `context.allowRegex` is set (types.ts says why); RoleCall
 * always runs it. `switch`/`and`/`or` gained a `lazyHandler` (bug fix 2026-09-30) so an
 * unselected case or operand never evaluates and never fires a side effect, the same guarantee
 * `when_all`/`when_any`/`ifset` already carried; RoleCall's own switch/and/or stay eager with no lazy precedent, so this is a Bunzai-only hardening
 * to flag back to RC, not a divergence from it.
 */
import { REGEX_OFF, type LazyMacroArg, type MacroContext, type MacroDefinition, type MacroResult } from "../types";
import { evaluateConditionExpression, isTruthy } from "../conditions";
import { readScopedValue, isEmptyValue } from "./state";
import { listItemToString as valueToString } from "../lists";
import { joinRaw } from "../lazy";

/**
 * First `:` in `text` at brace depth 0 (a `{{`/`}}` pair raises/lowers depth), or -1. Mirrors
 * ../parse's `lexSplitArgRanges` brace tracking, but for a single colon: used so switch's
 * case/result split never mistakes the `::` inside a macro call (e.g. `{{getvar::fb}}`) for the
 * separator.
 */
function depthZeroColon(text: string): number {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{" && text[i + 1] === "{") {
      depth++;
      i++;
    } else if (text[i] === "}" && text[i + 1] === "}") {
      depth--;
      i++;
    } else if (text[i] === ":" && depth === 0) {
      return i;
    }
  }
  return -1;
}

/** {{if::condition::then}} / {{if::condition::then::else}} */
const ifMacro: MacroDefinition = {
  name: "if",
  aliases: ["either"],
  description: "Conditional: {{if::condition::then}} or {{if::condition::then::else}}. {{either}} is the read-aloud alias.",
  args: [
    { name: "condition", description: "Value to check for truthiness", required: true },
    { name: "then", description: "Value if true", required: true },
    { name: "else", description: "Value if false (optional)", required: false },
  ],
  category: "conditional",
  handler: (args: string[]): MacroResult => {
    if (args.length < 2) return { value: "", success: false, error: "if requires condition and then value" };
    const condition = args[0] ?? "";
    const thenValue = args[1] ?? "";
    const elseValue = args[2] || "";
    return { value: isTruthy(condition) ? thenValue : elseValue, success: true };
  },
};

/**
 * {{compare::a::op::b}} - ==, !=, ===, !==, >, <, >=, <=, contains, startswith, endswith, matches.
 * Returns "true"/"false".
 */
const compareMacro: MacroDefinition = {
  name: "compare",
  aliases: ["cmp"],
  description: 'Compare two values. Returns "true" or "false".',
  args: [
    { name: "a", description: "First value", required: true },
    { name: "op", description: "Operator (==, !=, >, <, >=, <=, contains, startswith, endswith)", required: true },
    { name: "b", description: "Second value", required: true },
  ],
  category: "conditional",
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (args.length < 3) return { value: "", success: false, error: "compare requires a, operator, and b" };
    const a = args[0] ?? "";
    const op = (args[1] ?? "").toLowerCase();
    const b = args[2] ?? "";
    let result: boolean;
    switch (op) {
      case "==":
      case "eq":
        result = a.toLowerCase() === b.toLowerCase();
        break;
      case "!=":
      case "ne":
      case "neq":
        result = a.toLowerCase() !== b.toLowerCase();
        break;
      case "===":
        result = a === b;
        break;
      case "!==":
        result = a !== b;
        break;
      case ">":
      case "gt":
        result = parseFloat(a) > parseFloat(b);
        break;
      case "<":
      case "lt":
        result = parseFloat(a) < parseFloat(b);
        break;
      case ">=":
      case "gte":
      case "ge":
        result = parseFloat(a) >= parseFloat(b);
        break;
      case "<=":
      case "lte":
      case "le":
        result = parseFloat(a) <= parseFloat(b);
        break;
      case "contains":
      case "includes":
        result = a.toLowerCase().includes(b.toLowerCase());
        break;
      case "startswith":
      case "starts":
        result = a.toLowerCase().startsWith(b.toLowerCase());
        break;
      case "endswith":
      case "ends":
        result = a.toLowerCase().endsWith(b.toLowerCase());
        break;
      case "matches":
      case "regex":
        if (!context.allowRegex) return { value: "", success: false, error: REGEX_OFF };
        try {
          result = new RegExp(b, "i").test(a);
        } catch {
          return { value: "", success: false, error: `Invalid regex: ${b}` };
        }
        break;
      default:
        return { value: "", success: false, error: `Unknown operator: ${op}` };
    }
    return { value: result ? "true" : "false", success: true };
  },
};

/**
 * {{switch::value::case1:result1::case2:result2::default}} - the last argument without a colon is
 * the default. Lazy (2026-09-30, owner decision): only the matched branch's
 * result evaluates, the same rule when_all/when_any/ifset already keep. RoleCall has no lazy
 * switch to port from (its processor.ts:415-419 only offers eager args); this is a Bunzai-only
 * hardening of a macro RC also evaluates eagerly (flagged for Chi to consider porting back).
 *
 * Each case:result pair is split at its first brace-depth-0 colon (`depthZeroColon`), so a `::`
 * INSIDE a macro call in the result (`{{getvar::fb}}`) is never mistaken for the separator. A
 * literal case label is compared as raw, untrimmed-pair text (trimmed as a whole, same as the
 * eager path's outer `.trim()` before its colon split) with no evaluation, so an unmatched
 * branch's side effects never fire. A label that itself contains `{{` cannot be compared without
 * evaluating it, so that ONE pair falls back to full evaluation (old eager-per-pair semantics,
 * scoped to that pair only) and its evaluated text is split on a plain first colon, matching the
 * pre-lazy behavior. Only the winning result is returned unevaluated for the engine to expand one
 * level deeper.
 */
const switchMacro: MacroDefinition = {
  name: "switch",
  description: "Switch statement: {{switch::value::case1:result1::case2:result2::default}}",
  args: [
    { name: "value", description: "Value to match", required: true },
    { name: "cases", description: "case:result pairs", required: true },
  ],
  category: "conditional",
  lazyHandler: (args: LazyMacroArg[]): MacroResult => {
    if (args.length < 2) return { value: "", success: false, error: "switch requires value and at least one case" };
    const value = (args[0]?.evaluate() ?? "").trim().toLowerCase();
    let defaultResult = "";
    for (let i = 1; i < args.length; i++) {
      const pair = (args[i]?.raw ?? "").trim();
      const colonIndex = depthZeroColon(pair);
      if (colonIndex === -1) {
        defaultResult = pair;
        continue;
      }
      const label = pair.slice(0, colonIndex);
      if (label.includes("{{")) {
        // The label itself is (or contains) a macro call: only a full evaluation can compare it.
        const evaluated = (args[i]?.evaluate() ?? "").trim();
        const evalColon = evaluated.indexOf(":");
        if (evalColon === -1) {
          defaultResult = evaluated;
          continue;
        }
        if (evaluated.slice(0, evalColon).toLowerCase() === value) return { value: evaluated.slice(evalColon + 1), success: true };
        continue;
      }
      if (label.toLowerCase() === value) return { value: pair.slice(colonIndex + 1), success: true };
    }
    return { value: defaultResult, success: true };
  },
};

/**
 * {{and::a::b::...}} - logical AND. Lazy (bug 4): short-circuits on the first falsy operand, so
 * operands after it never evaluate and their side effects never fire. RoleCall's `and` is eager
 * (handlers/conditional.ts, no lazyHandler); Bunzai hardens it the same way when_all already is.
 */
const andMacro: MacroDefinition = {
  name: "and",
  description: 'Logical AND of all arguments. Returns "true" or "false".',
  category: "conditional",
  lazyHandler: (args: LazyMacroArg[]): MacroResult => {
    if (args.length === 0) return { value: "false", success: true };
    for (const a of args) if (!isTruthy(a.evaluate().trim())) return { value: "false", success: true };
    return { value: "true", success: true };
  },
};

/**
 * {{or::a::b::...}} - logical OR. Lazy (bug 4): short-circuits on the first truthy operand, so
 * operands after it never evaluate and their side effects never fire. RoleCall's `or` is eager
 * (handlers/conditional.ts, no lazyHandler); Bunzai hardens it the same way when_any already is.
 */
const orMacro: MacroDefinition = {
  name: "or",
  description: 'Logical OR of all arguments. Returns "true" or "false".',
  category: "conditional",
  lazyHandler: (args: LazyMacroArg[]): MacroResult => {
    if (args.length === 0) return { value: "false", success: true };
    for (const a of args) if (isTruthy(a.evaluate().trim())) return { value: "true", success: true };
    return { value: "false", success: true };
  },
};

/**
 * {{eq::a::b}} - equality test (case-insensitive), returns "true"/"false". Standalone shorthand
 * for {{compare::a::==::b}}; used by Lumiverse presets.
 */
const eqMacro: MacroDefinition = {
  name: "eq",
  aliases: ["equals"],
  description: 'Equality test: {{eq::a::b}} returns "true" or "false"',
  args: [
    { name: "a", description: "First value", required: true },
    { name: "b", description: "Second value", required: true },
  ],
  category: "conditional",
  handler: (args: string[]): MacroResult => {
    const a = (args[0] ?? "").toLowerCase();
    const b = (args[1] ?? "").toLowerCase();
    return { value: a === b ? "true" : "false", success: true };
  },
};

/** {{not::value}} - logical NOT. */
const notMacro: MacroDefinition = {
  name: "not",
  description: 'Logical NOT. Returns "true" or "false".',
  args: [{ name: "value", description: "Value to negate", required: true }],
  category: "conditional",
  handler: (args: string[]): MacroResult => {
    const value = args[0] || "";
    return { value: isTruthy(value) ? "false" : "true", success: true };
  },
};

// ---- Plain-English conditional shortcuts (macro engine spec, Part VII) -------------------------
// All content args are lazy: a skipped branch never evaluates, so side effects inside it never fire.

/**
 * {{when_all::cond1::cond2::content}} - content if ALL conditions truthy. Conditions support
 * comparisons ("{{getvar::x}} >= 3") and bare truthiness.
 */
const whenAllMacro: MacroDefinition = {
  name: "when_all",
  description: "Render content when all conditions are truthy. Last arg is the content.",
  category: "conditional",
  lazyHandler: (args: LazyMacroArg[]): MacroResult => {
    if (args.length < 2) return { value: "", success: false, error: "when_all requires conditions and content" };
    const conditions = args.slice(0, -1).map((a) => a.evaluate().trim());
    const pass = conditions.every((c) => evaluateConditionExpression(c));
    return { value: pass ? (args[args.length - 1]?.raw ?? "") : "", success: true };
  },
};

/** {{when_any::cond1::cond2::content}} - content if ANY condition truthy. */
const whenAnyMacro: MacroDefinition = {
  name: "when_any",
  description: "Render content when any condition is truthy. Last arg is the content.",
  category: "conditional",
  lazyHandler: (args: LazyMacroArg[]): MacroResult => {
    if (args.length < 2) return { value: "", success: false, error: "when_any requires conditions and content" };
    const conditions = args.slice(0, -1).map((a) => a.evaluate().trim());
    const pass = conditions.some((c) => evaluateConditionExpression(c));
    return { value: pass ? (args[args.length - 1]?.raw ?? "") : "", success: true };
  },
};

/** {{whenempty::var::content}} - content if the variable is unset/empty. */
const whenEmptyMacro: MacroDefinition = {
  name: "whenempty",
  aliases: ["when_empty"],
  description: "Render content when the variable is unset or empty (scope-aware).",
  category: "conditional",
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    const varName = args[0]?.evaluate().trim() ?? "";
    if (!varName) return { value: "", success: false, error: "whenempty requires a variable name" };
    if (!isEmptyValue(readScopedValue(varName, context))) return { value: "", success: true };
    return { value: joinRaw(args, 1), success: true };
  },
};

/**
 * {{ifset::var::content}} - content if the variable is set (non-empty). `$var` (and `$<name>`)
 * inside the content resolve to the value.
 */
const ifsetMacro: MacroDefinition = {
  name: "ifset",
  aliases: ["if_set", "whenset"],
  description: "Render content when the variable is set; $var resolves inside.",
  category: "conditional",
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    const varName = args[0]?.evaluate().trim() ?? "";
    if (!varName) return { value: "", success: false, error: "ifset requires a variable name" };
    const value = readScopedValue(varName, context);
    if (isEmptyValue(value)) return { value: "", success: true };
    const valueStr = valueToString(value);
    // Bare key after any scope prefix, for $<name> substitution.
    const bareName = varName.includes(":") ? varName.slice(varName.indexOf(":") + 1) : varName;
    const body = joinRaw(args, 1).replaceAll("$var", valueStr).replaceAll(`$${bareName}`, valueStr);
    return { value: body, success: true };
  },
};

export const CONDITIONAL_MACROS: readonly MacroDefinition[] = [
  ifMacro,
  compareMacro,
  switchMacro,
  andMacro,
  orMacro,
  notMacro,
  eqMacro,
  whenAllMacro,
  whenAnyMacro,
  whenEmptyMacro,
  ifsetMacro,
];
