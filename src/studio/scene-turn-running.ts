/**
 * The turns running in this process (split from scene-turn.ts for the file-size cap): each take of a scene can be answering at once,
 * Stop aborts one, and a scene opening never resumes one (scene-turn-resume.ts).
 */
export const running = new Map<string, { chatId: string; controller: AbortController }>();

/** Stops one of the scene's running turns. */
export function stopTurn(chatId: string, turnId: string): boolean {
  const turn = running.get(turnId);
  if (turn?.chatId !== chatId) return false;
  turn.controller.abort(new DOMException("stopped", "AbortError"));
  return true;
}
