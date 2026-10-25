/**
 * The Cycles tracker, RoleCall's `biologicalCycles` module (stores/immersion/biological-cycles.ts, BiologicalCyclesWingPanel.tsx, the prompt line at
 * immersion-context.ts:529-535, the checks in lib/immersion/biological-cycle-generation.ts): heat, rut, pregnancy, ovulation, period, lunar and custom cycles of the
 * characters, with their phase, intensity and what the sub-features add (lunar links, a fertility window, hormone effects, pregnancy and menstrual tracking). Pure:
 * the panel computes the next state with `applyCycles` and the scene keeps it (ChatStore rule 43). Cycles come from Generate and Refresh, which only propose.
 *
 * Differences from RoleCall: Delete marks the cycle and leaves an Undo; the lunar block names the moon by what the cycle says, because the
 * Calendar RoleCall reads the moon from is a Story Director board that is not built yet (Calendar waits on it); a pregnant entry without its week, trimester and days is
 * refused as RoleCall's generation check refuses it, and the same rule guards the store.
 */
import { arr, num, obj, oneOf, opt, rec, bool, dflt, refine, str, type Of, type Shape } from "./shape";
import { appendItem, find, hasUniqueIds, liveOf, markRemoved, patchItem, unmarkRemoved } from "./list";
import type { GenSpec } from "./generate";
import { entry, listOf, norm, sync, type RefreshSpec } from "./refresh";
import { subsKnown } from "./subfeatures";

export const CYCLE_TYPES = ["heat", "rut", "pregnancy", "ovulation", "period", "lunar", "custom"] as const;
export type CycleType = (typeof CYCLE_TYPES)[number];
export const CYCLE_PHASES = ["menstruation", "follicular", "ovulation", "luteal"] as const;
export const MOON_TRIGGERS = ["new_moon", "waxing_crescent", "first_quarter", "waxing_gibbous", "full_moon", "waning_gibbous", "last_quarter", "waning_crescent"] as const;
const MAX_CYCLES = 100;
const text = (max: number, o: { min?: number } = {}) => str({ max, ...o });
const percent = num({ lo: 0, hi: 100 });
const list = (max = 20) => opt(arr(text(300, { min: 1 }), max));

const pregnancy = obj({
  isPregnant: bool(),
  weekNumber: opt(num({ lo: 0, hi: 60 })),
  trimester: opt(num({ lo: 1, hi: 3, int: true })),
  daysPregnant: opt(num({ lo: 0, hi: 400 })),
  dueDate: opt(text(80)), conceptionDate: opt(text(80)),
  babySizeComparison: opt(text(80)), babySizeEmoji: opt(text(16)), babyDevelopment: opt(text(300)),
  symptoms: list(), fertilityLevel: opt(text(40)),
  cycleDay: opt(num({ lo: 0, hi: 400 })), cycleLength: opt(num({ lo: 1, hi: 400 })),
  cyclePhase: opt(oneOf(CYCLE_PHASES)), daysUntilPeriod: opt(num({ lo: -400, hi: 400 })),
  moodSummary: opt(text(300)), energyLevel: opt(percent), cravings: list(),
});
/** RoleCall's generation check (biological-cycle-generation.ts): a pregnancy that is under way says how far along it is. */
const progressed = (c: { pregnancyData?: { isPregnant: boolean; weekNumber?: number | undefined; trimester?: number | undefined; daysPregnant?: number | undefined } | undefined }): boolean =>
  !c.pregnancyData?.isPregnant || (c.pregnancyData.weekNumber !== undefined && c.pregnancyData.trimester !== undefined && c.pregnancyData.daysPregnant !== undefined);
