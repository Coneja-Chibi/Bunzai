/**
 * Global (cross-chat) variable macros: RoleCall's handler inside ADR-012. Split out of variables.ts to stay under the file
 * cap; concatenated back into VARIABLES_MACROS there, in RoleCall's order.
 *
 * Enemy-code finding, not fixed here: this family reads and writes `context.globalVariables`
 * directly by the raw name and never calls `resolveVariableTarget`/`resolveVar`, so a `session:`,
 * `character:`, `arc:`, or `scene:` prefix passed to {{getglobalvar}}/{{setglobalvar::name::v}} is
 * stored as a literal key, not resolved as a scope. RoleCall does this too; ported as-is for parity.
 */
import type { MacroDefinition } from "../types";
import { addHandler, getHandler, setHandler, stepHandler, type VarResolver } from "./variables";

/** The raw name is the key, with no scope resolution: see the finding above. */
const resolveGlobal: VarResolver = (name, context) => ({ vars: context.globalVariables, target: { key: name }, setType: "setGlobalVar" });

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
  handler: getHandler(resolveGlobal),
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
  handler: setHandler(resolveGlobal),
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
  handler: addHandler(resolveGlobal, true),
};

/** {{incglobalvar::name}}. Increment by 1, return the new value. */
const incglobalvarMacro: MacroDefinition = {
  name: "incglobalvar",
  aliases: ["incgvar"],
  description: "Increment global variable by 1. Returns new value.",
  args: [{ name: "name", description: "Variable name", required: true }],
  category: "variables",
  hasSideEffects: true,
  handler: stepHandler(resolveGlobal, 1),
};

/** {{decglobalvar::name}}. Decrement by 1, return the new value. */
const decglobalvarMacro: MacroDefinition = {
  name: "decglobalvar",
  aliases: ["decgvar"],
  description: "Decrement global variable by 1. Returns new value.",
  args: [{ name: "name", description: "Variable name", required: true }],
  category: "variables",
  hasSideEffects: true,
  handler: stepHandler(resolveGlobal, -1),
};

export const VARIABLES_GLOBAL_MACROS: readonly MacroDefinition[] = [
  getglobalvarMacro,
  setglobalvarMacro,
  addglobalvarMacro,
  incglobalvarMacro,
  decglobalvarMacro,
];
