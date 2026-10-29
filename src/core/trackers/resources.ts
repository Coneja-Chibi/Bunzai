/**
 * The Stats tracker, RoleCall's `resources` module (stores/immersion/resources.ts, ResourcesWingPanel.tsx): HP, MP, AP, shield, XP, level,
 * currency and survival needs, with a change log. Pure: the panel computes the next state with `applyResources` and the scene keeps it
 * (ChatStore rule 43), so every change is one checked write. The defaults are what RoleCall's `initializeImmersionModule` sets when the
 * module is switched on (initialize.ts:176-193), which is also what the module reads as before anything has changed.
 *
 * Differences from RoleCall, each a repaired flaw:
 * - the AP minus button spends 1; RoleCall's called `restoreAp(-1)`, which takes the absolute value and restores;
 * - the MP minus button spends up to 10; RoleCall's `spendMp(10)` refuses when MP is under 10, so the button did nothing below 10.
 */
import { isPlainObject } from "../guards";
import { num as numShape, obj, opt, parsed, rec, str, type Shape } from "./shape";
import { repairOf, type StateSpec } from "./state";
import { single, type RefreshSpec } from "./refresh";

export const RESOURCE_KINDS = ["hp", "mp", "ap", "shield", "xp", "level", "currency"] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export type Need = { value: number; maxValue: number; label?: string };
export type ResourceLogEntry = { id: string; at: number; type: ResourceKind; previous: number; value: number; reason?: string };
export type Resources = {
  hp: number; maxHp: number; mp: number; maxMp: number; ap: number; maxAp: number; shield: number; xp: number; level: number; currency: number;
  needs: Record<string, Need>;
  /** Newest first, at most LOG_MAX (RoleCall's maxLogEntries). */
  log: ResourceLogEntry[];
};

export const LOG_MAX = 100;
const NEEDS_MAX = 50;
const NUM_MAX = 1_000_000_000;
const TEXT_MAX = 200;

export const DEFAULT_RESOURCES: Resources = { hp: 100, maxHp: 100, mp: 50, maxMp: 50, ap: 3, maxAp: 3, shield: 0, xp: 0, level: 1, currency: 100, needs: {}, log: [] };

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** XP needed for a level (resources.ts:getXpForLevel): level 2 = 100, level 3 = 300, level 4 = 600 (its comment says 250 and 450; the formula is what runs). */
export const xpForLevel = (level: number): number => (level <= 1 ? 0 : Math.floor(50 * (level - 1) * level));

function levelFromXp(xp: number, level: number): number {
  let next = level;
  while (xp >= xpForLevel(next + 1)) {
    next++;
    if (next >= 100) break;
  }
  return next;
}

export const percentOf = (current: number, max: number): number => (max <= 0 ? 0 : Math.round((current / max) * 100));

/** The HP bar's colour band (resources.ts:getResourceBarColor): at most 20% is critical, at most 50% is low. */
export const hpBand = (percent: number): "critical" | "low" | "good" => (percent <= 20 ? "critical" : percent <= 50 ? "low" : "good");
/** A need's band (ResourcesWingPanel.tsx:getNeedBarColor): 20, 40 and 60. */
export const needBand = (percent: number): "critical" | "low" | "moderate" | "good" => (percent <= 20 ? "critical" : percent <= 40 ? "low" : percent <= 60 ? "moderate" : "good");

function num(v: unknown, lo: number, hi = NUM_MAX): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null;
}

const KEYS = new Set(["hp", "maxHp", "mp", "maxMp", "ap", "maxAp", "shield", "xp", "level", "currency", "needs", "log"]);

function parseNeeds(raw: unknown): Record<string, Need> | null {
  if (!isPlainObject(raw) || Object.keys(raw).length > NEEDS_MAX) return null;
  const needs: Record<string, Need> = {};
  for (const [key, need] of Object.entries(raw)) {
    if (key.length === 0 || key.length > 40 || key === "__proto__" || !isPlainObject(need) || Object.keys(need).some((k) => k !== "value" && k !== "maxValue" && k !== "label")) return null;
    const value = num(need["value"], 0), maxValue = num(need["maxValue"], 0), label = need["label"];
    if (value === null || maxValue === null || value > maxValue || (label !== undefined && (typeof label !== "string" || label.length > 40))) return null;
    needs[key] = { value, maxValue, ...(label === undefined ? {} : { label: label as string }) };
  }
  return needs;
}

function parseLog(raw: unknown): ResourceLogEntry[] | null {
  if (!Array.isArray(raw) || raw.length > LOG_MAX) return null;
  const out: ResourceLogEntry[] = [];
  for (const entry of raw) {
    if (!isPlainObject(entry) || Object.keys(entry).some((k) => !["id", "at", "type", "previous", "value", "reason"].includes(k))) return null;
    const id = entry["id"], type = entry["type"], reason = entry["reason"];
    const at = num(entry["at"], 0, 1e15), previous = num(entry["previous"], 0), value = num(entry["value"], 0);
    if (typeof id !== "string" || id.length === 0 || id.length > 64 || !RESOURCE_KINDS.includes(type as ResourceKind) || at === null || previous === null || value === null) return null;
    if (reason !== undefined && (typeof reason !== "string" || reason.length > TEXT_MAX)) return null;
    out.push({ id, at, type: type as ResourceKind, previous, value, ...(reason === undefined ? {} : { reason: reason as string }) });
  }
  return out;
}

