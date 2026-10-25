/**
 * The loadout record and its receipt: what is stored in the `loadouts` state document,
 * checked once at the boundary. A known panel is checked with the ChatStore's own validators, so a loadout can never
 * hold a value the scene would refuse; a panel this build does not know (a later one, a struck one, a newer build's)
 * is kept whole, bounded, and never read or rewritten.
 */
import { isPlainObject, presentNum } from "../core/guards";
import { LOADOUT_NAME_MAX, LOADOUT_PANEL_IDS, LOADOUT_UNITS, type LoadoutUnit } from "../core/loadout-panels";
import type { JsonValue } from "../stage/contracts/chat-store";
import { checkBackdrop } from "../stage/store/backdrop-rules";
import { checkConnection, checkLore, checkProps } from "../stage/store/chat-rules";
import { checkPreset, checkPresetSamplers } from "../stage/store/preset-rules";
import { checkPrompting } from "../stage/store/prompting-rules";
import { checkFinalCut, mergeFinalCut } from "../stage/store/final-cut-rules";
import { checkRegex } from "../stage/store/regex-rules";
import { toErrorMessage } from "../error-message";
import { StudioValidationError } from "./errors";

export interface LoadoutRecord {
  id: string;
  name: string;
  /** Epoch ms. */
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  /** The panels this loadout owns, known ones in RoleCall's order then unknown ones as given. Always the key set of `values`. */
  panels: string[];
  /** A key present means the loadout owns that panel; null means it clears it. */
  values: Record<string, JsonValue>;
}

export type ReceiptRowState = "pending" | "applied" | "failed" | "not-attempted";
export interface ReceiptRow {
  unit: LoadoutUnit;
  panels: string[];
  state: ReceiptRowState;
  error?: string;
}

/** What one apply wrote and what it replaced, per unit, so Undo can put each back through the same setter. */
export interface LoadoutReceipt {
  code: string;
  chatId: string;
  loadoutId: string;
  loadoutName: string;
  appliedAt: number;
  undoUntil: number;
  undoneAt?: number;
  rows: ReceiptRow[];
  before: Record<string, JsonValue>;
  after: Record<string, JsonValue>;
}

const bad = (message: string): never => {
  throw new StudioValidationError(message);
};
const MAX_PANELS = 64;
const MAX_KEY = 64;
const MAX_UNKNOWN = 65_536;
const MAX_RECEIPT_STATE = 200_000;

function exactly(value: unknown, keys: readonly string[], what: string): Record<string, unknown> {
  if (!isPlainObject(value)) return bad(`${what} must be a plain object`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) bad(`${what} has an unknown field: ${key}`);
  return value;
}

/** Each live panel's rule: the store's own check, so the two can never disagree. */
const CHECKS: Record<string, (v: unknown) => unknown> = {
  preset: (v) => {
    const o = exactly(v, ["id", "toggles"], "preset");
    const p = checkPreset({ id: o["id"], toggles: o["toggles"], samplers: {} });
    return { id: p!.id, toggles: p!.toggles };
  },
  samplers: checkPresetSamplers,
  mainModel: checkConnection,
  lorebooks: checkLore,
  stagecraftProps: checkProps,
  guides: (v) => checkPrompting({ guides: v }).guides,
  authorNote: (v) => checkPrompting({ note: v }).note,
  regex: (v) => checkRegex({ sets: v }).sets,
  postProduction: (v) => {
    const o = exactly(v, ["on", "passes", "tools"], "final cut");
    return mergeFinalCut(undefined, checkFinalCut({ on: o["on"] ?? null, passes: o["passes"] ?? null, tools: o["tools"] ?? null }));
  },
  stageSettings: (v) => ({ backdrop: checkBackdrop(exactly(v, ["backdrop"], "stage settings")["backdrop"]) }),
  persona: (v) => (typeof v === "string" && v.length >= 1 && v.length <= 200 ? v : bad("persona must be an id of 1 to 200 characters")),
};

function checkValue(key: string, value: unknown): JsonValue {
  try {
    if (value !== null && Object.hasOwn(CHECKS, key)) return CHECKS[key]!(value) as JsonValue;
    const text = JSON.stringify(value);
    if (text === undefined || text.length > MAX_UNKNOWN) throw new Error("it is not JSON or is too large to keep");
    return value as JsonValue;
  } catch (e) {
    throw new StudioValidationError(`${key}: ${toErrorMessage(e, "that value is not valid")}`);
  }
}

