/**
 * The input checks and the merges for the Dramaturg's record (specs/stage/chat-store.md rule 48), applied by every ChatStore implementation so they cannot refuse or
 * keep different things: the settings patch, the turns an append adds, the revision guard, and what a write leaves (stamped turns, the oldest past the cap gone).
 * The revision guards the conversation only: an append or a clear bumps it, a settings write leaves it.
 */
import { isPlainObject } from "../../core/guards";
import { StudioConflictError } from "../../studio/errors";
import {
  DRAMATURG_ENTRIES_MAX, DRAMATURG_FAILURE_MAX, DRAMATURG_MODEL_LABEL_MAX, DRAMATURG_READ_SUMMARY_MAX, DRAMATURG_READS_MAX, DRAMATURG_TEXT_MAX, DRAMATURG_TOOL_NAME_MAX,
  type DramaturgEntry, type DramaturgEntryInput, type DramaturgSettings, type DramaturgSettingsPatch, type DramaturgThread,
} from "../contracts/dramaturg-types";
import { checkConnection, fail } from "./chat-rules";
import { EFFORTS } from "./prompting-rules";
import { isWhole } from "./scalar-rules";
import { applySettingsPatch } from "./settings-patch";

const SETTING_KEYS = ["model", "reasoning", "temperature"];
const ENTRY_KEYS = ["role", "text", "reads", "model", "failed"];
const TEMPERATURE_MAX = 2;

/** Decode the entire sealed record before any caller reads or replaces it. */
export function decodeDramaturg(value: unknown, revision: number): DramaturgThread {
  if (!isPlainObject(value) || Object.keys(value).some((key) => key !== "settings" && key !== "entries")) fail("invalid Dramaturg record");
  if (!isWhole(revision, 0) || !isPlainObject(value.settings) || Object.values(value.settings).some((v) => v === null)) fail("invalid Dramaturg settings or revision");
  const settings = mergeDramaturgSettings({}, checkDramaturgSettingsPatch(value.settings));
  if (!Array.isArray(value.entries) || value.entries.length > DRAMATURG_ENTRIES_MAX) fail("invalid Dramaturg conversation");
  const ids = new Set<string>();
  const entries = value.entries.map((entry: unknown): DramaturgEntry => {
    if (!isPlainObject(entry) || !isWhole(entry.at, 0)) fail("invalid Dramaturg entry stamp");
    const id = text(entry.id, "a Dramaturg entry id", 1, 200);
    if (ids.has(id)) fail("duplicate Dramaturg entry id");
    ids.add(id);
    const { id: _id, at, ...input } = entry;
    return { ...checkDramaturgEntries([input])[0]!, id, at };
  });
  return { settings, entries, revision };
}

/** What a scene that has never had a Dramaturg write reads as. */
export const emptyDramaturg = (): DramaturgThread => ({ settings: {}, entries: [], revision: 0 });

/** A patch of known keys, each a valid value or null; anything else refuses the whole patch. */
export function checkDramaturgSettingsPatch(value: unknown): DramaturgSettingsPatch {
  if (!isPlainObject(value)) fail("Dramaturg settings must be a plain object");
  for (const key of Object.keys(value)) if (!SETTING_KEYS.includes(key)) fail(`Dramaturg settings has an unknown field: ${key}`);
  const { model, reasoning, temperature } = value;
  if (model !== undefined && model !== null) checkConnection(model);
  if (reasoning !== undefined && reasoning !== null && (typeof reasoning !== "string" || !EFFORTS.includes(reasoning))) fail(`reasoning must be one of ${EFFORTS.join(", ")} or null`);
  if (temperature !== undefined && temperature !== null && (typeof temperature !== "number" || !Number.isFinite(temperature) || temperature < 0 || temperature > TEMPERATURE_MAX)) {
    fail(`temperature must be a number from 0 to ${TEMPERATURE_MAX}, or null`);
  }
  return value as DramaturgSettingsPatch;
}

