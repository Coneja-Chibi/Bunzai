/**
 * `GET /api/chats/variable-history?chatId=&scope=local|global&key=` (rc-parity 08, State's per-variable history; RoleCall keeps no history, only the value). Every reply's trace
 * stores the variables its request changed (`variables`, core/assembly/macro-report.ts), so a variable's history is those records, read for the active take's replies, newest
 * first. A reply from before the record, or one that did not touch the variable, adds nothing. A read only; the newest replies are scanned up to a cap and the answer says so.
 */
import type { ChatStore } from "../stage/contracts/chat-store";
import { WHOLE_BRANCH } from "../studio/scene-branch";
import { variablesOf } from "./server-chats-trace-report";
import { err, json } from "./server-security";
import type { VariableHistory } from "./app-contract-scenes";

/** How many of the newest replies one request reads. */
export const HISTORY_SCAN = 400;

export async function handleVariableHistoryRoute(url: URL, chats: ChatStore): Promise<Response> {
  const chat = await chats.getChat(url.searchParams.get("chatId") ?? "");
  if (!chat) return err("that scene is gone", 404);
  const scope = url.searchParams.get("scope");
  const key = url.searchParams.get("key") ?? "";
  if ((scope !== "local" && scope !== "global") || key === "") return err("scope must be local or global, and a key is required", 400);
  const live = (await chats.readMessages(chat.activeBranchId, { limit: WHOLE_BRANCH })).messages.filter((m) => !m.cut);
  const number = new Map(live.map((m, i) => [m.id, i + 1]));
  const replies = live.filter((m) => m.role === "assistant").reverse();
  const entries: VariableHistory["entries"] = [];
  for (const m of replies.slice(0, HISTORY_SCAN)) {
    const swipe = m.swipes[m.current]!;
    const trace = await chats.swipeTrace(m.id, swipe.id);
    const change = variablesOf(trace?.["variables"])?.find((c) => c.scope === scope && c.key === key);
    if (change) entries.push({ number: number.get(m.id)!, messageId: m.id, at: swipe.createdAt, ...(change.before !== undefined ? { before: change.before } : {}), ...(change.after !== undefined ? { after: change.after } : {}), ...(change.deleted ? { deleted: true as const } : {}) });
  }
  return json({ entries, truncated: replies.length > HISTORY_SCAN } satisfies VariableHistory);
}
