/**
 * The macro engine: RoleCall's, inside ADR-012's closed world.
 *
 * Permitted callers (ADR-012 decision 4): the macro test bench, the transfer compatibility report,
 * prompt assembly and its previews, and chat display. Codecs and adapters never import it: macro
 * text is opaque payload at every import and conversion boundary.
 */
export type {
  ChatMessage,
  HandlerRun,
  LazyMacroArg,
  LiteralSegment,
  MacroContext,
  MacroDeadline,
  MacroDefinition,
  MacroError,
  MacroExpansion,
  MacroProcessResult,
  MacroResult,
  MacroSegment,
  MacroSegmentDetail,
  MacroSideEffect,
  MacroVariable,
  MacroVariableValue,
  PresetPromptInfo,
  RenderSegment,
  TrackerView,
} from "./types";
export type { ChoiceGroup, ChoiceSelections } from "./choice-groups";
export { parseMacroNodes, splitMacroArgs, type ASTNode } from "./parse";
export { normalizeMacroText, toSource } from "./normalize";
export { getMacro, hasMacro, isVolatileMacro, getAllMacros, shadowedAliases } from "./registry";
export { containsMacros, MAX_EVAL_DEPTH, MAX_OUTPUT_CHARS, MAX_EVAL_STEPS } from "./evaluate";
export { processMacros, createDefaultContext, TRIM_SENTINEL } from "./process";
export { evaluateConditionExpression } from "./conditions";
export { processPhasedBlocks, containsPhaseMacros, type PhasedBlock, type PhaseEvaluator } from "./phases";
export { parseListArg, formatList, listItemToString } from "./lists";