function checkValues(raw: unknown): Record<string, JsonValue> {
  if (!isPlainObject(raw)) return bad("values must be a plain object");
  const keys = Object.keys(raw);
  if (keys.length > MAX_PANELS) bad(`a loadout holds at most ${MAX_PANELS} panels`);
  for (const key of keys) if (key.length < 1 || key.length > MAX_KEY) bad(`a panel id must be 1 to ${MAX_KEY} characters`);
  const known: string[] = LOADOUT_PANEL_IDS.filter((id) => keys.includes(id));
  return Object.fromEntries([...known, ...keys.filter((k) => !known.includes(k))].map((k) => [k, checkValue(k, raw[k])]));
}

/** A new loadout's name and values, checked; `panels` is derived, never taken from the caller. */
export function parseLoadoutInput(raw: unknown): { name: string; panels: string[]; values: Record<string, JsonValue> } {
  const o = exactly(raw, ["name", "values"], "loadout");
  const name = typeof o["name"] === "string" ? o["name"].trim() : "";
  if (name.length < 1 || name.length > LOADOUT_NAME_MAX) bad(`a loadout name must be 1 to ${LOADOUT_NAME_MAX} characters`);
  const values = checkValues(o["values"]);
  return { name, panels: Object.keys(values), values };
}

const ROW_STATES: readonly string[] = ["pending", "applied", "failed", "not-attempted"];
const text = (v: unknown, what: string, max = 200): string => (typeof v === "string" && v.length >= 1 && v.length <= max ? v : bad(`receipt ${what} must be text of 1 to ${max} characters`));
const time = (v: unknown, what: string): number => presentNum(v) ?? bad(`receipt ${what} must be a time`);

function checkUnitMap(raw: unknown, what: string): Record<string, JsonValue> {
  if (!isPlainObject(raw)) return bad(`receipt ${what} must be a plain object`);
  for (const key of Object.keys(raw)) if (!(LOADOUT_UNITS as readonly string[]).includes(key)) bad(`receipt ${what} has an unknown unit: ${key}`);
  if ((JSON.stringify(raw) ?? "").length > MAX_RECEIPT_STATE) bad(`receipt ${what} is too large`);
  return raw as Record<string, JsonValue>;
}

function checkRow(raw: unknown): ReceiptRow {
  const o = exactly(raw, ["unit", "panels", "state", "error"], "receipt row");
  const unit = LOADOUT_UNITS.find((u) => u === o["unit"]) ?? bad("receipt row has an unknown unit");
  if (!Array.isArray(o["panels"]) || o["panels"].length > LOADOUT_PANEL_IDS.length) bad("receipt row panels must be a short list");
  const panels = (o["panels"] as unknown[]).map((p) => text(p, "row panel", MAX_KEY));
  if (typeof o["state"] !== "string" || !ROW_STATES.includes(o["state"])) bad("receipt row has an unknown state");
  return { unit, panels, state: o["state"] as ReceiptRowState, ...(o["error"] === undefined ? {} : { error: text(o["error"], "row error", 500) }) };
}

/** A receipt, checked: exact fields, known units, bounded state. Used for what a client sends and for what is read back. */
export function parseReceipt(raw: unknown): LoadoutReceipt {
  const o = exactly(raw, ["code", "chatId", "loadoutId", "loadoutName", "appliedAt", "undoUntil", "undoneAt", "rows", "before", "after"], "receipt");
  if (!Array.isArray(o["rows"]) || o["rows"].length > LOADOUT_UNITS.length) bad("receipt rows must be a short list");
  return {
    code: text(o["code"], "code", 64), chatId: text(o["chatId"], "chat id"), loadoutId: text(o["loadoutId"], "loadout id"), loadoutName: text(o["loadoutName"], "loadout name"),
    appliedAt: time(o["appliedAt"], "applied time"), undoUntil: time(o["undoUntil"], "undo time"),
    ...(o["undoneAt"] === undefined ? {} : { undoneAt: time(o["undoneAt"], "undone time") }),
    rows: (o["rows"] as unknown[]).map(checkRow), before: checkUnitMap(o["before"], "before"), after: checkUnitMap(o["after"], "after"),
  };
}
