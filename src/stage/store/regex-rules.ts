/**
 * The input check and the merge for a scene's regex sets and preset choice answers, applied by every
 * ChatStore implementation so they cannot refuse or keep different things.
 */
import type { ChatRegex, ChatRegexPatch, ChoicePick, ChoicePicks } from "../contracts/chat-regex-types";
import { isPlainObject } from "../../core/guards";
import { fail } from "./chat-rules";

export const REGEX_SETS_MAX = 50;
export const CHOICE_PRESETS_MAX = 50;
export const CHOICE_GROUPS_MAX = 100;
const SET_ID_MAX = 200;
const KEY_MAX = 200;
const TEXT_MAX = 2_000;
const MANY_MAX = 100;
const KEYS = ["sets", "rack", "choices"];
const isControl = (c: string): boolean => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127;
const clean = (s: string): boolean => ![...s].some(isControl);

function checkSets(value: unknown, what = "sets"): string[] {
  if (!Array.isArray(value)) fail(`${what} must be a list or null`);
  if (value.length > REGEX_SETS_MAX) fail(`${what} must hold at most ${REGEX_SETS_MAX}`);
  const seen = new Set<string>();
  for (const id of value) {
    if (typeof id !== "string" || id.length === 0 || id.length > SET_ID_MAX || !clean(id)) fail(`a set id must be 1 to ${SET_ID_MAX} characters with no control characters`);
    if (seen.has(id)) fail(`set ${id} is given twice`);
    seen.add(id);
  }
  return [...value];
}

const checkKey = (key: string, what: string): string => (key.length > 0 && key.length <= KEY_MAX && key !== "__proto__" && clean(key) ? key : fail(`${what} must be 1 to ${KEY_MAX} characters with no control characters`));

function checkPick(value: unknown): ChoicePick {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.length <= TEXT_MAX && !value.includes("\u0000") ? value : fail(`an answer must be at most ${TEXT_MAX} characters of text`);
  if (Array.isArray(value) && value.length <= MANY_MAX && value.every((v) => typeof v === "string" && v.length > 0 && v.length <= KEY_MAX && clean(v))) return [...value] as string[];
  return fail(`an answer must be text, a list of at most ${MANY_MAX} option ids, or true or false`);
}

function checkChoices(value: unknown): Record<string, Record<string, ChoicePick | null> | null> {
  if (!isPlainObject(value)) fail("choices must be a plain object or null");
  const presets = Object.entries(value);
  if (presets.length > CHOICE_PRESETS_MAX) fail(`choices must hold at most ${CHOICE_PRESETS_MAX} presets`);
  const out: Record<string, Record<string, ChoicePick | null> | null> = {};
  for (const [presetId, groups] of presets) {
    checkKey(presetId, "a preset id");
    if (groups === null) { out[presetId] = null; continue; }
    if (!isPlainObject(groups)) fail("a preset's answers must be a plain object or null");
    const entries = Object.entries(groups);
    if (entries.length > CHOICE_GROUPS_MAX) fail(`a preset's answers must hold at most ${CHOICE_GROUPS_MAX} groups`);
    out[presetId] = Object.fromEntries(entries.map(([groupId, pick]) => [checkKey(groupId, "a group id"), pick === null ? null : checkPick(pick)]));
  }
  return out;
}

/** A patch whose keys are `sets` (a valid list or null) and `choices` (answers by preset, or null). An empty patch is allowed and changes nothing. */
export function checkRegex(value: unknown): ChatRegexPatch {
  if (!isPlainObject(value)) fail("regex must be a plain object");
  for (const key of Object.keys(value)) if (!KEYS.includes(key)) fail(`regex has an unknown field: ${key}`);
  return {
    ...(value.sets === undefined ? {} : { sets: value.sets === null ? null : checkSets(value.sets) }),
    ...(value.rack === undefined ? {} : { rack: value.rack === null ? null : checkSets(value.rack, "rack") }),
    ...(value.choices === undefined ? {} : { choices: value.choices === null ? null : checkChoices(value.choices) }),
  };
}

function mergeChoices(old: ChatRegex["choices"], patch: NonNullable<ChatRegexPatch["choices"]>): ChatRegex["choices"] {
  const next: Record<string, ChoicePicks> = { ...old };
  for (const [presetId, groups] of Object.entries(patch)) {
    if (groups === null) { delete next[presetId]; continue; }
    const picks: ChoicePicks = { ...next[presetId] };
    for (const [groupId, pick] of Object.entries(groups)) if (pick === null) delete picks[groupId]; else picks[groupId] = pick;
    if (Object.keys(picks).length === 0) delete next[presetId]; else next[presetId] = picks;
  }
  if (Object.keys(next).length > CHOICE_PRESETS_MAX) fail(`choices must hold at most ${CHOICE_PRESETS_MAX} presets`);
  return Object.keys(next).length > 0 ? next : undefined;
}

/** The scene's regex after a checked patch; null when nothing is left to keep. */
export function mergeRegex(old: ChatRegex | undefined, patch: ChatRegexPatch): ChatRegex | null {
  const sets = patch.sets === undefined ? old?.sets : patch.sets ?? undefined;
  const rack = patch.rack === undefined ? old?.rack : patch.rack ?? undefined;
  const choices = patch.choices === undefined ? old?.choices : patch.choices === null ? undefined : mergeChoices(old?.choices, patch.choices);
  const out: ChatRegex = { ...(sets && sets.length > 0 ? { sets } : {}), ...(rack && rack.length > 0 ? { rack } : {}), ...(choices ? { choices } : {}) };
  return Object.keys(out).length > 0 ? out : null;
}