/** The settings after a checked patch: a key given replaces, null drops it, a key left out stays. */
export function mergeDramaturgSettings(old: DramaturgSettings, patch: DramaturgSettingsPatch): DramaturgSettings {
  return applySettingsPatch(old, structuredClone(patch)) as DramaturgSettings;
}

const text = (v: unknown, what: string, min: number, max: number): string =>
  typeof v === "string" && v.length >= min && v.length <= max ? v : fail(`${what} must be text of ${min} to ${max} characters`);

/** One to DRAMATURG_ENTRIES_MAX turns, each exactly the stored fields within their limits; one malformed turn refuses them all. */
export function checkDramaturgEntries(value: unknown): DramaturgEntryInput[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > DRAMATURG_ENTRIES_MAX) fail(`entries must be a list of 1 to ${DRAMATURG_ENTRIES_MAX} turns`);
  return value.map((e: unknown): DramaturgEntryInput => {
    if (!isPlainObject(e)) fail("a Dramaturg turn must be a plain object");
    for (const key of Object.keys(e)) if (!ENTRY_KEYS.includes(key)) fail(`a Dramaturg turn has an unknown field: ${key}`);
    if (e.role !== "user" && e.role !== "assistant") fail("a Dramaturg turn's role must be user or assistant");
    const out: DramaturgEntryInput = { role: e.role, text: text(e.text, "a Dramaturg turn's text", 0, DRAMATURG_TEXT_MAX) };
    if (e.reads !== undefined) {
      if (!Array.isArray(e.reads) || e.reads.length > DRAMATURG_READS_MAX) fail(`reads must be a list of at most ${DRAMATURG_READS_MAX}`);
      out.reads = e.reads.map((r: unknown) => {
        if (!isPlainObject(r) || Object.keys(r).some((k) => k !== "tool" && k !== "summary")) fail("a read must be exactly a tool and a summary");
        return { tool: text(r.tool, "a read's tool", 1, DRAMATURG_TOOL_NAME_MAX), summary: text(r.summary, "a read's summary", 0, DRAMATURG_READ_SUMMARY_MAX) };
      });
    }
    if (e.model !== undefined) out.model = text(e.model, "a Dramaturg turn's model", 1, DRAMATURG_MODEL_LABEL_MAX);
    if (e.failed !== undefined) out.failed = text(e.failed, "a Dramaturg turn's failure", 1, DRAMATURG_FAILURE_MAX);
    return out;
  });
}

/** The revision a guarded write names: exactly `{ expectedRevision }`, a whole number. */
export function checkDramaturgGuard(value: unknown): number {
  if (!isPlainObject(value) || Object.keys(value).some((k) => k !== "expectedRevision") || !isWhole(value.expectedRevision, 0)) fail("the guard must be { expectedRevision } with a whole number");
  return value.expectedRevision;
}

/** The conversation after an append: each new turn stamped with a fresh id and `at`, the oldest dropped once more than DRAMATURG_ENTRIES_MAX would be kept. */
export function appendDramaturgEntries(old: readonly DramaturgEntry[], add: readonly DramaturgEntryInput[], newId: () => string, at: number): DramaturgEntry[] {
  return [...old, ...add.map((e) => ({ id: newId(), at, ...e }))].slice(-DRAMATURG_ENTRIES_MAX);
}

/** The record a settings write leaves: the settings merged, the conversation and its revision as they were, since the revision guards the conversation only. */
export const withDramaturgSettings = (old: DramaturgThread, patch: DramaturgSettingsPatch): DramaturgThread => ({ ...old, settings: mergeDramaturgSettings(old.settings, patch) });

/**
 * The record a conversation write (an append or a clear) leaves: a conflict, before anything is made, when it names a revision the record has left; else the
 * turns `next` makes from the old ones, the settings as they were, and the revision bumped.
 */
export function nextDramaturg(old: DramaturgThread, expected: number | undefined, next: (entries: DramaturgEntry[]) => DramaturgEntry[]): DramaturgThread {
  if (expected !== undefined && old.revision !== expected) throw new StudioConflictError("the Dramaturg's conversation changed since it was read");
  return { settings: old.settings, entries: next(old.entries), revision: old.revision + 1 };
}
