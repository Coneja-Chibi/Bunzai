/**
 * The turns running in this process (split from scene-turn.ts for the file-size cap): each take of a scene can be answering at once,
 * Stop aborts one, and a scene opening never resumes one (scene-turn-resume.ts).
 */
import type { TurnRuntime } from "./scene-turn-runtime";

/** Stops one of the scene's running turns. */
export function stopTurn(runtime: TurnRuntime, chatId: string, turnId: string): boolean {
  const turn = runtime.running.get(turnId);
  if (turn?.chatId !== chatId) return false;
  turn.controller.abort(new DOMException("stopped", "AbortError"));
  return true;
}

/** Whether any turn is answering in this scene right now (any take): the one question a write to the scene's state asks before it lands beside the turn. */
export const turnRunning = (runtime: TurnRuntime, chatId: string): boolean => [...runtime.running.values()].some((t) => t.chatId === chatId);

/** Recovery must wait until startup has handed ownership to a known checkpoint id. */
export const turnStarting = (runtime: TurnRuntime, chatId: string): boolean => [...runtime.running.values()].some((t) => t.chatId === chatId && t.starting);

export function registerTurn(runtime: TurnRuntime, turnId: string, chatId: string, controller: AbortController): void {
  for (const entry of runtime.running.values()) if (entry.controller === controller) delete entry.starting;
  runtime.running.set(turnId, { chatId, controller });
}
