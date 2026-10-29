/**
 * Final Cut's "Apply your AI-output regex scripts to input" (RoleCall service.ts:322-334 runs the scene's `ai_output` scripts on each
 * pass's input). Bunzai's equal is the scene's display-phase rules that rewrite text (an overlay rule draws, it does not rewrite). They
 * are imported data and may only run in the page's sandbox worker (ADR-009, AGENTS rule 3), so this asks the page with a regex event
 * (phase "display") and waits for its answer, as the prompt regex does (scene-turn-regex.ts). Nothing here compiles or runs a rule, and
 * it fails closed: a worker that cannot run, an answer that does not fit, or a Stop is an error, never the text unchanged.
 */
import { sceneRules, type SceneSet } from "../core/regex/scene-pass";
import type { RegexRule, RegexSetBody } from "../entities/regex/schema";
import type { TurnEvent } from "./scene-turn";
import { awaitRegex } from "./scene-turn-regex";

/** The page could not apply the scene's regex to a pass's input. */
export class FinalCutRegexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinalCutRegexError";
  }
}

export interface FinalCutRegexInput {
  setIds: readonly string[] | undefined;
  readRegex: ((id: string) => Promise<RegexSetBody | null>) | undefined;
  turnId: string;
  chatId: string;
  names: { user: string; char: string };
  signal: AbortSignal;
  emit(event: TurnEvent): void;
}

/** The scene's text-rewriting display rules, or null when it has none; then the function a pass calls on its input. */
export async function finalCutRegexInput(input: FinalCutRegexInput): Promise<((text: string) => Promise<string>) | null> {
  if (!input.setIds?.length || !input.readRegex) return null;
  const sets: SceneSet[] = [];
  for (const id of input.setIds) {
    const body = await input.readRegex(id).catch(() => null);
    if (body) sets.push({ id, rules: body.rules, enabled: body.enabled !== false });
  }
  const rules: RegexRule[] = sceneRules(sets, "display").filter((r) => !r.overlay);
  if (rules.length === 0) return null;
  return async (text) => {
    if (text === "") return text;
    input.emit({ type: "regex", turnId: input.turnId, rules, items: [{ index: 0, role: "assistant", depth: 0, text }], macros: input.names, phase: "display" });
    const answer = await awaitRegex(input.turnId, input.chatId, input.signal);
    if (answer.kind === "cancel") throw new FinalCutRegexError("Stopped before this scene's regex could run on the pass.");
    if (answer.kind === "failed") throw new FinalCutRegexError(`This scene's regex could not run. ${answer.error}`);
    const keys = Object.keys(answer.texts);
    if (keys.some((k) => k !== "0")) throw new FinalCutRegexError("This scene's regex answered for a message it was not asked about.");
    return answer.texts[0] ?? text;
  };
}

