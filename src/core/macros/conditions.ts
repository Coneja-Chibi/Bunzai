/**
 * Condition strings ("A != B", "x >= 3", "!flag", bare truthiness), as RoleCall evaluates them for
 * block-if and for the iteration and conditional macro families ({{filter}}, {{when_all}}).
 * RoleCall's rules exactly, including the ones that look
 * odd: the left side may be empty ("{{if {{getvar::missing}} == wp}}" compares "" with "wp"), and
 * two operands compare as numbers only when both are non-empty numerals.
 */
import type { MacroContext, MacroVariable } from "./types";

export const isTruthy = (value: string): boolean => {
  const lower = value.toLowerCase().trim();
  return lower !== "" && lower !== "false" && lower !== "0" && lower !== "null" && lower !== "undefined";
};

function compare(lhs: string, op: string, rhs: string): boolean {
  const l = Number(lhs);
  const r = Number(rhs);
  const numeric = !Number.isNaN(l) && !Number.isNaN(r) && lhs !== "" && rhs !== "";
  switch (op) {
    case "==":
      return numeric ? l === r : lhs === rhs;
    case "!=":
      return numeric ? l !== r : lhs !== rhs;
    case "===":
      return lhs === rhs;
    case "!==":
      return lhs !== rhs;
    case ">=":
      return numeric ? l >= r : lhs >= rhs;
    case "<=":
      return numeric ? l <= r : lhs <= rhs;
    case ">":
      return numeric ? l > r : lhs > rhs;
    case "<":
      return numeric ? l < r : lhs < rhs;
    default:
      return false;
  }
}

const COMPARISON = /^(.*?)\s*(===|!==|>=|<=|==|!=|>|<)\s*(.*)$/;

/** Evaluate a condition string. */
export function evaluateConditionExpression(condition: string): boolean {
  const trimmed = condition.trim();
  if (!trimmed) return false;
  const cmp = COMPARISON.exec(trimmed);
  if (cmp) return compare((cmp[1] ?? "").trim(), cmp[2] ?? "", (cmp[3] ?? "").trim());
  if (trimmed.startsWith("!")) return !isTruthy(trimmed.slice(1).trim());
  return isTruthy(trimmed);
}

/**
 * Resolve bare `.name` (local) and `$name` (global) inside a block-if condition, which the
 * normalizer's standalone-tag rewrites never reach. A missing variable becomes "".
 */
export function resolveConditionShorthands(condition: string, context: MacroContext): string {
  const read = (map: Map<string, MacroVariable>, name: string): string => {
    const value = map.get(name)?.value;
    return value === undefined || value === null ? "" : String(value);
  };
  return condition
    .replace(/(^|[\s(!])\.([A-Za-z_][\w-]*)/g, (_m, pre: string, name: string) => pre + read(context.localVariables, name))
    .replace(/(^|[\s(!])\$([A-Za-z_][\w-]*)/g, (_m, pre: string, name: string) => pre + read(context.globalVariables, name));
}
