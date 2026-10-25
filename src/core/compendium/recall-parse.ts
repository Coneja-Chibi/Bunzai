/**
 * Reading the selector's one JSON answer, once, at the boundary (04b F13): a strict shape, every handle checked against the
 * index it was drawn from. Prose, a wrong shape or a missing list is a refusal with its reason, never an empty success
 * (a pass the caller may repair once). Handles the index does not hold, repeats and anything over the cap are dropped and
 * counted so the trace can say so. The model's reasons are kept short and go to the trace only, never to the narrator (F11).
 */
import { isRecord } from "../guards";
import type { RecallCandidate } from "./recall-index";

export const MAX_REASON = 200;

export type RecallParse =
  | { ok: true; picks: { candidate: RecallCandidate; reason: string }[]; unknown: string[]; repeated: number; trimmed: number }
  | { ok: false; reason: "no_json" | "bad_shape"; detail: string };

/** The first complete JSON object in the text, inside a code fence or bare; null when none parses. */
function firstObject(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)?.[1];
  for (const source of fenced ? [fenced, text] : [text]) {
    for (let start = source.indexOf("{"); start >= 0; start = source.indexOf("{", start + 1)) {
      let depth = 0;
      let quoted = false;
      for (let i = start; i < source.length; i++) {
        const c = source[i]!;
        if (quoted) { if (c === "\\") i++; else if (c === '"') quoted = false; continue; }
        if (c === '"') quoted = true;
        else if (c === "{") depth++;
        else if (c === "}" && --depth === 0) {
          try { return JSON.parse(source.slice(start, i + 1)); } catch { break; }
        }
      }
    }
  }
  return undefined;
}

export function parseRecall(text: string, candidates: ReadonlyMap<string, RecallCandidate>, maxEntries: number): RecallParse {
  const answer = firstObject(text);
  if (answer === undefined) return { ok: false, reason: "no_json", detail: "the answer held no JSON object" };
  if (!isRecord(answer) || !Array.isArray(answer["entry_ids"]) || !answer["entry_ids"].every((h) => typeof h === "string")) return { ok: false, reason: "bad_shape", detail: "entry_ids must be a list of handles" };
  const reasons = isRecord(answer["reasons"]) ? answer["reasons"] : {};
  const picks: { candidate: RecallCandidate; reason: string }[] = [];
  const seen = new Set<string>();
  const unknown: string[] = [];
  let repeated = 0;
  let trimmed = 0;
  for (const raw of answer["entry_ids"] as string[]) {
    const handle = raw.trim();
    const candidate = candidates.get(handle);
    if (!candidate) { unknown.push(handle.slice(0, 40)); continue; }
    if (seen.has(handle)) { repeated++; continue; }
    seen.add(handle);
    if (picks.length >= maxEntries) { trimmed++; continue; }
    const why = reasons[handle];
    picks.push({ candidate, reason: typeof why === "string" ? why.trim().slice(0, MAX_REASON) : "" });
  }
  return { ok: true, picks, unknown, repeated, trimmed };
}
