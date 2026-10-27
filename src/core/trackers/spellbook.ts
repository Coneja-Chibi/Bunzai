/**
 * The Spellbook tracker, RoleCall's `spellbook` module (stores/immersion/spellbook.ts, SpellbookWingPanel.tsx, the prompt line at immersion-context.ts:283-310): the
 * spells the player knows, has seen or has only read about, and Casting them. Pure: the panel computes the next state with `applySpellbook` and `castSpell` and the
 * scene keeps it (ChatStore rule 43). Spells come from Generate and Refresh, which only propose (generate.ts).
 *
 * A cast pays its cost out of the Stats tracker, starts the spell's cooldown, adds to its mastery and history, and leaves `pendingCast`: RoleCall's
 * `spellCastInjection`, a note the narrator reads with the next reply (worker.ts:2463), which the reply then spends (`afterReply`).
 *
 * Differences from RoleCall: Delete marks the spell and leaves an Undo; a full book (300) refuses another where RoleCall drops the oldest;
 * a cast that cannot be made (not learned, cooling down, too little mana) spends nothing, where RoleCall takes the cost first and the store then refuses; RoleCall
 * never counts a cooldown down (tickCooldowns is only reachable from its /btw agent), so a cast would lock the spell for good, and here each reply after the cast takes
 * one turn off; the spell waiting to ride the next reply is shown and can be cancelled, where RoleCall holds it in a hidden ref; a blank Mana Cost in the edit form
 * clears the field where RoleCall saves 0; the Wild Magic sub-feature, which does nothing in RoleCall's panel, adds the susceptibility to what Generate writes and to Edit.
 */
import { readDice, rollDice, rollText } from "../dice";
import { arr, bool, dflt, num, obj, oneOf, opt, rec, str, type Of } from "./shape";
import { appendItem, find, hasUniqueIds, liveOf, markRemoved, patchItem, unmarkRemoved } from "./list";
import type { GenSpec } from "./generate";
import { byName, entry, listOf, sync, type RefreshSpec } from "./refresh";
import { applyResources, type Resources, type Stamp } from "./resources";
import { subsKnown } from "./subfeatures";

export const TEMPLATES = ["attack", "buff", "debuff", "heal", "utility", "summon", "passive", "ritual"] as const;
export const STATUSES = ["learned", "observed", "theoretical"] as const;
export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;
export type Template = (typeof TEMPLATES)[number];
export type SpellStatus = (typeof STATUSES)[number];

const MAX_SPELLS = 300;
const HISTORY_MAX = 10;
const text = (max: number, o: { min?: number; def?: string } = {}) => str({ max, ...o });
const strings = (max = 20) => opt(arr(text(300, { min: 1 }), max));
const cost = obj({ resource: text(40, { min: 1 }), amount: num({ lo: 0, hi: 1_000_000 }), label: opt(text(40)) });
const fields = {
  name: text(120, { min: 1 }),
  template: oneOf(TEMPLATES, "utility"),
  description: text(2000, { def: "" }),
  class: opt(text(80)),
  level: num({ lo: 1, hi: 10, int: true, def: 1 }),
  rarity: opt(oneOf(RARITIES)),
  status: oneOf(STATUSES, "learned"),
  proficiency: opt(num({ lo: 0, hi: 100 })),
  manaCost: opt(num({ lo: 0, hi: 1_000_000 })),
  cooldown: opt(text(60)),
  range: opt(text(60)),
  duration: opt(text(60)),
  damage: opt(text(60)),
  element: opt(text(40)),
  healing: opt(text(60)),
  buffEffects: strings(),
  debuffEffects: strings(),
  passiveEffect: opt(text(500)),
  ritualComponents: strings(),
  narrativeCost: opt(text(300)),
  emotionalAffinity: opt(text(60)),
  castingCost: opt(cost),
  castingRequirement: opt(text(300)),
  diceFormula: opt(text(20)),
  successThreshold: opt(num({ lo: 0, hi: 1000 })),
  wildMagicSusceptibility: opt(num({ lo: 0, hi: 100 })),
};
const historyEntry = obj({ castAt: num({ lo: 0, hi: 1e15 }), context: text(300), outcome: opt(text(300)), manaSpent: opt(num({ lo: 0, hi: 1_000_000 })), diceResult: opt(text(200)) });
const spellShape = obj({
  ...fields,
  id: text(80, { min: 1 }),
  observedFrom: opt(text(120)),
  cooldownRemaining: opt(num({ lo: 0, hi: 1000, int: true })),
  area: opt(text(60)),
  castTime: opt(text(60)),
  summonDescription: opt(text(500)),
  isSignature: opt(bool()),
  castHistory: opt(arr(historyEntry, HISTORY_MAX)),
  masteryLevel: opt(num({ lo: 0, hi: 100 })),
  removedAt: opt(num({ lo: 0, hi: 1e15 })),
});
type Stored = Of<typeof spellShape>;
export type Spell = Stored;
export type SpellMade = Omit<Stored, "id" | "isSignature" | "castHistory" | "masteryLevel" | "removedAt" | "cooldownRemaining" | "observedFrom" | "area" | "castTime" | "summonDescription">;

