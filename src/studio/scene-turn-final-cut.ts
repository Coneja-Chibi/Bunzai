/**
 * Final Cut inside the turn (RoleCall lib/ai/jobs/worker.ts:4915-5040): once the reply is in hand and before it is saved, the scene's
 * passes run over it and the text they leave is what is saved, "Final Cut pass..." showing meanwhile. What a run did rides with the
 * reply: the original text and each pass's outcome in the swipe's trace (`finalCut`, rule 15), a summary in its generation, so the
 * saved text, its trace and its summary are one commit and undoing a pass is putting the original back (an edit, which keeps the
 * pass's text in the edit history). A Stop keeps what the passes so far accepted. A pass set to Block generation fails the turn: nothing
 * is saved and the reply comes back as a draft. A continue is never run (its stored text is only the addition).
 */
import { splitReasoning, type ReasoningFormat } from "../core/reasoning-tags";
import { activePasses } from "../core/final-cut/pass";
import { rulebookOf } from "../core/final-cut/rulebook";
import type { Bank } from "../core/final-cut/banks";
import type { Chat, Generation, JsonObject } from "../stage/contracts/chat-store";
import { FinalCutRegexError, finalCutRegexInput } from "./final-cut-regex";
import { FinalCutBlocked, runFinalCut, type FinalCutRun } from "./final-cut-run";
import type { PassResult } from "./final-cut-pass";
import type { ReadPreset } from "./scene-turn-load";
import type { TurnDeps, TurnEvent } from "./scene-turn";

/** The most characters one run's trace holds before the diffs and raw answers are left out. */
const TRACE_CHARS = 200_000;

export interface FinalCutStage {
  text: string;
  trace: JsonObject;
  summary: NonNullable<Generation["finalCut"]>;
}

/** A pass as the trace keeps it: no text (the run's original and the saved text hold that), the diff only while the trace fits. */
const passTrace = (r: PassResult, lean: boolean): JsonObject => JSON.parse(JSON.stringify({
  id: r.id, type: r.type, ...(r.label ? { label: r.label } : {}), status: r.status, changed: r.changed, ms: r.durationMs, ...(r.model ? { model: r.model } : {}),
  changelog: r.changelog, warnings: r.warnings, ...(r.ruleReview ? { ruleReview: r.ruleReview } : {}), ...(r.reflected ? { reflected: true } : {}),
  ...(lean ? {} : { diff: r.diff, ...(r.raw ? { raw: r.raw } : {}) }),
})) as JsonObject;

export function traceOfRun(run: FinalCutRun): JsonObject {
  const build = (lean: boolean): JsonObject => ({ v: 1, at: run.at, ms: run.ms, ...(run.changed ? { original: run.original } : {}), ...(run.stopped ? { stopped: run.stopped } : {}), passes: run.passes.map((p) => passTrace(p, lean)) });
  const full = build(false);
  return JSON.stringify(full).length > TRACE_CHARS ? build(true) : full;
}

/** The thinking that opened the reply goes back on in front of what the passes left (they read the reply without it), when the reply ended with what they were given. */
function withThinking(original: string, reply: string, final: string): string {
  const head = original.length - reply.length;
  return head > 0 && original.endsWith(reply) && !final.startsWith(original.slice(0, head)) ? original.slice(0, head) + final : final;
}

export async function finalCutStage(a: {
  deps: Pick<TurnDeps, "connect" | "now" | "readPreset" | "readRegex">;
  /** The turn that asked, so the page can be asked to run the scene's regex on a pass's input; absent for a re-run, which has no page to ask. */
  turnId?: string;
  chat: Chat;
  text: string;
  history: readonly { role: string; content: string }[];
  format: ReasoningFormat | undefined;
  /** The person's own banks, merged into Anti-Slop; absent: none. */
  userBanks?(): Promise<Record<string, Bank>>;
  signal: AbortSignal;
  emit(event: TurnEvent): void;
}): Promise<FinalCutStage | { stop: TurnEvent } | null> {
  const { chat, text, deps } = a;
  const passes = chat.finalCut?.on ? activePasses(chat.finalCut.passes) : [];
  if (passes.length === 0 || !text.trim() || !chat.connection) return null;
  const custom = passes.find((p) => p.type === "custom-agent");
  const preset = custom?.customPresetId ? await readPreset(deps.readPreset, custom.customPresetId) : null;
  const strip = (t: string): string => splitReasoning(t, a.format).reply;
  const regexInput = await finalCutRegexInput({
    setIds: chat.regex?.sets, readRegex: deps.readRegex, turnId: a.turnId ?? "", chatId: chat.id, signal: a.signal,
    names: { user: chat.cast.persona?.name ?? "User", char: chat.cast.character.name ?? "" },
    emit: a.turnId ? a.emit : () => { throw new FinalCutRegexError(RERUN_REFUSAL); },
  });
  try {
    const run = await runFinalCut({
      text, passes, signal: a.signal,
      progress: (p, index) => a.emit({ type: "finalcut", pass: p.label || p.type, index, of: passes.length }),
      env: {
        open: deps.connect, scene: chat.connection, strip, now: deps.now,
        context: { ...(chat.cast.character.name ? { characterName: chat.cast.character.name } : {}), role: "assistant", recentMessages: a.history.filter((m) => m.role !== "system" && m.content.trim()).slice(-10) },
        rulebook: rulebookOf(preset, custom?.customPresetPromptStates),
        userBanks: (await a.userBanks?.().catch(() => null)) ?? {},
        ...(regexInput ? { regexInput } : {}),
      },
    });
    const final = run.changed ? withThinking(text, strip(text), run.final) : text;
    return { text: final, trace: traceOfRun({ ...run, final }), summary: { passes: run.passes.length, changed: final !== text, failed: run.passes.filter((p) => p.status === "failed").length } };
  } catch (error) {
    if (error instanceof FinalCutRegexError) return { stop: { type: "failed", category: "regex_error", code: "regex_unavailable", message: `Final Cut did not run and the reply was not saved. ${error.message}`, draft: text } };
    if (!(error instanceof FinalCutBlocked)) throw error;
    return { stop: { type: "failed", category: "invalid_request_error", code: "final_cut_blocked", message: `Final Cut (${error.pass}) blocked this reply and it was not saved. ${error.message}`, draft: text } };
  }
}

const RERUN_REFUSAL = "A rerun cannot run this scene's regex scripts, which run only in the page. Turn off \"Apply your AI-output regex scripts to input\" on the passes, then rerun.";

const readPreset = (read: ReadPreset, id: string) => read(id).catch(() => null);
