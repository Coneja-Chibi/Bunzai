/**
 * The Bonds tracker, RoleCall's `bonds` module (stores/immersion/bonds.ts, BondsWingPanel.tsx, the prompt line at immersion-context.ts:248-256): supernatural
 * connections between the player and others, with their strength, effects and drawbacks. Pure: the panel computes the next state with `applyBonds` and the scene
 * keeps it (ChatStore rule 43). Bonds come from Generate and Refresh, which only propose (generate.ts).
 *
 * The intensity word follows from the value (RoleCall recomputes it on every change), so only the value is kept. Differences from RoleCall: a
 * full list (200) refuses another bond where RoleCall drops the oldest; "Break" is offered only on a bond that can be broken, where RoleCall draws it on every bond and
 * it does nothing on an unbreakable one; Strengthen and Weaken (strengthen_bond, weaken_bond) are the Story Director's.
 */
import { arr, bool, dflt, num, obj, oneOf, opt, str, type Of } from "./shape";
import { repairOf, stateSpec } from "./state";
import { appendItem, hasUniqueIds } from "./list";
import type { GenSpec } from "./generate";
import { entry, listOf, norm, sync, type RefreshSpec } from "./refresh";

export const BOND_TYPES = ["sire_childe", "blood_bound", "pack_member", "coven_bond", "soul_link", "familiar", "oath_bound", "curse_linked", "dream_walker", "telepathic", "life_debt", "custom"] as const;
export type BondType = (typeof BOND_TYPES)[number];
export type Intensity = "faint" | "weak" | "moderate" | "strong" | "overwhelming" | "absolute";
export const INTENSITIES: readonly Intensity[] = ["faint", "weak", "moderate", "strong", "overwhelming", "absolute"];

const MAX_BONDS = 200;
const text = (max: number, o: { min?: number } = {}) => str({ max, ...o });
const list = (max = 20) => opt(arr(text(300, { min: 1 }), max));
const fields = {
  bondType: oneOf(BOND_TYPES, "custom"),
  customTypeName: opt(text(80)),
  partnerName: text(80, { min: 1 }),
  partnerRole: opt(text(80)),
  playerRole: opt(text(80)),
  intensityValue: num({ lo: 0, hi: 100, def: 50 }),
  intensityDescription: opt(text(600)),
  description: opt(text(1500)),
  activeEffects: dflt(arr(text(300, { min: 1 }), 30), []),
  passiveEffects: list(),
  drawbacks: list(),
  canBeBroken: bool({ def: true }),
  breakConditions: list(),
  strengthenConditions: list(),
};
const bondShape = obj({ ...fields, id: text(80, { min: 1 }), isActive: bool(), formedAt: num({ lo: 0, hi: 1e15 }), lastStrengthened: opt(num({ lo: 0, hi: 1e15 })), lastWeakened: opt(num({ lo: 0, hi: 1e15 })) });
export type Bond = Omit<Of<typeof bondShape>, "id" | "isActive" | "formedAt" | "lastStrengthened" | "lastWeakened"> & Partial<Pick<Of<typeof bondShape>, "id" | "isActive" | "formedAt" | "lastStrengthened" | "lastWeakened">>;
type Stored = Of<typeof bondShape>;
export interface Bonds { bonds: Stored[] }
export const DEFAULT_BONDS: Bonds = { bonds: [] };

export const intensityOf = (value: number): Intensity => (value >= 95 ? "absolute" : value >= 75 ? "overwhelming" : value >= 50 ? "strong" : value >= 30 ? "moderate" : value >= 15 ? "weak" : "faint");

/** The module's whole state, field by field: what a state passes, and what a slot holds one field or row of (state.ts). */
export const stateShape = obj({ bonds: arr(bondShape, MAX_BONDS * 2) });
export function parseBonds(data: unknown): Bonds | null {
  const s = stateShape.check(data);
  return s && hasUniqueIds(s.bonds) ? s : null;
}
/** What bonds keeps in its slot (state.ts). */
export const BONDS_STATE = stateSpec(stateShape, { bonds: "id" });
/** The module's one repair step (state.ts `repairOf`): every reader goes through `readBonds`, which uses it, so no read ever shows the defaults in place of a state it can mostly keep. Null: nothing is salvageable. */
export const repairBonds = repairOf(BONDS_STATE, DEFAULT_BONDS, parseBonds);
export const readBonds = (data: unknown): Bonds => (data === undefined ? DEFAULT_BONDS : repairBonds(data) ?? DEFAULT_BONDS);
export const activeBonds = (b: Bonds): Stored[] => b.bonds.filter((x) => x.isActive);
export const brokenBonds = (b: Bonds): Stored[] => b.bonds.filter((x) => !x.isActive);
export const totalStrength = (b: Bonds): number => activeBonds(b).reduce((sum, x) => sum + x.intensityValue, 0);
export const strongest = (b: Bonds): Stored | undefined => activeBonds(b).reduce<Stored | undefined>((best, x) => (best === undefined || x.intensityValue > best.intensityValue ? x : best), undefined);

export type BondsAction =
  | { kind: "form"; bond: Bond; id: string; at: number }
  | { kind: "refresh"; id: string; bond: Bond }
  | { kind: "break"; id: string };