export interface Spellbook { spells: Stored[]; subs: Record<string, boolean>; /** The note the next reply carries (RoleCall's spellCastInjection). */ pendingCast?: string }
export const DEFAULT_SPELLBOOK: Spellbook = { spells: [], subs: {} };

const stateShape = obj({ spells: arr(spellShape, MAX_SPELLS * 2), subs: dflt(rec(bool(), 4), {}), pendingCast: opt(text(6000)) });
export function parseSpellbook(data: unknown): Spellbook | null {
  const s = stateShape.check(data);
  return s && hasUniqueIds(s.spells) && subsKnown("spellbook", s.subs) ? s : null;
}
export const readSpellbook = (data: unknown): Spellbook => (data === undefined ? DEFAULT_SPELLBOOK : parseSpellbook(data) ?? DEFAULT_SPELLBOOK);
export const liveSpells = (b: Spellbook): Stored[] => liveOf(b.spells);

export const masteryLabel = (level: number): string => (level >= 76 ? "Master" : level >= 51 ? "Adept" : level >= 26 ? "Practiced" : "Novice");
export const masteryOf = (s: Stored): number => s.masteryLevel || s.proficiency || 0;
export const cooldownTurns = (cooldown?: string): number => {
  const m = cooldown?.match(/(\d+)/);
  return m ? Number.parseInt(m[1]!, 10) : 0;
};

export interface EditPatch { name: string; description: string; manaCost: number | undefined; narrativeCost: string | undefined; castingRequirement: string | undefined; emotionalAffinity: string | undefined; wildMagicSusceptibility?: number | undefined }

export type SpellbookAction =
  | { kind: "add"; spell: SpellMade; id: string }
  | { kind: "refresh"; id: string; spell: SpellMade }
  | { kind: "edit"; id: string; patch: EditPatch }
  | { kind: "signature"; id: string }
  | { kind: "unsignature"; id: string }
  | { kind: "ready"; id: string }
  | { kind: "clearPending" }
  | { kind: "remove"; id: string; at: number }
  | { kind: "restore"; id: string };

/** A key given with a value is set; given blank or undefined it is taken away. */
function withField<T extends object>(o: T, key: string, value: unknown): T {
  const { [key]: _old, ...rest } = o as Record<string, unknown>;
  return (value === undefined || value === "" ? rest : { ...rest, [key]: value }) as T;
}

/** One panel action, as RoleCall's store does it (spellbook.ts:addSpell, updateSpell, setSignatureSpell, clearSignatureSpell), returning the next state. */
export function applySpellbook(b: Spellbook, a: SpellbookAction): Spellbook {
  switch (a.kind) {
    case "add": {
      const spells = appendItem(b.spells, { ...a.spell, id: a.id } as Stored, MAX_SPELLS);
      return spells ? { ...b, spells } : b;
    }
    case "refresh": return { ...b, spells: patchItem(b.spells, a.id, (s) => ({ ...s, ...a.spell })) };
    case "edit": return { ...b, spells: patchItem(b.spells, a.id, (s) => {
      let next = { ...s, name: a.patch.name, description: a.patch.description };
      for (const key of ["manaCost", "narrativeCost", "castingRequirement", "emotionalAffinity"] as const) next = withField(next, key, a.patch[key]);
      return "wildMagicSusceptibility" in a.patch ? withField(next, "wildMagicSusceptibility", a.patch.wildMagicSusceptibility) : next;
    }) };
    case "signature": {
      const target = find(b.spells, a.id);
      if (!target) return b;
      const current = liveSpells(b).filter((s) => s.isSignature);
      const oldest = current.length >= 2 && !target.isSignature ? current[0]!.id : null;
      return { ...b, spells: b.spells.map((s) => (s.id === a.id ? { ...s, isSignature: true } : s.id === oldest ? { ...s, isSignature: false } : s)) };
    }
    case "unsignature": return { ...b, spells: patchItem(b.spells, a.id, (s) => ({ ...s, isSignature: false })) };
    case "ready": return { ...b, spells: patchItem(b.spells, a.id, (s) => withField(s, "cooldownRemaining", undefined)) };
    case "clearPending": {
      const { pendingCast: _p, ...rest } = b;
      return "pendingCast" in b ? rest : b;
    }
    case "remove": return find(b.spells, a.id) ? { ...b, spells: markRemoved(b.spells, a.id, a.at) } : b;
    case "restore": return { ...b, spells: unmarkRemoved(b.spells, a.id) };
  }
}