const checked = <T extends object>(shape: Shape<T>): Shape<T> => refine(shape, { fix: (c) => (progressed(c as never) ? c : null), valid: (c) => progressed(c as never) });
const fields = {
  characterName: text(80, { min: 1 }),
  cycleType: oneOf(CYCLE_TYPES, "custom"),
  customTypeName: opt(text(80)),
  currentPhase: text(80, { min: 1 }),
  phaseProgress: opt(percent),
  totalDuration: opt(text(80)),
  effects: opt(arr(text(200, { min: 1 }), 20)),
  symptoms: list(),
  intensity: opt(percent),
  description: opt(text(1500)),
  startedAt: opt(num({ lo: 0, hi: 1e15 })),
  nextPhaseAt: opt(num({ lo: 0, hi: 1e15 })),
  linkedMoonName: opt(text(80)), transformationType: opt(text(80)), transformationTrigger: opt(oneOf(MOON_TRIGGERS)), transformationIntensity: opt(percent),
  fertilityWindow: opt(obj({ start: num({ lo: 0, hi: 400 }), peak: num({ lo: 0, hi: 400 }), end: num({ lo: 0, hi: 400 }) })),
  conceptionChance: opt(percent),
  moodModifiers: list(),
  statEffects: opt(rec(num({ lo: -1000, hi: 1000 }), 20)),
  pregnancyData: opt(pregnancy),
};
const cycleShape = checked(obj({ ...fields, id: text(80, { min: 1 }), removedAt: opt(num({ lo: 0, hi: 1e15 })) }));
type Stored = Of<typeof cycleShape>;
export type Cyc = Omit<Stored, "id" | "removedAt">;
export interface Cycles { cycles: Stored[]; subs: Record<string, boolean> }
export const DEFAULT_CYCLES: Cycles = { cycles: [], subs: {} };

const stateShape = obj({ cycles: arr(cycleShape, MAX_CYCLES * 2), subs: dflt(rec(bool(), 4), {}) });
export function parseCycles(data: unknown): Cycles | null {
  const s = stateShape.check(data);
  return s && hasUniqueIds(s.cycles) && subsKnown("cycles", s.subs) ? s : null;
}
export const readCycles = (data: unknown): Cycles => (data === undefined ? DEFAULT_CYCLES : parseCycles(data) ?? DEFAULT_CYCLES);
export const liveCycles = (c: Cycles): Stored[] => liveOf(c.cycles);
export function typeCounts(c: Cycles): Record<CycleType, number> {
  const counts = Object.fromEntries(CYCLE_TYPES.map((t) => [t, 0])) as Record<CycleType, number>;
  for (const x of liveCycles(c)) counts[x.cycleType]++;
  return counts;
}

/** RoleCall's pregnancy helpers (pregnancy-data.ts). */
export const pregnancyProgress = (week: number): number => Math.min(100, Math.round((week / 40) * 100));
export const trimesterOf = (week: number): 1 | 2 | 3 => (week <= 12 ? 1 : week <= 26 ? 2 : 3);
export const trimesterProgress = (week: number): number => (trimesterOf(week) === 1 ? Math.round((week / 12) * 100) : trimesterOf(week) === 2 ? Math.round(((week - 12) / 14) * 100) : Math.round(((week - 26) / 14) * 100));
export const daysRemaining = (daysPregnant: number): number => Math.max(0, 280 - daysPregnant);

export type CyclesAction =
  | { kind: "add"; cycle: Cyc; id: string; at: number }
  | { kind: "refresh"; id: string; cycle: Cyc }
  | { kind: "remove"; id: string; at: number }
  | { kind: "restore"; id: string };

export function applyCycles(c: Cycles, a: CyclesAction): Cycles {
  switch (a.kind) {
    case "add": {
      const cycles = appendItem(c.cycles, { ...a.cycle, id: a.id, startedAt: a.cycle.startedAt || a.at } as Stored, MAX_CYCLES);
      return cycles ? { ...c, cycles } : c;
    }
    case "refresh": return { ...c, cycles: patchItem(c.cycles, a.id, (x) => ({ ...x, ...a.cycle })) };
    case "remove": return find(c.cycles, a.id) ? { ...c, cycles: markRemoved(c.cycles, a.id, a.at) } : c;
    case "restore": return { ...c, cycles: unmarkRemoved(c.cycles, a.id) };
  }
}

/** The narrator's Biological Cycles line (immersion-context.ts:529-535). Nothing while none is tracked. */
export function cyclesLines(c: Cycles): string[] {
  const live = liveCycles(c);
  return live.length === 0 ? [] : [`**Biological Cycles**: ${live.map((x) => `${x.customTypeName || x.cycleType}: ${x.currentPhase} (intensity ${x.intensity ?? 50})`).join(" | ")}`];
}