/** The state the store keeps, checked once: every number finite and in range, current values within their maximums, no unknown field. Null: refused. */
export function parseResources(data: unknown): Resources | null {
  if (!isPlainObject(data) || Object.keys(data).some((k) => !KEYS.has(k))) return null;
  const maxHp = num(data["maxHp"], 1), maxMp = num(data["maxMp"], 0), maxAp = num(data["maxAp"], 0);
  const hp = num(data["hp"], 0), mp = num(data["mp"], 0), ap = num(data["ap"], 0);
  const shield = num(data["shield"], 0), xp = num(data["xp"], 0), level = num(data["level"], 1, 9999), currency = num(data["currency"], 0);
  const needs = parseNeeds(data["needs"] ?? {}), log = parseLog(data["log"] ?? []);
  if ([maxHp, maxMp, maxAp, hp, mp, ap, shield, xp, level, currency].some((v) => v === null) || !needs || !log) return null;
  if (hp! > maxHp! || mp! > maxMp! || ap! > maxAp!) return null;
  return { hp: hp!, maxHp: maxHp!, mp: mp!, maxMp: maxMp!, ap: ap!, maxAp: maxAp!, shield: shield!, xp: xp!, level: level!, currency: currency!, needs, log };
}

/** What the Stats slot holds field by field: the rule each named field passes alone (a current value within its maximum is the whole state's rule, parseResources). */
const whole = (lo: number, hi = NUM_MAX): Shape<number> => parsed((v) => num(v, lo, hi));
export const RESOURCES_STATE: StateSpec = {
  lists: {},
  fields: { hp: whole(0), maxHp: whole(1), mp: whole(0), maxMp: whole(0), ap: whole(0), maxAp: whole(0), shield: whole(0), xp: whole(0), level: whole(1, 9999), currency: whole(0), needs: parsed(parseNeeds), log: parsed(parseLog) },
};

/** The module's state as the panel and the prompt read it: what is stored, else the defaults (the module is on, so it is initialized). */
/** The module's one repair step (state.ts `repairOf`): every reader goes through `readResources`, which uses it, so no read ever shows the defaults in place of a state it can mostly keep. Null: nothing is salvageable. */
export const repairResources = repairOf(RESOURCES_STATE, DEFAULT_RESOURCES, parseResources, (d) => ({ ...d, hp: Math.min(d["hp"] as number, d["maxHp"] as number), mp: Math.min(d["mp"] as number, d["maxMp"] as number), ap: Math.min(d["ap"] as number, d["maxAp"] as number) }));
export const readResources = (data: unknown): Resources => (data === undefined ? DEFAULT_RESOURCES : repairResources(data) ?? DEFAULT_RESOURCES);

export type ResourceAction =
  | { kind: "damage"; amount: number; reason?: string }
  | { kind: "heal"; amount: number; reason?: string }
  | { kind: "mp"; delta: number; reason?: string }
  | { kind: "ap"; delta: number; reason?: string }
  | { kind: "need"; key: string; delta: number }
  | { kind: "restore"; reason?: string }
  | { kind: "clearLog" }
  | { kind: "reset" };

/** Where a change gets its id and time, so a state is a pure function of its inputs. */
export interface Stamp { now: number; id: () => string }

function note(s: Resources, stamp: Stamp, type: ResourceKind, previous: number, value: number, reason?: string): void {
  if (previous === value) return;
  s.log = [{ id: stamp.id(), at: stamp.now, type, previous, value, ...(reason === undefined ? {} : { reason }) }, ...s.log].slice(0, LOG_MAX);
}