/** RoleCall's dice formula (lib/utils/dice.ts): "2d6", "d20", "1d20+3", "3d8-2", a count of 1 to 100 and sides of 2 to 1000. */
export function parseDiceFormula(formula: string): { count: number; sides: number; modifier: number } | null {
  const d = readDice(formula.trim());
  return !d || d.count < 1 || d.count > 100 || d.sides < 2 || d.sides > 1000 ? null : d;
}
function rollFormula(formula: string, rand: () => number): string | undefined {
  const p = parseDiceFormula(formula);
  if (!p) return undefined;
  const roll = rollDice(p, rand);
  return `Rolled ${roll.total} (${formula}: ${rollText(roll)})`;
}

/** RoleCall's wild magic surges (SpellbookWingPanel.tsx:WILD_MAGIC_EFFECTS). */
export const WILD_MAGIC_EFFECTS: readonly string[] = [
  "Your hair changes color for an hour", "Small harmless sparks dance around your fingertips", "The temperature drops noticeably for a moment", "A faint echo of your voice repeats your last words",
  "Nearby flowers bloom instantly then wilt", "You glow faintly for a few seconds", "A harmless spectral butterfly appears and vanishes", "The scent of fresh rain fills the air",
  "Your shadow moves independently for a moment", "A distant bell tolls once", "Gravity briefly weakens; small objects float nearby", "Your eyes briefly shimmer with starlight",
  "A small illusion of a campfire flickers at your feet", "The spell leaves a trail of glowing runes in the air", "Time seems to slow for everyone except you for a heartbeat",
  "A phantom wind ruffles everyone's hair", "Your voice echoes with a second, deeper voice", "Tiny crystals form on nearby surfaces then melt",
  "A strange symbol appears on your palm then fades", "You briefly see the world in inverted colors",
];

export interface CastOptions { intent: string; tactical: boolean; at: number; rand: () => number; stamp: Stamp }
export type CastResult = { ok: true; spellbook: Spellbook; resources: Resources; injection: string; message: string } | { ok: false; reason: string };

/** RoleCall's buildCastInjection (SpellbookWingPanel.tsx:561-612). */
function injectionOf(spell: Stored, spent: { resource: string; amount: number; label?: string } | null, dice: string | undefined, intent: string, rand: () => number): string {
  const parts = [`[SPELL CAST] The player invokes "${spell.name}" (${spell.template}, Level ${spell.level}).`];
  if (spell.description) parts.push(`Description: ${spell.description}`);
  if (spent) parts.push(`Cost: ${spent.amount} ${spent.label || spent.resource}.`);
  else if (spell.narrativeCost) parts.push(`Narrative cost: ${spell.narrativeCost}.`);
  if (spell.castingRequirement) parts.push(`Requirement: ${spell.castingRequirement}.`);
  if (dice) parts.push(`Dice roll: ${dice}.`);
  if (intent) parts.push(`Player's intent: "${intent}"`);
  if (spell.emotionalAffinity) parts.push(`Emotional resonance: ${spell.emotionalAffinity}.`);
  if (spell.wildMagicSusceptibility && spell.wildMagicSusceptibility > 0 && Math.floor(rand() * 100) + 1 <= spell.wildMagicSusceptibility) {
    parts.push(`[WILD MAGIC SURGE] A random magical side effect occurs: ${WILD_MAGIC_EFFECTS[Math.floor(rand() * WILD_MAGIC_EFFECTS.length)]}. Narrate this side-effect alongside the spell's main effect.`);
  }
  parts.push(dice ? "Narrate the casting with these mechanical results woven into the scene." : "Narrate the casting and its effects naturally through storytelling.");
  return parts.join("\n");
}

