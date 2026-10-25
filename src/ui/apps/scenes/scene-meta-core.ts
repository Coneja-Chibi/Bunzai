/**
 * The facts a message's meta line shows, ported from RoleCall's EditableMessage (timestamp
 * formatter, finish-reason chip, short model name, generation time). Pure: no React, no clock of
 * its own (the caller passes `now`).
 */

import type { Generation } from "../../../stage/contracts/chat-store";

export type FinishTone = "ok" | "info" | "warn" | "err";
export interface FinishChip { label: string; tone: FinishTone; title: string }

/** The provider's finish reason, shown verbatim (RoleCall never rewords it); the tone is only triage. */
export function finishChip(reason: string | undefined): FinishChip | null {
  if (!reason) return null;
  const r = reason.toLowerCase();
  const title = `Raw finish_reason: "${reason}"`;
  const tone = ((): FinishTone => {
    if (r === "length" || r.includes("max_token") || r === "interrupted") return "warn";
    if (r.includes("filter") || r.includes("safety") || r.includes("recitation") || r.includes("blocklist") || r.includes("prohibited") || r === "spii" || r === "blocked" || r === "error" || r === "failed") return "err";
    if (r === "tool_calls" || r === "tool_use" || r === "function_call" || r === "malformed_function_call" || r === "stop_sequence" || r === "stopped") return "info";
    return "ok";
  })();
  return { label: reason, tone, title };
}

/** The one rule for "this message or version has a time": finite and after the epoch. Every scene time guards with it. */
export const validMs = (ms: number | undefined): ms is number => ms !== undefined && Number.isFinite(ms) && ms > 0;

/** "Oct 4", or nothing when there is no time. */
export function dayStamp(ms: number | undefined): string {
  return validMs(ms) ? new Date(ms).toLocaleDateString([], { month: "short", day: "numeric" }) : "";
}

/** "Oct 4, 03:05 PM", or nothing when there is no time. */
export function dateTimeStamp(ms: number | undefined): string {
  return validMs(ms) ? new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
}

/** "Today at 3:05 PM", or "Oct 4, 3:05 PM" for another day; nothing when there is no time. */
export function formatStamp(ms: number | undefined, now: Date): string {
  if (!validMs(ms)) return "";
  const date = new Date(ms);
  if (date.toDateString() === now.toDateString()) return `Today at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return dateTimeStamp(ms);
}

export function formatGenTime(ms: number | undefined): string {
  if (!ms) return "";
  if (ms >= 60_000) return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

/** "openai/gpt-4o" shows as "gpt-4o". */
export const shortModel = (model: string | undefined): string => model?.split("/").pop() ?? "";

/** RoleCall's showTimestamps, kept in the app preferences. */
export const SHOW_TIMESTAMPS_KEY = "scenes.showTimestamps";
/** On unless the person turned it off. */
export const showTimestamps = (pref: unknown): boolean => pref !== false;

/** What a reply's meta row says about how it was written: the model, how long it took, why it stopped; blank while it streams and on a person's own line. */
export const replyFacts = (gen: Generation | undefined, show: boolean): { model: string | undefined; genTime: string | undefined; finish: string | undefined } =>
  ({ model: show ? shortModel(gen?.model) : undefined, genTime: show ? formatGenTime(gen?.generationMs) : undefined, finish: show ? gen?.finishReason : undefined });
