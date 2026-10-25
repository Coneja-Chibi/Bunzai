/** Where "Retake from here" forks (F10 in rc-message-features.md): the user message right before an earlier reply. */
import type { Row } from "./scene-page-types";

/**
 * Every reply that can be retaken, mapped to the user message it answers as `{ id, n }` (n is that message's number on the page). One pass over the rows.
 * Not here: the greeting, a user message, the take's last reply (it has Regenerate), and a reply that does not follow a user message.
 */
export function retakePoints(rows: readonly Row[]): Map<string, { id: string; n: number }> {
  const out = new Map<string, { id: string; n: number }>();
  let before: Extract<Row, { kind: "msg" }> | undefined; // cut rows are not messages of the take, so they are skipped
  let lastMsg: string | undefined;
  for (const r of rows) {
    if (r.kind !== "msg") continue;
    if (r.m.role === "assistant" && r.n > 1 && before?.m.role === "user") out.set(r.m.id, { id: before.m.id, n: before.n });
    before = r;
    lastMsg = r.m.id;
  }
  if (lastMsg) out.delete(lastMsg);
  return out;
}
