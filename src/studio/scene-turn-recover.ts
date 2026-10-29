/**
 * Smart Recovery's call (RoleCall's worker recoverMissingReasoningWithHelper): once a reply is written, when the scene's
 * recent replies had thinking and this one has none, the scene's own connection is asked, once, for the first words of the
 * visible reply (core/reasoning-rescue.ts holds the question and the checks). RoleCall asks a helper model; Bunzai has none,
 * so the scene's model answers, with no reasoning, 80 tokens at most and a 12 second limit. The answer only ever sets a
 * boundary kept with the reply; any failure, refusal or unsafe answer leaves the reply as it is.
 */
import type { HistoryMessage } from "../core/assembly/types";
import { anchorSplit, recoveryMessages, shouldAttemptRecovery } from "../core/reasoning-rescue";
import { splitReasoning, type ReasoningFormat } from "../core/reasoning-tags";
import type { Provider } from "../stage/contracts/provider";

const TIMEOUT_MS = 12_000;

/** Where the thinking at the start of `text` ends, or undefined when there is none to find or the check is not warranted. */
export async function recoverThinkingEnd(input: { provider: Provider; model: string; text: string; history: readonly HistoryMessage[]; format: ReasoningFormat; native?: string; signal: AbortSignal }): Promise<number | undefined> {
  const replies = input.history.map((m) => ({ role: m.role, content: m.content, ...(m.reasoning?.model ? { model: m.reasoning.model } : {}), ...(m.reasoning?.text ? { native: true } : {}) }));
  if (input.signal.aborted || !shouldAttemptRecovery({ history: replies, content: input.text, format: input.format, model: input.model, ...(input.native ? { native: input.native } : {}) })) return undefined;
  try {
    const answer = await input.provider.send(
      { model: input.model, messages: recoveryMessages(input.text), options: { max_tokens: 80, temperature: 0, reasoning_effort: "none" } },
      { signal: AbortSignal.any([input.signal, AbortSignal.timeout(TIMEOUT_MS)]) },
    );
    return anchorSplit(input.text, splitReasoning(answer.content).reply) ?? undefined;
  } catch {
    return undefined;
  }
}