/** Casting a spell (SpellbookWingPanel.tsx:485-558 and spellbook.ts:castSpell), as one decision: either everything below happens or nothing does. */
export function castSpell(b: Spellbook, r: Resources, id: string, o: CastOptions): CastResult {
  const spell = find(b.spells, id);
  if (!spell) return { ok: false, reason: "That spell is gone" };
  if (spell.status !== "learned") return { ok: false, reason: `Spell is ${spell.status}, not learned` };
  if (spell.cooldownRemaining && spell.cooldownRemaining > 0) return { ok: false, reason: `On cooldown (${spell.cooldownRemaining} turns remaining)` };
  const price = spell.castingCost ?? (spell.manaCost ? { resource: "mp", amount: spell.manaCost } : null);
  let resources = r;
  if (price) {
    const need = r.needs[price.resource];
    const enough = price.resource === "mp" ? r.mp >= price.amount : price.resource === "hp" ? r.hp > price.amount : price.resource === "ap" ? r.ap >= price.amount : need ? need.value >= price.amount : true;
    if (!enough) return { ok: false, reason: `Not enough ${("label" in price && price.label) || price.resource} (need ${price.amount})` };
    const why = `Cast ${spell.name}`;
    resources = price.resource === "mp" ? applyResources(r, { kind: "mp", delta: -price.amount, reason: why }, o.stamp)
      : price.resource === "hp" ? applyResources(r, { kind: "damage", amount: price.amount, reason: `Blood cost: ${spell.name}` }, o.stamp)
      : price.resource === "ap" ? applyResources(r, { kind: "ap", delta: -price.amount, reason: why }, o.stamp)
      : applyResources(r, { kind: "need", key: price.resource, delta: -price.amount }, o.stamp);
  }
  const dice = o.tactical && spell.diceFormula ? rollFormula(spell.diceFormula, o.rand) : undefined;
  const cooldown = cooldownTurns(spell.cooldown);
  const gain = Math.max(1, Math.min(5, Math.ceil(spell.level / 2)));
  const entry = { castAt: o.at, context: o.intent || "Cast during the current scene", ...(dice ? { diceResult: dice } : {}), ...(price ? { manaSpent: price.amount } : spell.manaCost !== undefined ? { manaSpent: spell.manaCost } : {}) };
  const injection = injectionOf(spell, price, dice, o.intent, o.rand);
  const spellbook: Spellbook = {
    ...b,
    pendingCast: injection,
    spells: patchItem(b.spells, id, (s) => ({ ...s, ...(cooldown > 0 ? { cooldownRemaining: cooldown } : {}), castHistory: [...(s.castHistory ?? []), entry].slice(-HISTORY_MAX), masteryLevel: Math.min(100, (s.masteryLevel || 0) + gain) })),
  };
  return { ok: true, spellbook, resources, injection, message: `${spell.name} cast successfully!${dice ? ` ${dice}` : ""}${cooldown > 0 ? ` (${cooldown} turn cooldown)` : ""}` };
}

/** What a committed reply does to the book: it spends the cast it carried, or else takes a turn off every cooldown. The same book when there is nothing to do. */
export function afterReply(b: Spellbook, carriedCast: boolean): Spellbook {
  if (carriedCast && b.pendingCast !== undefined) return applySpellbook(b, { kind: "clearPending" });
  if (!b.spells.some((s) => (s.cooldownRemaining ?? 0) > 0)) return b;
  return { ...b, spells: b.spells.map((s) => ((s.cooldownRemaining ?? 0) > 0 ? { ...s, cooldownRemaining: Math.max(0, (s.cooldownRemaining ?? 0) - 1) } : s)) };
}

/** The narrator's Spellbook line (immersion-context.ts:283-310). Nothing while no spell is known. */
export function spellbookLines(b: Spellbook): string[] {
  const known = liveSpells(b).filter((s) => s.status === "learned");
  if (liveSpells(b).length === 0 || known.length === 0) return [];
  const cooling = known.filter((s) => (s.cooldownRemaining ?? 0) > 0);
  const ready = known.filter((s) => !s.cooldownRemaining);
  const signature = known.filter((s) => s.isSignature);
  let line = `**Spellbook**: ${known.length} learned`;
  if (ready.length > 0 && ready.length !== known.length) line += ` (${ready.length} ready)`;
  if (cooling.length > 0) line += ` | On cooldown: ${cooling.map((s) => `${s.name} (${s.cooldownRemaining} turns)`).join(", ")}`;
  if (signature.length > 0) line += ` | Signature: ${signature.map((s) => s.name).join(", ")}`;
  const top = [...known].sort((x, y) => (y.masteryLevel || 0) - (x.masteryLevel || 0)).slice(0, 3);
  if (top.length > 0) line += ` | Known: ${top.map((s) => `${s.name} (${s.template})`).join(", ")}`;
  return [line];
}

/** The note that rides the next reply, if the Spellbook is holding one (RoleCall worker.ts:2463). */
export const pendingInjection = (data: unknown): string | undefined => readSpellbook(data).pendingCast;

