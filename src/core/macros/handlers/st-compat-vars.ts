/**
 * ST variable-macro compat shim: RoleCall's
 * handler, inside ADR-012. SillyTavern's newer macro engine registers variable macros RoleCall lacked, so
 * ST-authored presets using them rendered the calls as literal text:
 *
 *   {{setvarkey::name::key::value}}   (alias setvarindex)
 *   {{getvarkey::name::key}}          (alias getvarindex)
 *   {{deletevar::name}}               (alias flushvar)
 *   {{varexists::name}}
 *
 * Semantics mirror ST (public/scripts/macros/definitions/variable-macros.js): a variable CREATED by
 * setvarkey takes its shape from the key type, a numeric key builds an array, a string key builds an
 * object. RoleCall's native nested {{setvar::name::key::value}} always builds objects; these wrappers
 * exist to absorb that documented shape difference.
 *
 * These primary names win over variables.ts's `getvarkey`/`setvarkey` aliases, in both RoleCall's
 * registry and this one: exact-name lookup is checked before the alias map, and this file registers
 * `setvarkey`/`getvarkey` as NAMES, not aliases. See variables.ts's header and the report.
 */
import type { MacroContext, MacroDefinition, MacroResult, MacroVariableValue } from "../types";
import { listItemToString as valueToString } from "../lists";
import { getNestedValue, resolveVar, setNestedValue, parseValue } from "./variables";

const isIndexKey = (key: string): boolean => /^\d+$/.test(key);

/** ST shape rule: index keys grow arrays, string keys grow objects. */
function setByKey(existing: MacroVariableValue | undefined, key: string, value: MacroVariableValue): MacroVariableValue {
  if (isIndexKey(key) && (existing === undefined || Array.isArray(existing))) {
    const arr = Array.isArray(existing) ? [...existing] : [];
    arr[Number(key)] = value;
    return arr;
  }
  const base = existing !== undefined && typeof existing === "object" && existing !== null ? existing : {};
  return setNestedValue(base, key, value);
}

const setvarkeyMacro: MacroDefinition = {
  name: "setvarkey",
  aliases: ["setvarindex"],
  description: "ST compat: set a key of an object or an index of an array variable. Renders empty.",
  args: [
    { name: "name", description: "Variable name", required: true },
    { name: "key", description: "Object key or array index", required: true },
    { name: "value", description: "Value to set", required: true },
  ],
  category: "variables",
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (context.readOnly) return { value: "", success: true };
    if (args.length < 3) return { value: "", success: false, error: "Name, key, and value required" };
    const { vars, target, setType } = resolveVar(args[0]!, context);
    const value = setByKey(vars.get(target.key)?.value, args[1]!, parseValue(args[2]!));
    return { value: "", success: true, sideEffects: [{ type: setType, key: target.key, value }] };
  },
};

const getvarkeyMacro: MacroDefinition = {
  name: "getvarkey",
  aliases: ["getvarindex"],
  description: "ST compat: read a key of an object or an index of an array variable.",
  args: [
    { name: "name", description: "Variable name", required: true },
    { name: "key", description: "Object key or array index", required: true },
  ],
  category: "variables",
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (args.length < 2) return { value: "", success: false, error: "Name and key required" };
    const { vars, target } = resolveVar(args[0]!, context);
    const variable = vars.get(target.key);
    if (!variable) return { value: "", success: true };
    return { value: valueToString(getNestedValue(variable.value, args[1]!)), success: true };
  },
};

const deletevarMacro: MacroDefinition = {
  name: "deletevar",
  aliases: ["flushvar"],
  description: "ST compat: delete a variable. Renders empty.",
  args: [{ name: "name", description: "Variable name", required: true }],
  category: "variables",
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (context.readOnly) return { value: "", success: true };
    const name = args[0];
    if (!name) return { value: "", success: false, error: "Name required" };
    const { target, setType } = resolveVar(name, context);
    const deleteType = setType === "setGlobalVar" ? "deleteGlobalVar" : "deleteLocalVar";
    return { value: "", success: true, sideEffects: [{ type: deleteType, key: target.key }] };
  },
};

const varexistsMacro: MacroDefinition = {
  name: "varexists",
  description: 'ST compat: does the named variable exist? Returns "true"/"false".',
  args: [{ name: "name", description: "Variable name", required: true }],
  category: "variables",
  handler: (args: string[], context: MacroContext): MacroResult => {
    const name = args[0];
    if (!name) return { value: "", success: false, error: "Name required" };
    const { vars, target } = resolveVar(name, context);
    return { value: vars.has(target.key) ? "true" : "false", success: true };
  },
};

export const ST_COMPAT_VARS_MACROS: readonly MacroDefinition[] = [setvarkeyMacro, getvarkeyMacro, deletevarMacro, varexistsMacro];
