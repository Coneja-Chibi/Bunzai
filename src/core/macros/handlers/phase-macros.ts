/**
 * Phase macro fallbacks: RoleCall's handler inside
 * ADR-012.
 *
 * In preset prompts, {{phase}}/{{defer}}/{{after}} are extracted and orchestrated by
 * processPhasedBlocks (phases.ts) before the evaluator ever sees them. These handlers exist for
 * every other context (lorebook entries, chat messages, single-text expansion) where phased
 * evaluation has no meaning: the body renders inline, in normal order. Registering them also keeps
 * unresolved-macro reporting from treating phase syntax as unknown.
 *
 * No clock or randomness involved, so nothing here changed for ADR-012 beyond the types.
 *
 * Each definition also carries an eager `handler`, ported from RoleCall unchanged, though
 * `evaluateNodes` always prefers `lazyHandler` when both are present (evaluate.ts): see timing.ts's
 * header for the proposed core change that would let these drop.
 */
import type { LazyMacroArg, MacroContext, MacroDefinition, MacroResult } from "../types";

const inlineBody = (args: readonly LazyMacroArg[], from: number): string => args.slice(from).map((a) => a.raw).join("::");

const phaseMacro: MacroDefinition = {
  name: "phase",
  description: "Run content in an evaluation phase (pre_render/render/post_render). Phased in preset prompts; renders inline elsewhere.",
  args: [
    { name: "phase", description: "pre_render | render | post_render", required: true },
    { name: "content", description: "Content for the phase", required: true },
  ],
  category: "text",
  lazyHandler: (args: LazyMacroArg[], _context: MacroContext): MacroResult => {
    if (args.length < 2) return { value: "", success: false, error: "phase requires a phase name and content" };
    return { value: inlineBody(args, 1), success: true };
  },
};

const deferMacro: MacroDefinition = {
  name: "defer",
  description: "Evaluate content at the end of the render pass (sees final state). Phased in preset prompts; renders inline elsewhere.",
  args: [{ name: "content", description: "Content to defer", required: true }],
  category: "text",
  lazyHandler: (args: LazyMacroArg[], _context: MacroContext): MacroResult => ({ value: inlineBody(args, 0), success: true }),
};

const afterMacro: MacroDefinition = {
  name: "after",
  description: "Evaluate content after the named prompt has rendered. Phased in preset prompts; renders inline elsewhere.",
  args: [
    { name: "prompt_id", description: "Prompt this content waits on", required: true },
    { name: "content", description: "Content to evaluate", required: true },
  ],
  category: "text",
  lazyHandler: (args: LazyMacroArg[], _context: MacroContext): MacroResult => {
    if (args.length < 2) return { value: "", success: false, error: "after requires a prompt id and content" };
    return { value: inlineBody(args, 1), success: true };
  },
};

export const PHASE_MACROS_MACROS: readonly MacroDefinition[] = [phaseMacro, deferMacro, afterMacro];