const BASE_SCHEMA = `{
  "name": string,
  "template": "attack" | "buff" | "debuff" | "heal" | "utility" | "summon" | "passive" | "ritual",
  "description": string,
  "class": string (e.g., "Pyromancy", "Divine", "Necromancy"),
  "level": number (1-10),
  "rarity": "common" | "uncommon" | "rare" | "epic" | "legendary",
  "status": "learned" | "observed" | "theoretical",
  "proficiency": number (0-100),
  "manaCost": number,
  "cooldown": string (e.g., "3 turns"),
  "range": string (e.g., "30ft", "self"),
  "duration": string (e.g., "3 rounds", "instant"),
  "damage": string (for attack, e.g., "3d8 fire"),
  "element": string (for attack, e.g., "fire", "ice"),
  "healing": string (for heal, e.g., "2d6+4"),
  "buffEffects": [string] (for buff),
  "debuffEffects": [string] (for debuff),
  "passiveEffect": string (for passive),
  "ritualComponents": [string] (for ritual),
  "narrativeCost": string (optional, a poetic cost like "Drains your warmth" or "Costs a cherished memory"),
  "emotionalAffinity": string (optional, an emotion the spell resonates with like "hope", "rage", "grief"),
  "castingCost": { "resource": string (mp/hp/ap or custom like fury/ki), "amount": number } (optional, if the spell uses something besides mana),
  "castingRequirement": string (optional, a narrative requirement like "Must be under moonlight")`;

/** RoleCall's schema text for a `spellbook` entry (generate-tracker-item/route.ts, moduleSchemas.spellbook): the dice fields only in tactical mode. */
export const SPELLBOOK_GEN: GenSpec<SpellMade> = {
  description: (subs) => (subs["tacticalMode"] ? "Spell or ability entry with full mechanical detail (tactical mode enabled)" : "Spell or ability entry with narrative focus"),
  schema: (subs) => BASE_SCHEMA
    + (subs["wildMagic"] ? ',\n  "wildMagicSusceptibility": number (optional, 0-100, the chance this spell misfires with a random magical side effect)' : "")
    + (subs["tacticalMode"] ? ',\n  "diceFormula": string (optional, for tactical mode \u2014 dice formula like "2d6+3"),\n  "successThreshold": number (optional, for tactical mode \u2014 DC or target number)\n}' : "\n}"),
  item: obj(fields) as GenSpec<SpellMade>["item"],
};

/** Refresh from chat history (RoleCall initialize-trackers moduleInstructions.spellbook, both branches). */
export const SPELLBOOK_REFRESH: RefreshSpec = {
  maxTokens: 8000,
  instruction: (subs) => (subs["tacticalMode"]
    ? `Extract spells, abilities, or powers the protagonist has learned, observed, or knows about. List only spells the conversation shows, with full mechanical detail: mana costs, dice formulas (e.g. '2d6+3' in diceFormula field), cooldowns in turns, damage/healing amounts, range, area of effect. Include both combat and utility spells. For each spell also include: narrativeCost (a poetic/story cost like "Drains your warmth"), emotionalAffinity (an emotion the spell resonates with like "hope" or "rage"), and castingCost with resource type (mp, hp, ap, or a custom pool like fury/ki) and amount.`
    : `Extract spells, abilities, or powers the protagonist has learned, observed, or knows about. List only spells the conversation shows; do not invent any. Focus on evocative names, rich descriptions, and emotional/narrative costs. Include manaCost as a rough guide. Include narrativeCost (a poetic cost beyond mana, like "Costs a cherished memory" or "Drains your warmth"), emotionalAffinity (an emotion like "hope", "rage", "grief"), and optionally castingCost if the spell uses something other than mana (hp for blood magic, a custom pool like fury or ki). Omit dice formulas and strict mechanical details.`)
    + `\nFormat: { "spells": [${SPELLBOOK_GEN.schema(subs)}] }`,
  rows: (d) => liveSpells(readSpellbook(d)).map((s) => entry("spells", s.name, SPELLBOOK_GEN.item.coerce(s) ?? s)),
  next(d, a, env) {
    const made = listOf(a, "spells", SPELLBOOK_GEN.item, env);
    if (!made) return null;
    const b = readSpellbook(d);
    return sync(b, liveSpells(b), made, byName, {
      refresh: (s, old, spell) => applySpellbook(s, { kind: "refresh", id: old.id, spell }),
      add: (s, spell) => applySpellbook(s, { kind: "add", spell, id: env.id() }),
      remove: (s, old) => env.skipped.length > 0 ? s : applySpellbook(s, { kind: "remove", id: old.id, at: env.now }),
    });
  },
};