const sameName = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/** One panel action, as RoleCall's store does it (bonds.ts:formBond, updateBond, breakBond), returning the next state; the same state when nothing changes. */
export function applyBonds(b: Bonds, a: BondsAction): Bonds {
  switch (a.kind) {
    case "form": {
      const same = activeBonds(b).find((x) => sameName(x.partnerName, a.bond.partnerName) && x.bondType === a.bond.bondType);
      if (same) {
        const { id: _i, isActive: _a, formedAt: _f, ...fresh } = a.bond;
        return { bonds: b.bonds.map((x) => (x === same ? { ...x, ...fresh, intensityValue: Math.max(same.intensityValue, a.bond.intensityValue) } : x)) };
      }
      const bonds = appendItem(b.bonds, { ...a.bond, id: a.id, formedAt: a.at, isActive: true } as Stored, MAX_BONDS);
      return bonds ? { bonds } : b;
    }
    case "refresh": {
      const { id: _i, isActive: _a, formedAt: _f, ...fresh } = a.bond;
      return { bonds: b.bonds.map((x) => (x.id === a.id ? { ...x, ...fresh } : x)) };
    }
    case "break": {
      const bond = b.bonds.find((x) => x.id === a.id && x.isActive);
      if (!bond || !bond.canBeBroken) return b;
      return { bonds: b.bonds.map((x) => (x === bond ? { ...x, isActive: false, intensityValue: 0 } : x)) };
    }
  }
}

/** The narrator's Bonds line (immersion-context.ts:248-256): each active bond as its type with the partner and the intensity word. Nothing without an active bond. */
export function bondsLines(b: Bonds): string[] {
  const active = activeBonds(b);
  return active.length === 0 ? [] : [`**Bonds**: ${active.map((x) => `${x.bondType} with ${x.partnerName} (${intensityOf(x.intensityValue)}, active)`).join(", ")}`];
}

/** RoleCall's schema text for a `bonds` entry (generate-tracker-item/route.ts, moduleSchemas.bonds). */
export const BONDS_GEN: GenSpec<Bond> = {
  description: () => "Supernatural or mystical bond/connection. Pick the most fitting bondType; if none fit, use 'custom' with a customTypeName. activeEffects must be MECHANICAL/SUPERNATURAL effects (e.g., 'Sense partner's emotions', 'Shared pain transfers'), NOT narrative descriptions. drawbacks are negative consequences of the bond.",
  schema: () => `{
  "bondType": "sire_childe" | "blood_bound" | "pack_member" | "coven_bond" | "soul_link" | "familiar" | "oath_bound" | "curse_linked" | "dream_walker" | "telepathic" | "life_debt" | "custom",
  "customTypeName": string (REQUIRED if bondType is "custom", e.g., "Ancestral Pact", "Royal Ward Bond"),
  "partnerName": string,
  "partnerRole": string (e.g., "Sire", "Pack Alpha", "Coven Leader"),
  "playerRole": string (e.g., "Childe", "Beta", "Initiate"),
  "intensity": "faint" | "weak" | "moderate" | "strong" | "overwhelming",
  "intensityValue": number (0-100),
  "intensityDescription": string (what this intensity level feels like for THIS specific bond \u2014 evocative, bond-specific),
  "description": string (how/why the bond was formed),
  "activeEffects": [string] (supernatural/mechanical effects like "Sense partner within 1 mile", "Shared dreams"),
  "drawbacks": [string] (negative consequences like "Compelled to obey direct commands"),
  "canBeBroken": boolean,
  "breakConditions": [string] (what would sever the bond),
  "strengthenConditions": [string] (what deepens the bond)
}`,
  item: obj(fields) as GenSpec<Bond>["item"],
};

const bondKey = (x: { partnerName: string; bondType: string }): string => `${norm(x.partnerName)}|${x.bondType}`;

/**
 * Refresh from chat history (RoleCall initialize-trackers moduleInstructions.bonds). A bond has no soft-remove mark, only broken, and breaking one is the person's act, so a
 * refresh never removes a bond: one the answer leaves out stays as it is.
 */
export const BONDS_REFRESH: RefreshSpec = {
  maxTokens: 6000,
  instruction: (subs) => `Identify any supernatural, magical, or mystical bonds/connections between the protagonist and other characters (blood bonds, soul links, pack bonds, oaths, curses, etc.). Return every bond that still holds.
Pick the most fitting bondType. If none of the predefined types fit, use "custom" and provide a customTypeName (e.g., "Political Blood Oath", "Ancestral Pact").
activeEffects should be MECHANICAL/SUPERNATURAL effects (e.g., "Sense partner's emotions within range", "Shared pain \u2014 damage transfers partially", "Telepathic whispers in dreams"), NOT narrative descriptions of the relationship.
drawbacks should be negative consequences (e.g., "Compelled to obey direct commands", "Weakened when far from bonded partner").
Format: { "bonds": [${BONDS_GEN.schema(subs)}] }`,
  rows: (d) => activeBonds(readBonds(d)).map((b) => ({ ...entry("bonds", b.partnerName, BONDS_GEN.item.coerce(b) ?? b), key: bondKey(b) })),
  next(d, a, env) {
    const made = listOf(a, "bonds", BONDS_GEN.item, env);
    if (!made) return null;
    const b = readBonds(d);
    return sync(b, activeBonds(b), made, bondKey, {
      refresh: (s, old, bond) => applyBonds(s, { kind: "refresh", id: old.id, bond }),
      add: (s, bond) => applyBonds(s, { kind: "form", bond, id: env.id(), at: env.now }),
    });
  },
};