/** One panel action, as RoleCall's store does it (resources.ts:176-540), returning the next state. A shield soaks damage before HP is touched. */
export function applyResources(prev: Resources, action: ResourceAction, stamp: Stamp): Resources {
  const s: Resources = { ...prev, needs: { ...prev.needs }, log: prev.log };
  switch (action.kind) {
    case "damage": {
      let rest = Math.abs(action.amount);
      if (s.shield > 0) {
        const before = s.shield;
        s.shield = Math.max(0, before - rest);
        note(s, stamp, "shield", before, s.shield, action.reason ?? "Shield broken");
        rest = Math.max(0, rest - before);
        if (rest === 0) return s;
      }
      const before = s.hp;
      s.hp = clamp(before - rest, 0, s.maxHp);
      note(s, stamp, "hp", before, s.hp, action.reason ?? (prev.shield > 0 ? "Damage (after shield)" : "Damage"));
      return s;
    }
    case "heal": {
      const before = s.hp;
      s.hp = clamp(before + Math.abs(action.amount), 0, s.maxHp);
      note(s, stamp, "hp", before, s.hp, action.reason ?? "Healed");
      return s;
    }
    case "mp": {
      const before = s.mp;
      s.mp = clamp(before + action.delta, 0, s.maxMp);
      note(s, stamp, "mp", before, s.mp, action.reason ?? (action.delta < 0 ? "MP spent" : "MP restored"));
      return s;
    }
    case "ap": {
      const before = s.ap;
      s.ap = clamp(before + action.delta, 0, s.maxAp);
      note(s, stamp, "ap", before, s.ap, action.reason ?? (action.delta < 0 ? "AP spent" : "AP restored"));
      return s;
    }
    case "need": {
      const need = s.needs[action.key];
      if (need) s.needs[action.key] = { ...need, value: clamp(need.value + action.delta, 0, need.maxValue) };
      return s;
    }
    case "restore": {
      const [hp, mp, ap] = [s.hp, s.mp, s.ap];
      s.hp = s.maxHp; s.mp = s.maxMp; s.ap = s.maxAp;
      const reason = action.reason ?? "Full restore";
      note(s, stamp, "hp", hp, s.hp, reason); note(s, stamp, "mp", mp, s.mp, reason); note(s, stamp, "ap", ap, s.ap, reason);
      return s;
    }
    case "clearLog":
      s.log = [];
      return s;
    case "reset": {
      // Clear All Data returns the module to what switching it on gives. What it replaces is written to the log, so nothing is lost silently.
      const next: Resources = { ...DEFAULT_RESOURCES, needs: {}, log: s.log };
      for (const kind of RESOURCE_KINDS) note(next, stamp, kind, prev[kind], next[kind], "Reset");
      return next;
    }
  }
}

/** The narrator's Player line (immersion-context.ts:70-79), word for word. */
export function resourcesLines(r: Resources): string[] {
  return [
    `**Player**: Level ${r.level} | HP ${r.hp}/${r.maxHp} | MP ${r.mp}/${r.maxMp} | AP ${r.ap}/${r.maxAp}` +
      (r.shield > 0 ? ` | Shield ${r.shield}` : "") +
      ` | XP ${r.xp} | Gold ${r.currency}`,
  ];
}

const SCALARS = { hp: "HP", maxHp: "Max HP", mp: "MP", maxMp: "Max MP", ap: "AP", maxAp: "Max AP", shield: "Shield", xp: "XP", level: "Level", currency: "Currency" } as const;
const needsShape = rec(obj({ value: numShape({ lo: 0, hi: NUM_MAX }), maxValue: numShape({ lo: 0, hi: NUM_MAX, def: 100 }), label: opt(str({ max: 40 })) }), NEEDS_MAX);

/** Refresh from chat history (RoleCall initialize-trackers moduleInstructions.resources). The log is the person's history and is never touched. */
export const RESOURCES_REFRESH: RefreshSpec = {
  maxTokens: 4000,
  instruction: () => `Analyze the protagonist's current state. Infer HP (health/injuries), MP (magic/energy), AP (action points, usually 3), level (experience/power), currency (money/gold). Consider any damage taken, exhaustion, or power displays. Also infer survival needs if relevant to the setting. Adjust based on any injuries or exhaustion described.
Format: { "hp": number, "maxHp": number, "mp": number, "maxMp": number, "ap": number, "maxAp": number, "level": number, "currency": number, "shield": number, "xp": number, "needs": { "key": { "value": number (0-100), "maxValue": 100, "label": string } } }
For needs: Include contextually appropriate needs based on the genre (e.g., hunger, thirst, sleep for survival; sanity for horror; stamina for action). Only include needs if they're relevant to the setting.`,
  rows: (d) => {
    const s = readResources(d);
    return [...(Object.keys(SCALARS) as (keyof typeof SCALARS)[]).map((k) => single(k, SCALARS[k], s[k])), single("needs", "Needs", s.needs)];
  },
  next(d, a) {
    const s = readResources(d);
    const sent = (Object.keys(SCALARS) as (keyof typeof SCALARS)[]).filter((k) => a[k] !== undefined);
    const needs = a["needs"] === undefined ? undefined : needsShape.coerce(a["needs"]);
    if ((sent.length === 0 && needs === undefined) || needs === null) return null;
    const out: Resources = { ...s };
    for (const k of sent) {
      const v = numShape({ lo: k === "maxHp" || k === "level" ? 1 : 0, hi: k === "level" ? 9999 : NUM_MAX }).coerce(a[k]);
      if (v === null) return null;
      out[k] = v;
    }
    out.hp = Math.min(out.hp, out.maxHp);
    out.mp = Math.min(out.mp, out.maxMp);
    out.ap = Math.min(out.ap, out.maxAp);
    if (needs) out.needs = Object.fromEntries(Object.entries(needs).map(([k, n]) => [k, { ...n, value: Math.min(n.value, n.maxValue) }]));
    return out;
  },
};
