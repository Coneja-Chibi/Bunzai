/**
 * Timing and frequency macros: RoleCall's handler inside
 * ADR-012.
 *
 *   {{first_turn::content}}     render only on turn 1
 *   {{once::id::content}}       render only the first time this id is seen
 *   {{every::N::content}}       render every N turns
 *   {{after_turn::N::content}}  render on or after turn N
 *   {{before_turn::N::content}} render before turn N
 *
 * "Turn" = the user exchange being responded to: the number of user messages in the chat so far
 * (minimum 1). The greeting-only state and the first user message are both turn 1.
 *
 * All of these are lazy: skipped content never evaluates, so side-effect macros inside it never
 * fire. No clock or randomness involved, so nothing here changed for ADR-012.
 *
 * Each definition uses only its lazy handler so skipped content never evaluates.
 */
import type { LazyMacroArg, MacroContext, MacroDefinition, MacroResult, MacroVariableValue } from "../types";
import { recOr } from "../../guards";
import { joinRaw } from "../lazy";

/** Hidden state variable recording which {{once::id}} blocks have fired. */
const ONCE_STATE_KEY = "__once_fired";

/** Current turn number (1-based). */
export function currentTurn(context: MacroContext): number {
  const userMessages = context.messages.filter((m) => m.role === "user").length;
  return Math.max(1, userMessages);
}

const firstTurnMacro: MacroDefinition = {
  name: "first_turn",
  aliases: ["on_first_turn"],
  description: "Render content only on the first turn.",
  args: [{ name: "content", description: "Content for turn 1", required: true }],
  category: "chat",
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    if (currentTurn(context) !== 1) return { value: "", success: true };
    return { value: joinRaw(args, 0), success: true };
  },
};

const onceMacro: MacroDefinition = {
  name: "once",
  description: "Render content only the first time this id fires in the chat.",
  args: [
    { name: "id", description: "Unique id for this once-block", required: true },
    { name: "content", description: "Content to render once", required: true },
  ],
  category: "chat",
  hasSideEffects: true,
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    const id = args[0]?.evaluate().trim() ?? "";
    if (!id) return { value: "", success: false, error: "once requires an id" };

    const fired = context.localVariables.get(ONCE_STATE_KEY)?.value;
    const firedMap = recOr(fired) as Record<string, MacroVariableValue>;
    if (firedMap[id]) return { value: "", success: true };

    const body = joinRaw(args, 1);
    if (context.readOnly) return { value: body, success: true };
    return {
      value: body,
      success: true,
      sideEffects: [{ type: "setLocalVar", key: ONCE_STATE_KEY, value: { ...firedMap, [id]: true } }],
    };
  },
};

const everyMacro: MacroDefinition = {
  name: "every",
  description: "Render content every N turns.",
  args: [
    { name: "n", description: "Interval in turns", required: true },
    { name: "content", description: "Content to render", required: true },
  ],
  category: "chat",
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    const n = parseInt(args[0]?.evaluate().trim() ?? "", 10);
    if (Number.isNaN(n) || n < 1) return { value: "", success: false, error: "every requires a positive interval" };
    if (currentTurn(context) % n !== 0) return { value: "", success: true };
    return { value: joinRaw(args, 1), success: true };
  },
};

const afterTurnMacro: MacroDefinition = {
  name: "after_turn",
  description: "Render content on or after turn N.",
  args: [
    { name: "n", description: "Turn number", required: true },
    { name: "content", description: "Content to render", required: true },
  ],
  category: "chat",
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    const n = parseInt(args[0]?.evaluate().trim() ?? "", 10);
    if (Number.isNaN(n)) return { value: "", success: false, error: "after_turn requires a turn number" };
    if (currentTurn(context) < n) return { value: "", success: true };
    return { value: joinRaw(args, 1), success: true };
  },
};

const beforeTurnMacro: MacroDefinition = {
  name: "before_turn",
  description: "Render content only before turn N.",
  args: [
    { name: "n", description: "Turn number", required: true },
    { name: "content", description: "Content to render", required: true },
  ],
  category: "chat",
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    const n = parseInt(args[0]?.evaluate().trim() ?? "", 10);
    if (Number.isNaN(n)) return { value: "", success: false, error: "before_turn requires a turn number" };
    if (currentTurn(context) >= n) return { value: "", success: true };
    return { value: joinRaw(args, 1), success: true };
  },
};

export const TIMING_MACROS: readonly MacroDefinition[] = [firstTurnMacro, onceMacro, everyMacro, afterTurnMacro, beforeTurnMacro];
