/**
 * Chat-local variable macros: RoleCall's handler inside
 * ADR-012. Shared helpers (resolveVar, nested get/set, value parsing) live here and are reused by
 * state.ts and st-compat-vars.ts, exactly as RoleCall's own cross-file imports do. Global variable
 * macros (variables-global.ts) and structured/array macros (variables-structured.ts) are split out
 * to stay under the file cap; VARIABLES_MACROS concatenates all three in RoleCall's registration
 * order, so a later family that also claims one of these names loses, as it does in RoleCall.
 *
 * `resolveVar`, `getNestedValue`, and `setNestedValue` are unchanged from RoleCall. `valueToString`
 * is RoleCall's own duplicate of `listItemToString` (../lists); it is not re-defined here, only
 * imported under its RoleCall name, so there is one implementation, not two (AGENTS.md rule 7).
 */
import type { MacroContext, MacroDefinition, MacroResult, MacroVariable, MacroVariableValue } from "../types";
import { effectTypesForTarget, mapForTarget, resolveVariableTarget, type ResolvedVariableTarget } from "../scopes";
import { listItemToString as valueToString } from "../lists";
import { VARIABLES_GLOBAL_MACROS } from "./variables-global";
import { VARIABLES_STRUCTURED_MACROS } from "./variables-structured";

// ---- Helpers ------------------------------------------------------------------------------------

export interface ResolvedVar {
  target: ResolvedVariableTarget;
  vars: Map<string, MacroVariable>;
  setType: "setLocalVar" | "setGlobalVar";
  delType: "deleteLocalVar" | "deleteGlobalVar";
}

/** Resolve a (possibly scope-prefixed) variable name to its storage map, key, and side-effect types. */
export function resolveVar(name: string, context: MacroContext): ResolvedVar {
  const target = resolveVariableTarget(name, context);
  const fx = effectTypesForTarget(target);
  return { target, vars: mapForTarget(target, context), setType: fx.set, delType: fx.del };
}

/** Read a nested key from an object/array value by dot notation, e.g. "stats.strength" or "inventory.0". */
export function getNestedValue(obj: MacroVariableValue, key: string): MacroVariableValue | undefined {
  if (typeof obj !== "object" || obj === null) return undefined;
  const parts = key.split(".");
  let current: MacroVariableValue | undefined = obj;
  for (const part of parts) {
    if (typeof current !== "object" || current === null) return undefined;
    if (Array.isArray(current)) {
      const index = parseInt(part, 10);
      if (Number.isNaN(index) || index < 0 || index >= current.length) return undefined;
      current = current[index];
    } else {
      current = (current as Record<string, MacroVariableValue>)[part];
    }
    if (current === undefined) return undefined;
  }
  return current;
}

/** Write a nested key into an object/array value by dot notation. */
export function setNestedValue(obj: MacroVariableValue, key: string, value: MacroVariableValue): MacroVariableValue {
  if (typeof obj !== "object" || obj === null) obj = {};
  const parts = key.split(".");
  let current = obj as Record<string, MacroVariableValue>;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (current[part] === undefined || typeof current[part] !== "object") current[part] = {};
    current = current[part] as Record<string, MacroVariableValue>;
  }
  current[parts[parts.length - 1]!] = value;
  return obj;
}

/** Parse an author-typed string into a number, boolean, JSON value, or plain string. */
export function parseValue(value: string): MacroVariableValue {
  const num = parseFloat(value);
  if (!Number.isNaN(num) && Number.isFinite(num) && String(num) === value) return num;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === "object") return parsed as MacroVariableValue;
  } catch {
    // Not JSON; keep as string.
  }
  return value;
}

// ---- Local variables (per chat) ------------------------------------------------------------------

/**
 * {{getvar::name}} / {{getvar::name::key}}. `getvarkey` is declared here as RoleCall declares it
 * (an alias of getvar), but it is unreachable once st-compat-vars.ts is also loaded: that family
 * registers "getvarkey" as its OWN primary name, and exact-name lookup wins over an alias lookup in
 * both RoleCall's registry and this one. See the report for the empirical trace.
 */
const getvarMacro: MacroDefinition = {
  name: "getvar",
  aliases: ["var", "getvarkey"],
  description: "Get a chat-local variable. Use ::key for nested access.",
  args: [
    { name: "name", description: "Variable name", required: true },
    { name: "key", description: "Nested key (optional)", required: false },
  ],
  category: "variables",
  handler: (args: string[], context: MacroContext): MacroResult => {
    const name = args[0];
    if (!name) return { value: "", success: false, error: "Variable name required" };

    const { vars, target } = resolveVar(name, context);
    const variable = vars.get(target.key);
    if (!variable) return { value: "", success: true }; // Undefined variables return empty

    if (args[1]) {
      const nested = getNestedValue(variable.value, args[1]);
      return { value: valueToString(nested), success: true };
    }
    return { value: valueToString(variable.value), success: true };
  },
};

