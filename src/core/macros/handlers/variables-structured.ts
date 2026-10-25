/**
 * Structured (array/object) variable macros: RoleCall's handler inside ADR-012. Split out
 * of variables.ts to stay under the file cap; concatenated back into VARIABLES_MACROS there, in
 * RoleCall's order.
 */
import type { MacroContext, MacroDefinition, MacroResult, MacroVariableValue } from "../types";
import { listItemToString as valueToString } from "../lists";
import { parseValue, resolveVar } from "./variables";

/** {{pushvar::name::value}}. Push to an array variable, creating it if needed. Returns new length. */
const pushvarMacro: MacroDefinition = {
  name: "pushvar",
  description: "Push value to array variable. Creates array if needed.",
  args: [
    { name: "name", description: "Variable name", required: true },
    { name: "value", description: "Value to push", required: true },
  ],
  category: "variables",
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (context.readOnly) return { value: "", success: true };

    const name = args[0];
    const value = args[1];
    if (!name || value === undefined) return { value: "", success: false, error: "Name and value required" };

    const { vars, target, setType } = resolveVar(name, context);
    const current = vars.get(target.key)?.value;
    const arr = Array.isArray(current) ? [...current] : [];
    arr.push(parseValue(value));

    return { value: arr.length.toString(), success: true, sideEffects: [{ type: setType, key: target.key, value: arr }] };
  },
};

/** {{popvar::name}}. Pop and return the last value from an array variable. */
const popvarMacro: MacroDefinition = {
  name: "popvar",
  description: "Pop and return last value from array variable.",
  args: [{ name: "name", description: "Variable name", required: true }],
  category: "variables",
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (context.readOnly) return { value: "", success: true };

    const name = args[0];
    if (!name) return { value: "", success: false, error: "Variable name required" };

    const { vars, target, setType } = resolveVar(name, context);
    const current = vars.get(target.key)?.value;
    if (!Array.isArray(current) || current.length === 0) return { value: "", success: true };

    const arr = [...current];
    const popped = arr.pop();

    return { value: valueToString(popped), success: true, sideEffects: [{ type: setType, key: target.key, value: arr }] };
  },
};

/** {{shiftvar::name}}. Remove and return the FIRST value from an array variable. */
const shiftvarMacro: MacroDefinition = {
  name: "shiftvar",
  description: "Remove and return first value from array variable.",
  args: [{ name: "name", description: "Variable name", required: true }],
  category: "variables",
  hasSideEffects: true,
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (context.readOnly) return { value: "", success: true };

    const name = args[0];
    if (!name) return { value: "", success: false, error: "Variable name required" };

    const { vars, target, setType } = resolveVar(name, context);
    const current = vars.get(target.key)?.value;
    if (!Array.isArray(current) || current.length === 0) return { value: "", success: true };

    const arr = [...current];
    const shifted = arr.shift();

    return { value: valueToString(shifted), success: true, sideEffects: [{ type: setType, key: target.key, value: arr }] };
  },
};

/** {{listvar::name}} / {{listvar::name::separator}}. Array items joined as text. */
const listvarMacro: MacroDefinition = {
  name: "listvar",
  description: "List array items as comma-separated string.",
  args: [
    { name: "name", description: "Variable name", required: true },
    { name: "separator", description: 'Separator (default: ", ")', required: false },
  ],
  category: "variables",
  handler: (args: string[], context: MacroContext): MacroResult => {
    const name = args[0];
    const separator = args[1] || ", ";
    if (!name) return { value: "", success: false, error: "Variable name required" };

    const { vars, target } = resolveVar(name, context);
    const current = vars.get(target.key)?.value;
    if (!Array.isArray(current)) return { value: "", success: true };

    return { value: current.map((v) => valueToString(v)).join(separator), success: true };
  },
};

/** {{countvar::name}}. Count items in an array or keys in an object. */
const countvarMacro: MacroDefinition = {
  name: "countvar",
  description: "Count items in array or keys in object.",
  args: [{ name: "name", description: "Variable name", required: true }],
  category: "variables",
  handler: (args: string[], context: MacroContext): MacroResult => {
    const name = args[0];
    if (!name) return { value: "0", success: true };

    const { vars, target } = resolveVar(name, context);
    const current = vars.get(target.key)?.value;
    if (Array.isArray(current)) return { value: current.length.toString(), success: true };
    if (typeof current === "object" && current !== null) return { value: Object.keys(current).length.toString(), success: true };

    return { value: "0", success: true };
  },
};

/** {{allvars}}. Debug: dump all local variables as JSON. */
const allvarsMacro: MacroDefinition = {
  name: "allvars",
  aliases: ["dumpvars"],
  description: "Debug: list all local variables as JSON.",
  category: "variables",
  handler: (_args: string[], context: MacroContext): MacroResult => {
    const vars: Record<string, MacroVariableValue> = {};
    context.localVariables.forEach((v, k) => {
      vars[k] = v.value;
    });
    return { value: JSON.stringify(vars, null, 2), success: true };
  },
};

export const VARIABLES_STRUCTURED_MACROS: readonly MacroDefinition[] = [
  pushvarMacro,
  popvarMacro,
  shiftvarMacro,
  listvarMacro,
  countvarMacro,
  allvarsMacro,
];
