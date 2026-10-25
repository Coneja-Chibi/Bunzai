/**
 * This turn's pure rules (RoleCall `lib/ai/model-call-inspector/this-turn.ts`, rc-parity 08): which calls a reply's stored trace records, what they
 * total, how its request reads, and the pager between replies. Bunraku has no model-call ledger, so the calls are exactly what the turn stored: the
 * Compendium's recall when it asked a model, and the reply itself. Tokens are the provider's report (Exact) or the turn's own estimate (Estimated),
 * never a recount; a block's size is the assembler's own count.
 */
import type { SceneTrace, TraceBlockView } from "../../../app-contract-scenes";

/** RoleCall folds a request block over this many characters (`OutboundCallsPanel.tsx:57`). */
export const FOLD_OVER_CHARS = 1_200;

export interface CallRow {
  id: "recall" | "narrator";
  phase: "before" | "reply";
  label: string;
  model: string;
  state: "Done" | "Failed" | "Stopped";
  trigger: string;
  sent?: number;
  back?: number;
  /** exact: the provider reported it; estimated: the turn's own estimate; none: nothing was recorded. */
  confidence: "exact" | "estimated" | "none";
  ms?: number;
}

/** The calls the trace records, in the order they ran. */
export function callsOf(trace: SceneTrace): CallRow[] {
  const rows: CallRow[] = [];
  const recall = trace.recall;
  if (recall && recall.calls > 0) {
    rows.push({ id: "recall", phase: "before", label: "Compendium Retrieval", model: recall.model ?? "", state: recall.status === "failed" ? "Failed" : "Done", trigger: "select lore needed by the upcoming narration", confidence: "none" });
  }
  const t = trace.turn;
  const sent = t?.exact ? t.sent : t?.estimate;
  rows.push({
    id: "narrator",
    phase: "reply",
    label: "Narrator",
    model: trace.reply.model,
    state: t?.finish === "stopped" ? "Stopped" : "Done",
    trigger: "user turn",
    ...(sent !== undefined ? { sent } : {}),
    ...(t?.exact && t.back !== undefined ? { back: t.back } : {}),
    confidence: t?.exact ? "exact" : t?.estimate !== undefined ? "estimated" : "none",
    ...(t?.ms !== undefined ? { ms: t.ms } : {}),
  });
  return rows;
}

export interface Totals { calls: number; sent: number; back: number; ms: number | null; unreported: number }

/** The totals tiles: Calls, Sent, Received, Turn time, and how many calls reported no tokens (RoleCall's sky note). */
export function totalsOf(rows: readonly CallRow[]): Totals {
  const timed = rows.flatMap((r) => (r.ms === undefined ? [] : [r.ms]));
  return {
    calls: rows.length,
    sent: rows.reduce((n, r) => n + (r.sent ?? 0), 0),
    back: rows.reduce((n, r) => n + (r.back ?? 0), 0),
    ms: timed.length > 0 ? Math.max(...timed) : null,
    unreported: rows.filter((r) => r.sent === undefined && r.back === undefined).length,
  };
}

/** RoleCall's cuts: milliseconds under a second, one decimal under ten seconds, whole seconds after (`this-turn.ts:92-96`). */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

export interface RequestBlock { role: TraceBlockView["role"]; label: string; tokens: number; text?: string; long: boolean }

/** The request as the reply sent it, in order; a block starts folded when it is long. */
export function requestBlocks(trace: SceneTrace): RequestBlock[] {
  return trace.blocks.map((b) => ({ role: b.role, label: b.label, tokens: b.tokens, ...(b.text !== undefined ? { text: b.text } : {}), long: (b.text?.length ?? 0) > FOLD_OVER_CHARS }));
}

/** The messages as sent, as JSON (RoleCall's Raw JSON); null when the trace kept no text (raw text is kept for each take's latest reply). */
export function rawJson(trace: SceneTrace): string | null {
  if (!trace.rawAvailable) return null;
  return JSON.stringify({ model: trace.reply.model, messages: trace.blocks.map((b) => ({ role: b.role, content: b.text ?? "" })) }, null, 2);
}

/** The replies either side of this one (the trace lists them newest first), and whether this is the newest. */
export function neighbours(trace: SceneTrace): { latest: boolean; older?: string; newer?: string } {
  const at = trace.replies.findIndex((r) => r.messageId === trace.reply.messageId);
  const older = at >= 0 ? trace.replies[at + 1]?.messageId : undefined;
  const newer = at > 0 ? trace.replies[at - 1]?.messageId : undefined;
  return { latest: at <= 0, ...(older ? { older } : {}), ...(newer ? { newer } : {}) };
}

export interface Lane { id: string; label: string; ms: number; percent: number }

/**
 * Where the reply's time went, from the durations the turn stored: the whole reply, the native reasoning, the thinking its own tags held, and each tool call. The trace keeps lengths,
 * not start times, so these are lanes of duration (a bar per part against the whole), never a waterfall with positions. A reply nobody timed has none, and a part with no time is no lane.
 */
export function lanesOf(trace: SceneTrace): Lane[] {
  const total = trace.turn?.ms;
  if (total === undefined || !(total > 0)) return [];
  const lane = (id: string, label: string, ms: number): Lane => ({ id, label, ms, percent: Math.min(100, Math.round((ms / total) * 100)) });
  const parts: Lane[] = [lane("reply", "Reply", total)];
  if ((trace.turn?.reasoningMs ?? 0) > 0) parts.push(lane("reasoning", "Reasoning", trace.turn!.reasoningMs!));
  if ((trace.turn?.tagThinkingMs ?? 0) > 0) parts.push(lane("thinking", "Thinking in the reply", trace.turn!.tagThinkingMs!));
  for (const c of trace.tools?.calls ?? []) if (c.ms > 0) parts.push(lane(`tool-${c.round}-${c.name}`, `Tool call ${c.round}: ${c.name}`, c.ms));
  return parts;
}

export interface RouteRow { number: number; model: string; connectionId: string; kind: string; outcome: "Answered" | "Failed" | "Stopped"; detail: string; served?: string }

const OUTCOME = { answered: "Answered", failed: "Failed", stopped: "Stopped" } as const;

/** The attempts the reply made, in order, each with how it ended and why; `fellBack` when a later attempt followed a failed one (the Fallback Model). */
export function routeRows(route: NonNullable<SceneTrace["route"]>): { attempts: RouteRow[]; fellBack: boolean } {
  const attempts = route.attempts.map((a, i): RouteRow => ({
    number: i + 1,
    model: a.model,
    connectionId: a.connectionId,
    kind: a.kind,
    outcome: OUTCOME[a.outcome ?? "answered"],
    detail: [[a.status, a.code].filter((x) => x !== undefined).join(" "), a.message].filter(Boolean).join(": "),
    ...(a.served ? { served: a.served } : {}),
  }));
  return { attempts, fellBack: route.attempts.length > 1 && route.attempts[0]!.outcome === "failed" };
}