/** {{setvar::name::value}} / {{setvar::name::key::value}}. `setvarkey` alias: see getvar's note. */
const setvarMacro: MacroDefinition = {
  name: "setvar",
  aliases: ["setvarkey"],
  description: "Set a chat-local variable. Returns empty. Use ::key::value for nested.",
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
    const { vars, target, setType } = resolveVar(name, context);
    let value: MacroVariableValue;

    if (args.length === 2) {
      value = parseValue(args[1]!);
    } else {
      const key = args[1]!;
      const newValue = parseValue(args[2]!);
      const existing = vars.get(target.key)?.value || {};
      value = setNestedValue(existing, key, newValue);
    }

    return { value: "", success: true, sideEffects: [{ type: setType, key: target.key, value }] };
  },
};

/**
 * {{addvar::name::value}}. Auto-detects type: an exact-number value adds numerically, otherwise
 * concatenates as a string (SillyTavern parity: {{addvar::notebook_X::$1 /// }}).
 */
const addvarMacro: MacroDefinition = {
  name: "addvar",
  description: "Add to a variable. Numeric values add numerically, strings concatenate.",
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

    const { vars, target, setType } = resolveVar(name, context);
    const current = vars.get(target.key)?.value;
    const numericValue = parseFloat(rawValue);

    let newValue: string | number;
    if (!Number.isNaN(numericValue) && Number.isFinite(numericValue) && String(numericValue) === rawValue.trim()) {
      const currentNum = typeof current === "number" ? current : 0;
      newValue = currentNum + numericValue;
    } else {
      const currentStr = typeof current === "string" ? current : current != null ? String(current) : "";
      newValue = currentStr + rawValue;
    }

    return { value: "", success: true, sideEffects: [{ type: setType, key: target.key, value: newValue }] };
  },
};

/** {{incvar::name}}. Increment by 1, return the new value. */
const incvarMacro: MacroDefinition = {
  name: "incvar",
  description: "Increment variable by 1. Returns new value.",
  args: [{ name: "name", description: "Variable name", required: true }],
  category: "variables",
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (context.readOnly) return { value: "", success: true };

    const name = args[0];
    if (!name) return { value: "", success: false, error: "Variable name required" };

    const { vars, target, setType } = resolveVar(name, context);
    const current = vars.get(target.key)?.value;
    const currentNum = typeof current === "number" ? current : 0;
    const newValue = currentNum + 1;

    return { value: newValue.toString(), success: true, sideEffects: [{ type: setType, key: target.key, value: newValue }] };
  },
};

/** {{decvar::name}}. Decrement by 1, return the new value. */
const decvarMacro: MacroDefinition = {
  name: "decvar",
  description: "Decrement variable by 1. Returns new value.",
  args: [{ name: "name", description: "Variable name", required: true }],
  category: "variables",
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (context.readOnly) return { value: "", success: true };

    const name = args[0];
    if (!name) return { value: "", success: false, error: "Variable name required" };

    const { vars, target, setType } = resolveVar(name, context);
    const current = vars.get(target.key)?.value;
    const currentNum = typeof current === "number" ? current : 0;
    const newValue = currentNum - 1;

    return { value: newValue.toString(), success: true, sideEffects: [{ type: setType, key: target.key, value: newValue }] };
  },
};

/** {{hasvar::name}}. Does the variable exist? */
const hasvarMacro: MacroDefinition = {
  name: "hasvar",
  description: 'Check if variable exists. Returns "true" or "false".',
  args: [{ name: "name", description: "Variable name", required: true }],
  category: "variables",
  handler: (args: string[], context: MacroContext): MacroResult => {
    const name = args[0];
    if (!name) return { value: "false", success: true };
    const { vars, target } = resolveVar(name, context);
    return { value: vars.has(target.key) ? "true" : "false", success: true };
  },
};

/** {{delvar::name}}. Delete a variable. */
const delvarMacro: MacroDefinition = {
  name: "delvar",
  description: "Delete a variable. Returns empty.",
  args: [{ name: "name", description: "Variable name", required: true }],
  category: "variables",
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (context.readOnly) return { value: "", success: true };

    const name = args[0];
    if (!name) return { value: "", success: false, error: "Variable name required" };

    const { target, delType } = resolveVar(name, context);
    return { value: "", success: true, sideEffects: [{ type: delType, key: target.key }] };
  },
};

/** Every variable macro, in RoleCall's registration order: local, then global, then structured. */
export const VARIABLES_MACROS: readonly MacroDefinition[] = [
  getvarMacro,
  setvarMacro,
  addvarMacro,
  incvarMacro,
  decvarMacro,
  hasvarMacro,
  delvarMacro,
  ...VARIABLES_GLOBAL_MACROS,
  ...VARIABLES_STRUCTURED_MACROS,
];