/** RoleCall's schema text for a `biologicalCycles` entry (generate-tracker-item/route.ts, moduleSchemas.biologicalCycles), the sub-feature fields only when on. */
export const CYCLES_GEN: GenSpec<Cyc> = {
  description: () => "Biological cycle entry tracking phases and effects",
  schema: (subs) => `{
  "characterName": string,
  "cycleType": "heat" | "rut" | "pregnancy" | "ovulation" | "period" | "lunar" | "custom",
  "customTypeName": string (only if cycleType is "custom"),
  "currentPhase": string (phase name, e.g., "Peak", "Waning", "Dormant"),
  "phaseProgress": number (0-100),
  "totalDuration": string (e.g., "28 days"),
  "effects": [string] (active mechanical effects),
  "symptoms": [string] (physical/emotional symptoms),
  "intensity": number (0-100),
  "description": string (narrative description)${subs["lunarCycles"] ? `,
  "linkedMoonName": string (moon name this cycle tracks),
  "transformationType": string (e.g. "Full Werewolf"),
  "transformationTrigger": "full_moon"|"new_moon"|"waxing_gibbous"|"waning_crescent",
  "transformationIntensity": number (0-100)` : ""}${subs["fertilityTracking"] ? `,
  "fertilityWindow": { "start": number, "peak": number, "end": number },
  "conceptionChance": number (0-100)` : ""}${subs["hormoneEffects"] ? `,
  "moodModifiers": [string],
  "statEffects": { "statName": number }` : ""}${subs["pregnancyTracking"] ? `,
  "pregnancyData": {
    "isPregnant": boolean,
    "weekNumber": number (1-40, only if pregnant),
    "trimester": 1|2|3 (only if pregnant),
    "daysPregnant": number (only if pregnant),
    "dueDate": string (narrative date, only if pregnant),
    "conceptionDate": string (narrative date, only if pregnant),
    "babySizeComparison": string (fruit/object comparison, only if pregnant),
    "babySizeEmoji": string (single emoji for the size, only if pregnant),
    "babyDevelopment": string (what's developing this week, only if pregnant),
    "symptoms": [string] (current symptoms),
    "fertilityLevel": "low"|"moderate"|"high"|"peak"|"infertile" (only if not pregnant),
    "cycleDay": number (day in menstrual cycle, only if not pregnant),
    "cycleLength": number (total cycle length in days, only if not pregnant),
    "cyclePhase": "menstruation"|"follicular"|"ovulation"|"luteal" (only if not pregnant),
    "daysUntilPeriod": number (only if not pregnant),
    "moodSummary": string (brief mood description),
    "energyLevel": number (0-100),
    "cravings": [string] (optional food/other cravings)
  }` : ""}
}`,
  item: checked(obj(fields)) as GenSpec<Cyc>["item"],
};

const cycleKey = (x: { characterName: string; cycleType: string }): string => `${norm(x.characterName)}|${x.cycleType}`;

/** Refresh from chat history (RoleCall initialize-trackers moduleInstructions.biologicalCycles). */
export const CYCLES_REFRESH: RefreshSpec = {
  maxTokens: 6000,
  instruction: (subs) => `If characters are experiencing biological/natural cycles (heat, rut, pregnancy, ovulation, period), extract them.
Format: { "cycles": [${CYCLES_GEN.schema(subs)}] }`,
  rows: (d) => liveCycles(readCycles(d)).map((c) => ({ ...entry("cycles", `${c.characterName} (${c.customTypeName || c.cycleType})`, CYCLES_GEN.item.coerce(c) ?? c), key: cycleKey(c) })),
  next(d, a, env) {
    const made = listOf(a, "cycles", CYCLES_GEN.item, env);
    if (!made) return null;
    const c = readCycles(d);
    return sync(c, liveCycles(c), made, cycleKey, {
      refresh: (s, old, cycle) => applyCycles(s, { kind: "refresh", id: old.id, cycle }),
      add: (s, cycle) => applyCycles(s, { kind: "add", cycle, id: env.id(), at: env.now }),
      remove: (s, old) => env.skipped.length > 0 ? s : applyCycles(s, { kind: "remove", id: old.id, at: env.now }),
    });
  },
};
