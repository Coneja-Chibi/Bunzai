/**
 * Next send's pure rules (RoleCall `PromptPreviewPanel.tsx`, rc-parity 08): the line under the title, the Copy format, the role-or-content search and its highlight. The counts are
 * the forecast's own (the assembler's per message, the turn's estimate for the request); nothing here counts.
 */
export interface Shown { role: string; content: string; tokens: number }

/** "N messages | ~T tokens", "Generating preview..." or "Type a message to see preview" (`PromptPreviewPanel.tsx:101-107`). */
export function statusLine(forecast: { count: number; tokens: number } | null, loading: boolean): string {
  if (forecast) return `${forecast.count} ${forecast.count === 1 ? "message" : "messages"} | ~${forecast.tokens} tokens`;
  return loading ? "Generating preview..." : "Type a message to see preview";
}

/** Copy: each message as `[ROLE]` over its text and a blank line, the blocks joined by a rule (`PromptPreviewPanel.tsx:32-37`). */
export const copyFormat = (messages: readonly Shown[]): string => messages.map((m) => `[${m.role.toUpperCase()}]\n${m.content}\n`).join("\n---\n\n");

/** The search box: a message stays when the query is in its role or its text. */
export function filterMessages<T extends Shown>(messages: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  return q === "" ? [...messages] : messages.filter((m) => m.role.toLowerCase().includes(q) || m.content.toLowerCase().includes(q));
}

/** The text cut into plain and matched parts; the query is plain text, never a pattern. */
export function highlightParts(text: string, query: string): { text: string; hit: boolean }[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [{ text, hit: false }];
  const parts: { text: string; hit: boolean }[] = [];
  const lower = text.toLowerCase();
  let at = 0;
  for (let found = lower.indexOf(q); found >= 0; found = lower.indexOf(q, at)) {
    if (found > at) parts.push({ text: text.slice(at, found), hit: false });
    parts.push({ text: text.slice(found, found + q.length), hit: true });
    at = found + q.length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), hit: false });
  return parts;
}
