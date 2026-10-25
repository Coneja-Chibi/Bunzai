/**
 * The page's half of a scene's prompt regex (studio/scene-turn-regex.ts): the turn holds its request and hands over the rules and the
 * conversation messages; the page runs them in the sandbox worker (ADR-009), one batch per role and a hundred messages, and answers with
 * the texts that changed, or with why it could not, so the turn can stop instead of sending what a rule meant to remove.
 */
import type { TurnEvent } from "../../../studio/scene-turn";
import { rulesForRole } from "../../../core/regex/scene-pass";
import { runRegexBatchSandboxed } from "../workbench/regex/run-in-worker";

const CHUNK = 100;
type Asked = Extract<TurnEvent, { type: "regex" }>;
export type RegexAnswerBody = { kind: "done"; texts: Record<number, string> } | { kind: "failed"; error: string };

/** Runs the asked rules and sends the answer through `send`. Never throws: a failure to answer leaves the turn to its Stop. */
export async function answerPromptRegex(asked: Asked, send: (answer: RegexAnswerBody) => Promise<unknown>, workerFactory?: () => Worker): Promise<void> {
  const texts: Record<number, string> = {};
  // A replacement that carries a macro has its captured text hidden from the macro pass the turn runs afterwards (RoleCall's protectCapture).
  const protectCaptures = asked.rules.some((r) => r.replace.includes("{{"));
  let answer: RegexAnswerBody = { kind: "done", texts };
  // Final Cut's input (phase "display") runs the scene's AI-output rules as they stand; a prompt regex filters them by role first.
  const phase = asked.phase ?? "prompt";
  for (const role of ["user", "assistant"] as const) {
    const rules = phase === "display" ? asked.rules : rulesForRole(asked.rules, role);
    const items = asked.items.filter((i) => i.role === role);
    for (let at = 0; at < items.length && answer.kind === "done"; at += CHUNK) {
      const chunk = items.slice(at, at + CHUNK);
      const run = await runRegexBatchSandboxed(chunk.map((i) => ({ text: i.text, depth: i.depth })), rules, { phase, target: phase, macros: asked.macros, protectCaptures, ...(workerFactory ? { workerFactory } : {}) });
      if (!run.ok) { answer = { kind: "failed", error: run.error }; break; }
      chunk.forEach((item, n) => { if (run.texts[n] !== item.text) texts[item.index] = run.texts[n]!; });
    }
  }
  await send(answer).catch(() => undefined);
}
