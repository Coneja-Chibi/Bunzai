/**
 * The input checks and the merge for a scene's summary, applied by every ChatStore implementation so they cannot refuse or keep different things.
 */
import type { ChatSummary, SummarySettings, SummarySettingsPatch, TakeSummaryInput } from "../contracts/chat-summary-types";
import { isPlainObject } from "../../core/guards";
import { applySettingsPatch } from "./settings-patch";
import { checkConnection, fail } from "./chat-rules";
import { checkWhole } from "./scalar-rules";

export const SUMMARY_TEXT_MAX = 100_000;
export const SUMMARY_PROMPT_MAX = 20_000;
export const SUMMARY_ERROR_MAX = 500;
const COUNT_MAX = 100_000;
const THROUGH_MAX = 1_000_000;

const KEYS = ["auto", "interval", "method", "mode", "include", "hideOld", "window", "keepRecent", "temperature", "maxTokens", "truncate", "reasoning", "model", "prompt"] as const;

const bool = (key: string, v: unknown): boolean => (typeof v === "boolean" ? v : fail(`${key} must be true, false or null`));
const whole = (key: string, v: unknown, min: number, max: number): number => checkWhole(v, `${key} must be a whole number from ${min} to ${max}, or null`, min, max);
const oneOf = <T extends string>(key: string, v: unknown, list: readonly T[]): T => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fail(`${key} must be ${list.join(" or ")}, or null`));

/** A patch of known keys, each a valid value or null. An empty patch is allowed and changes nothing. */
export function checkSummarySettings(value: unknown): SummarySettingsPatch {
  if (!isPlainObject(value)) fail("summary settings must be a plain object");
  for (const key of Object.keys(value)) if (!(KEYS as readonly string[]).includes(key)) fail(`summary settings has an unknown field: ${key}`);
  const out: Record<string, unknown> = {};
  for (const key of KEYS) {
    const v = value[key];
    if (v === undefined) continue;
    if (v === null) { out[key] = null; continue; }
    switch (key) {
      case "auto": case "include": case "hideOld": case "truncate": case "reasoning": out[key] = bool(key, v); break;
      case "interval": out[key] = whole(key, v, 0, COUNT_MAX); break;
      case "window": case "keepRecent": out[key] = whole(key, v, 1, COUNT_MAX); break;
      case "maxTokens": out[key] = whole(key, v, 1, 1_000_000); break;
      case "temperature": out[key] = typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1 ? v : fail("temperature must be a number from 0 to 1, or null"); break;
      case "method": out[key] = oneOf(key, v, ["rolling", "pair"] as const); break;
      case "mode": out[key] = oneOf(key, v, ["replace", "additive"] as const); break;
      case "model": out[key] = checkConnection(v) ?? fail("model must be a connection or null"); break;
      case "prompt": out[key] = typeof v === "string" && v.length <= SUMMARY_PROMPT_MAX ? (v.trim() === "" ? null : v) : fail(`prompt must be text of at most ${SUMMARY_PROMPT_MAX} characters, or null`); break;
    }
  }
  return out as SummarySettingsPatch;
}

/** A saved defaults record read as a patch, or null when it is empty or is not valid summary settings (a hand-edited settings file must not stop a scene starting). */
export function summaryDefaultsOf(raw: unknown): SummarySettingsPatch | null {
  try {
    const patch = checkSummarySettings(raw);
    return Object.keys(patch).length > 0 ? patch : null;
  } catch {
    return null;
  }
}

/** The settings after a checked patch; undefined when nothing is left to keep. */
export function mergeSummarySettings(old: SummarySettings | undefined, patch: SummarySettingsPatch): SummarySettings | undefined {
  const next = applySettingsPatch(old, patch);
  return Object.keys(next).length > 0 ? (next as SummarySettings) : undefined;
}

/** A take's text and how far it reaches; null clears it. */
export function checkTakeSummary(value: unknown): TakeSummaryInput | null {
  if (value === null) return null;
  if (!isPlainObject(value)) fail("a take's summary must be { text, through } or null");
  for (const key of Object.keys(value)) if (key !== "text" && key !== "through") fail(`a take's summary has an unknown field: ${key}`);
  const { text, through } = value;
  if (typeof text !== "string" || text.trim() === "" || text.length > SUMMARY_TEXT_MAX) fail(`text must be some text of at most ${SUMMARY_TEXT_MAX} characters`);
  const reach = whole("through", through, 0, THROUGH_MAX);
  return { text, through: reach };
}

/** The last run's failure in words, or null to clear it. */
export function checkSummaryError(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.trim() === "" || value.length > SUMMARY_ERROR_MAX) fail(`the failure must be some text of at most ${SUMMARY_ERROR_MAX} characters, or null`);
  return value;
}

/** What rides on the chat, or undefined when there is nothing. */
export const publicSummary = (settings: SummarySettings | undefined, error: string | undefined): ChatSummary | undefined =>
  settings || error ? { ...(settings ? { settings } : {}), ...(error ? { error } : {}) } : undefined;
