/**
 * The engine's entry point: normalize, parse, evaluate, post-process (RoleCall's `processMacros`),
 * and report the render as top-level segments tied to the authored source (Bunzai's addition, for
 * the preset workbench's editable preview).
 */
import { capped, evaluateNodes, newState, recordingMap, type EvalState } from "./evaluate";
import { normalizeMacroText, restoreEscapedBraces, toSource, TRIM_SENTINEL } from "./normalize";
import { parseMacroNodes, type ASTNode } from "./parse";
import type { MacroContext, MacroProcessResult, MacroSegmentDetail, RenderSegment } from "./types";

/** Trim-marker collapse, newline squashing, then escaped-brace restore (RoleCall's post-pass). */
const postprocess = (text: string): string =>
  restoreEscapedBraces((text.includes(TRIM_SENTINEL) ? text.replace(/\s*\x04\s*/g, "") : text).replace(/\n{3,}/g, "\n\n"));

function detailOf(node: ASTNode, state: EvalState): MacroSegmentDetail | undefined {
  if (node.type === "blockIf") {
    const taken = state.branchTaken.get(node);
    return taken ? { kind: "branch", taken } : undefined;
  }
  if (node.type !== "macro") return undefined;
  const chosen = state.chosen.get(node);
  if (!chosen) return undefined;
  const chosenIndex = chosen.options.indexOf(chosen.value);
  return chosenIndex === -1 ? undefined : { kind: "choice", options: chosen.options, chosenIndex };
}

/**
 * Run one template. Deterministic for a fixed context (including `now` and `randomSeed`).
 * Variable changes land on the context's maps as they happen, and are listed in `sideEffects`.
 */
export function processMacros(source: string, context: MacroContext): MacroProcessResult {
  // {{rcounter}} state lives on the caller's context, so counts continue across one build's blocks.
  context.counters ??= new Map();
  const state = newState(context);
  const run: MacroContext = {
    ...context,
    localVariables: recordingMap(context.localVariables, "local", state.touched),
    globalVariables: recordingMap(context.globalVariables, "global", state.touched),
  };

  const normalized = normalizeMacroText(source);
  const nodes = parseMacroNodes(normalized.text);

  // Segments are provenance, not a partition of `text`: the flat render is post-processed as a
  // whole, so a trim marker or newline run can span a boundary. What holds: a literal segment's
  // value is the authored slice verbatim, so splicing an edit into its range never corrupts the source.
  const segments: RenderSegment[] = [];
  let flat = "";
  for (const node of nodes) {
    const value = evaluateNodes([node], run, state, 0);
    // The ceiling holds for the whole run, not only for each top-level node.
    flat = capped(state, flat + value);
    const span = toSource(normalized, node.start, node.end);
    if (node.type === "text") {
      segments.push({ kind: "literal", value: source.slice(span.start, span.end), sourceStart: span.start, sourceEnd: span.end });
    } else {
      segments.push({
        kind: "macro",
        name: node.type === "macro" ? node.name : node.type,
        value: postprocess(value),
        raw: source.slice(span.start, span.end),
        sourceStart: span.start,
        sourceEnd: span.end,
        detail: detailOf(node, state),
      });
    }
  }

  return {
    text: postprocess(flat),
    segments,
    expansions: state.expansions,
    errors: state.errors,
    sideEffects: state.sideEffects,
    touchedVariables: [...state.touched].sort(),
    cacheable: !state.volatileHit && state.sideEffects.length === 0,
  };
}

export { TRIM_SENTINEL };

/** An empty context with RoleCall's defaults; fields in `overrides` win. */
export function createDefaultContext(overrides: Partial<MacroContext> = {}): MacroContext {
  return {
    characterName: "Character",
    userName: "User",
    messages: [],
    messageCount: 0,
    localVariables: new Map(),
    globalVariables: new Map(),
    userMacros: new Map(),
    counters: new Map(),
    templates: new Map(),
    blockOverrides: new Map(),
    ...overrides,
  };
}
