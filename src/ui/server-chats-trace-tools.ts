/**
 * The tool side of `GET /api/chats/trace`: the turn's stored `tools` section (studio/scene-turn-tools.ts,
 * names, arguments, outcomes and counts, never what a tool returned) read into the Activity feed's LIVE cards. The model is the reply's
 * own, because it is the narrator that made the calls (RoleCall stamps the Compendium's model on its LIVE row, `TVStreamService.ts:581-587`).
 * A trace older than tools has no section and answers null.
 */
import { isRecord, numOr, str } from "../core/guards";
import type { TraceTools, TraceToolCall } from "./app-contract-scenes";

const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter(isRecord) : []);

function callOf(c: Record<string, unknown>): TraceToolCall {
  const detail = isRecord(c["detail"]) ? c["detail"] : {};
  return {
    round: numOr(c["round"], 0), name: str(c["name"]), args: str(c["args"]), ok: c["ok"] === true,
    ...(typeof c["error"] === "string" ? { error: c["error"] } : {}),
    ms: numOr(c["ms"], 0), tokens: numOr(c["tokens"], 0),
    ...(typeof detail["query"] === "string" ? { query: detail["query"] } : {}),
    entries: list(detail["entries"]).map((e) => ({ bookId: str(e["bookId"]), entryId: str(e["entryId"]), bookName: str(e["bookName"]), title: str(e["title"]), tokens: numOr(e["tokens"], 0) })),
  };
}

export function buildTools(section: unknown, model: string, at: number): TraceTools | null {
  if (!isRecord(section)) return null;
  return { at, model, maxRounds: numOr(section["maxRounds"], 0), rounds: numOr(section["rounds"], 0), calls: list(section["calls"]).map(callOf) };
}
