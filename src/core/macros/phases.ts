/**
 * Evaluation phases (RoleCall's macro engine spec Part VIII; RoleCall's macros/phases.ts).
 * Prompts evaluate in order, so a prompt reading a variable a LATER prompt sets sees stale state.
 * Phases let an author say when a piece runs:
 *
 *   {{phase::pre_render::...}}   before any prompt renders
 *   {{phase::render::...}}       normal order (sugar; unwrapped in place)
 *   {{phase::post_render::...}}  after every prompt rendered
 *   {{defer::...}}               the same as post_render, reading final state
 *   {{after::prompt_id::...}}    after the named prompt; for now, the end of the render pass, by
 *                                which time every prompt has run, so the dependency always holds
 *
 * The assembler calls `processPhasedBlocks` with every preset prompt at once. Outside it (lorebook
 * entries, messages, one-off calls) the phase macros render their body inline (handlers/phase-macros).
 *
 * Changed from RoleCall: the brace matching and `::` splitting are the parser's own, not a copy.
 */
import { lexMatchingClose, splitMacroArgs } from "./parse";

export interface PhasedBlock {
  /** Unique id: the preset prompt's identifier, or a positional id. */
  id: string;
  text: string;
}

/** Evaluates one text against the build's shared context. */
export type PhaseEvaluator = (text: string) => string;

type SegmentKind = "pre_render" | "post_render" | "defer" | "after";

interface Segment {
  sentinel: string;
  kind: SegmentKind;
  body: string;
}

/** The phase placeholder; distinct from the escaped-brace (\x01, \x02) and trim (\x04) sentinels. */
const SENTINEL = "\x03";

/** Replace each top-level phase, defer, or after macro in one block with a sentinel. */
function extractSegments(text: string, segments: Segment[]): string {
  let result = "";
  let pos = 0;
  const hold = (kind: SegmentKind, body: string): string => {
    const sentinel = `${SENTINEL}${segments.length}${SENTINEL}`;
    segments.push({ sentinel, kind, body });
    return sentinel;
  };
  while (pos < text.length) {
    const open = text.indexOf("{{", pos);
    const close = open === -1 ? -1 : lexMatchingClose(text, open, text.length);
    if (close === -1) {
      result += text.slice(pos);
      break;
    }
    const parts = splitMacroArgs(text.slice(open + 2, close));
    const name = (parts[0] ?? "").trim().toLowerCase();
    const before = text.slice(pos, open);
    if (name === "phase" && parts.length >= 3) {
      const phase = (parts[1] ?? "").trim().toLowerCase();
      const body = parts.slice(2).join("::");
      // render, or an unknown phase name: inline, in normal order
      result += before + (phase === "pre_render" || phase === "post_render" ? hold(phase, body) : body);
    } else if (name === "defer" && parts.length >= 2) {
      result += before + hold("defer", parts.slice(1).join("::"));
    } else if (name === "after" && parts.length >= 3) {
      result += before + hold("after", parts.slice(2).join("::"));
    } else {
      // Not a phase macro. One nested inside another macro's args falls back to inline rendering.
      result += text.slice(pos, close + 2);
    }
    pos = close + 2;
  }
  return result;
}

/**
 * Evaluate prompt blocks with phases, against the caller's one shared context, so side effects of
 * an earlier pass are visible to later ones. Returns each block's final text by id.
 */
export function processPhasedBlocks(blocks: readonly PhasedBlock[], evaluate: PhaseEvaluator): Map<string, string> {
  const segments: Segment[] = [];
  const stripped = blocks.map((b) => ({ id: b.id, text: extractSegments(b.text, segments) }));
  const outputs = new Map<string, string>();
  const runKind = (kind: SegmentKind): void => {
    for (const seg of segments) if (seg.kind === kind) outputs.set(seg.sentinel, evaluate(seg.body));
  };

  runKind("pre_render");
  const rendered = stripped.map((b) => ({ id: b.id, text: evaluate(b.text) }));
  runKind("after");
  runKind("post_render");
  runKind("defer");

  const texts = new Map<string, string>();
  for (const block of rendered) {
    let text = block.text;
    // A segment's output can hold another sentinel when phases nest; resolve a bounded number of times.
    for (let i = 0; i < 5 && text.includes(SENTINEL); i++) {
      for (const [sentinel, output] of outputs) text = text.split(sentinel).join(output);
    }
    texts.set(block.id, text.replaceAll(SENTINEL, ""));
  }
  return texts;
}

/** Does the text hold a phase-aware macro? A cheap pre-check. */
export const containsPhaseMacros = (text: string): boolean => /\{\{\s*(phase|defer|after)\s*::/i.test(text);
