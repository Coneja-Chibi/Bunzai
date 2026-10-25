/**
 * The regex worker's request check and answer (ADR-009 item 7), kept apart from the `self` wiring in worker.ts so the boundary can
 * be tested. Value-only: a request is one text, or a batch of texts each with its own depth (a scene's messages); anything
 * oversized or malformed is refused whole before the core engine runs. No token, DOM, storage, filesystem or network is reachable.
 */
import { applyRules, type RegexRunOptions, type RegexRunResult } from "../../core/regex";
import type { RegexRule } from "../../entities/regex/schema";
import { isRecord } from "../../core/guards";
import { toErrorMessage } from "../../error-message";

export const MAX_TEXT_CHARS = 200_000;
export const MAX_RULES = 500;
export const MAX_ITEMS = 300;
/** All the texts of one batch together. */
export const MAX_BATCH_CHARS = 1_000_000;

export type RegexReply =
  | { runId: number; ok: true; result: RegexRunResult }
  | { runId: number; ok: true; texts: string[] }
  | { runId: number; ok: false; error: string };

function validRule(value: unknown): value is RegexRule {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.label === "string" &&
    typeof value.find === "string" && typeof value.replace === "string" &&
    typeof value.flags === "string" && Array.isArray(value.phases) &&
    value.phases.every((phase) => typeof phase === "string") &&
    typeof value.enabled === "boolean" && typeof value.sortOrder === "number";
}

const validItems = (items: unknown): items is { text: string; depth: number }[] =>
  Array.isArray(items) && items.length <= MAX_ITEMS &&
  items.every((i) => isRecord(i) && typeof i.text === "string" && typeof i.depth === "number" && Number.isFinite(i.depth)) &&
  items.reduce((n: number, i: { text: string }) => n + i.text.length, 0) <= MAX_BATCH_CHARS;

export function answerRegexRequest(request: unknown): RegexReply {
  const runId = isRecord(request) && typeof request.runId === "number" ? request.runId : -1;
  const refuse = (): RegexReply => ({ runId, ok: false, error: "regex-worker: invalid request" });
  if (!isRecord(request) || runId === -1 || !Array.isArray(request.rules) || request.rules.length > MAX_RULES ||
      !request.rules.every(validRule) || !isRecord(request.options) || typeof request.options.phase !== "string") return refuse();
  const options = request.options as unknown as RegexRunOptions;
  const batch = request.items !== undefined;
  if (batch ? request.text !== undefined || !validItems(request.items) : typeof request.text !== "string" || request.text.length > MAX_TEXT_CHARS) return refuse();
  try {
    if (batch) {
      const items = request.items as { text: string; depth: number }[];
      return { runId, ok: true, texts: items.map((i) => applyRules(i.text, request.rules as RegexRule[], { ...options, depth: i.depth }).text) };
    }
    return { runId, ok: true, result: applyRules(request.text as string, request.rules as RegexRule[], options) };
  } catch (error) {
    return { runId, ok: false, error: toErrorMessage(error) };
  }
}
