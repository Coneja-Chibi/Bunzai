/**
 * Global (cross-chat) variable macros: RoleCall's handler inside ADR-012. Split out of variables.ts to stay under the file
 * cap; concatenated back into VARIABLES_MACROS there, in RoleCall's order.
 *
 * Enemy-code finding, not fixed here: this family reads and writes `context.globalVariables`
 * directly by the raw name and never calls `resolveVariableTarget`/`resolveVar`, so a `session:`,
 * `character:`, `arc:`, or `scene:` prefix passed to {{getglobalvar}}/{{setglobalvar::name::v}} is
 * stored as a literal key, not resolved as a scope. RoleCall does this too; ported as-is for parity.
 */
import type { MacroContext, MacroDefinition, MacroResult, MacroVariableValue } from "../types";
import { listItemToString as valueToString } from "../lists";
import { getNestedValue, parseValue, setNestedValue } from "./variables";

/** {{getglobalvar::name}} / {{getglobalvar::name::key}}. */
const getglobalvarMacro: MacroDefinition = {
  name: "getglobalvar",
  aliases: ["globalvar", "gvar"],
  description: "Get a global variable (persists across chats).",
  args: [
    { name: "name", description: "Variable name", required: true },
    { name: "key", description: "Nested key (optional)", required: false },
  ],
  category: "variables",
  handler: (args: string[], context: MacroContext): MacroResult => {
    const name = args[0];
    if (!name) return { value: "", success: false, error: "Variable name required" };

    const variable = context.globalVariables.get(name);
    if (!variable) return { value: "", success: true };

    if (args[1]) {
      const nested = getNestedValue(variable.value, args[1]);
      return { value: valueToString(nested), success: true };
    }
    return { value: valueToString(variable.value), success: true };
  },
};

/** {{setglobalvar::name::value}} / {{setglobalvar::name::key::value}}. */
const setglobalvarMacro: MacroDefinition = {
  name: "setglobalvar",
  aliases: ["setgvar"],
  description: "Set a global variable (persists across chats). Returns empty.",
  args: [
    { name: "name", description: "Variable name", required: true },
    { name: "value", description: "Value to set", required: true },
  ],
  category: "variables",
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (context.readOnly) return { value: "", success: true };
    if (args.length < 2) return { value: "", success: false, error: "Name and value required" };

    const name = args[0]!;
    let value: MacroVariableValue;

    if (args.length === 2) {
      value = parseValue(args[1]!);
    } else {
      const key = args[1]!;
      const newValue = parseValue(args[2]!);
      const existing = context.globalVariables.get(name)?.value || {};
      value = setNestedValue(existing, key, newValue);
    }

    return { value: "", success: true, sideEffects: [{ type: "setGlobalVar", key: name, value }] };
  },
};

/** {{addglobalvar::name::value}}. Numeric values add numerically, strings concatenate. */
const addglobalvarMacro: MacroDefinition = {
  name: "addglobalvar",
  aliases: ["addgvar"],
  description: "Add to a global variable. Numeric values add numerically, strings concatenate.",
  args: [
    { name: "name", description: "Variable name", required: true },
    { name: "value", description: "Value to add (number or string)", required: true },
  ],
  category: "variables",
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (context.readOnly) return { value: "", success: true };

    const name = args[0];
    const rawValue = args[1];
    if (!name) return { value: "", success: false, error: "Variable name required" };
    if (rawValue === undefined || rawValue === null) return { value: "", success: false, error: "Value required" };

    const current = context.globalVariables.get(name)?.value;
    const numericValue = parseFloat(rawValue);

    let newValue: string | number;
    if (!Number.isNaN(numericValue) && Number.isFinite(numericValue) && String(numericValue) === rawValue.trim()) {
      const currentNum = typeof current === "number" ? current : 0;
      newValue = currentNum + numericValue;
    } else {
      const currentStr = typeof current === "string" ? current : current != null ? String(current) : "";
      newValue = currentStr + rawValue;
    }

    return { value: String(newValue), success: true, sideEffects: [{ type: "setGlobalVar", key: name, value: newValue }] };
  },
};

/** {{incglobalvar::name}}. Increment by 1, return the new value. */
const incglobalvarMacro: MacroDefinition = {
  name: "incglobalvar",
  aliases: ["incgvar"],
  description: "Increment global variable by 1. Returns new value.",
  args: [{ name: "name", description: "Variable name", required: true }],
  category: "variables",
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (context.readOnly) return { value: "", success: true };

    const name = args[0];
    if (!name) return { value: "", success: false, error: "Variable name required" };

    const current = context.globalVariables.get(name)?.value;
    const currentNum = typeof current === "number" ? current : 0;
    const newValue = currentNum + 1;

    return { value: newValue.toString(), success: true, sideEffects: [{ type: "setGlobalVar", key: name, value: newValue }] };
  },
};

/** {{decglobalvar::name}}. Decrement by 1, return the new value. */
const decglobalvarMacro: MacroDefinition = {
  name: "decglobalvar",
  aliases: ["decgvar"],
  description: "Decrement global variable by 1. Returns new value.",
  args: [{ name: "name", description: "Variable name", required: true }],
  category: "variables",
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (context.readOnly) return { value: "", success: true };

    const name = args[0];
    if (!name) return { value: "", success: false, error: "Variable name required" };

    const current = context.globalVariables.get(name)?.value;
    const currentNum = typeof current === "number" ? current : 0;
    const newValue = currentNum - 1;

    return { value: newValue.toString(), success: true, sideEffects: [{ type: "setGlobalVar", key: name, value: newValue }] };
  },
};

export const VARIABLES_GLOBAL_MACROS: readonly MacroDefinition[] = [
  getglobalvarMacro,
  setglobalvarMacro,
  addglobalvarMacro,
  incglobalvarMacro,
  decglobalvarMacro,
];
