/**
 * Max Messages (RoleCall's applyMessageContextWindow, jobs/message-context-window.ts): in "messages" mode a turn
 * keeps the newest N prior messages plus the one being answered. One function, used by the send path (studio/
 * scene-turn-load.ts) and the Booth's estimate (ui/apps/scenes/scene-preset-parts.tsx), so they cannot drift.
 * RoleCall rebuilds the greeting from the card, so a window that cuts it still sends it; here it is read back
 * from history, so it is put back in front. A named deviation: RoleCall does nothing when the mode is messages
 * and no count is set, while its slider shows 50; here the count defaults to what the slider shows.
 */
export const DEFAULT_MAX_MESSAGES = 50;

export interface MessageWindowSettings {
  contextMode?: "tokens" | "messages" | undefined;
  maxMessages?: number | undefined;
}

/** `prior` is every message before the one being answered, oldest first. */
export function windowPrior<T extends { role: string }>(prior: readonly T[], settings: MessageWindowSettings | undefined): T[] {
  if (settings?.contextMode !== "messages") return [...prior];
  const keep = Math.max(0, Math.floor(settings.maxMessages ?? DEFAULT_MAX_MESSAGES));
  const kept = keep === 0 ? [] : prior.slice(-keep);
  const greeting = prior[0]?.role === "assistant" && kept[0] !== prior[0] ? prior[0] : undefined;
  return greeting ? [greeting, ...kept] : kept;
}

/**
 * What the next send would carry from a chat shown as `messages`: tokens, how many messages of the chat
 * (`kept` of `total`). A chat ending on the person's message counts that message as the one being answered.
 */
export function estimateMessageWindow<T extends { role: string; content: string }>(
  messages: readonly T[],
  settings: MessageWindowSettings | undefined,
  countTokens: (text: string) => number,
): { tokens: number; kept: number; total: number } {
  const answering = messages.at(-1)?.role === "user" ? messages.slice(-1) : [];
  const sent = [...windowPrior(messages.slice(0, messages.length - answering.length), settings), ...answering];
  return { tokens: sent.reduce((sum, m) => sum + countTokens(m.content), 0), kept: sent.length, total: messages.length };
}
