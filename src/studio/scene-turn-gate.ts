/**
 * A turn's one pause for an answer from the page: the turn waits on a promise, keyed by turn, until the page answers or the turn is
 * stopped. A signal that aborts first, or the page leaving, settles it with the gate's `cancel` answer, so nothing can be left
 * waiting. The Prompt Inspector (scene-turn-review.ts) and a scene's prompt regex (scene-turn-regex.ts) each own one.
 */
export interface TurnGate<D> {
  /** Resolves with the page's answer; a signal that aborts first answers `cancel`. */
  wait(turnId: string, chatId: string, signal: AbortSignal): Promise<D>;
  /** Answers a waiting turn; false when the turn is not waiting here (or belongs to another scene). */
  answer(chatId: string, turnId: string, decision: D): boolean;
}

export function turnGate<D>(cancel: D): TurnGate<D> {
  const waiting = new Map<string, { chatId: string; settle(decision: D): void }>();
  return {
    wait: (turnId, chatId, signal) => new Promise((resolve) => {
      const settle = (decision: D): void => {
        signal.removeEventListener("abort", stop);
        waiting.delete(turnId);
        resolve(decision);
      };
      const stop = (): void => settle(cancel);
      waiting.set(turnId, { chatId, settle });
      if (signal.aborted) stop();
      else signal.addEventListener("abort", stop, { once: true });
    }),
    answer(chatId, turnId, decision) {
      const entry = waiting.get(turnId);
      if (entry?.chatId !== chatId) return false;
      entry.settle(decision);
      return true;
    },
  };
}
