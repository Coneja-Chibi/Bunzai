/**
 * Macros pass lists to each other as JSON-array strings ({{enabled_list}} returns one; {{foreach}},
 * {{join}}, and {{count}} accept one). Authors may also write `[A, B, C]` or plain `a, b, c`.
 * RoleCall's convention.
 */
import type { MacroVariableValue } from "./types";

/** A list argument: a JSON array, a bracket literal split on commas, or comma-separated text. */
export function parseListArg(arg: string): MacroVariableValue[] {
  const trimmed = arg.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed as MacroVariableValue[];
    } catch {
      const inner = trimmed.slice(1, -1).trim();
      return inner ? inner.split(",").map((s) => s.trim()).filter((s) => s.length > 0) : [];
    }
  }
  return trimmed.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

/** A list returned from a macro, in the form list-consuming macros parse losslessly. */
export const formatList = (items: MacroVariableValue[]): string => JSON.stringify(items);

/** One list item as display text. */
export function listItemToString(item: MacroVariableValue | undefined): string {
  if (item === null || item === undefined) return "";
  return typeof item === "object" ? JSON.stringify(item) : String(item);
}
