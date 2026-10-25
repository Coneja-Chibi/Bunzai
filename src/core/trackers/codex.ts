/**
 * The Creature Codex tracker, RoleCall's `creatureCodex` module (stores/immersion/creature-codex.ts, CreatureCodexWingPanel.tsx, the prompt block at
 * immersion-context.ts:456-510): a bestiary of species and of the individual creatures met, with what the sub-features add (stats, combat, ecology, taming, arcana,
 * research). Pure: the panel computes the next state with `applyCodex` and the scene keeps it (ChatStore rule 43). Species and creatures come from Generate and Refresh,
 * which only propose (generate.ts); a creature is generated for a species by name.
 *
 * Differences from RoleCall: Delete marks and leaves an Undo, and deleting a species takes its creatures with it in the same mark (RoleCall
 * deletes them), so Undo brings back both; a full list refuses another where RoleCall drops the oldest; a generated creature is attached to the species it names, and a
 * name that matches none is refused, where RoleCall files it with an empty species id and the card then has no species; the deprecated `overrides` object is not kept.
 * The Logging toggle (Encountered Only or All) steers only the Story Director's logging and is not drawn.
 */
import { arr, bool, dflt, num, obj, oneOf, opt, rec, str, type Of } from "./shape";
import { appendItem, find, hasUniqueIds, liveOf, patchItem, sameName } from "./list";
import type { GenSpec } from "./generate";
import { byName, entry, listOf, norm, sync, type RefreshSpec } from "./refresh";
import { subsKnown } from "./subfeatures";

export const RARITIES = ["common", "uncommon", "rare", "legendary", "mythical", "unique"] as const;
export const DISPOSITIONS = ["docile", "cautious", "neutral", "aggressive", "territorial", "predatory"] as const;
export const STATUSES = ["alive", "tamed", "captured", "fled", "unknown", "dormant", "dead"] as const;
export const ABILITY_TYPES = ["attack", "spell", "passive", "buff", "debuff", "heal", "utility", "ultimate"] as const;
export const OUTCOMES = ["peaceful", "fled", "fought", "captured", "tamed", "observed", "other"] as const;
export const KNOWLEDGE = ["unknown", "rumored", "observed", "studied", "mastered"] as const;
const MAX_SPECIES = 200, MAX_CREATURES = 200, MAX_ENCOUNTERS = 30;

const text = (max: number, o: { min?: number; def?: string } = {}) => str({ max, ...o });
const strings = (max = 20) => opt(arr(text(300, { min: 1 }), max));
const need = obj({ value: num({ lo: 0, hi: 100000 }), maxValue: num({ lo: 0, hi: 100000, def: 100 }), label: opt(text(60)) });
const ability = obj({ name: text(80, { min: 1 }), type: oneOf(ABILITY_TYPES, "utility"), description: text(600, { def: "" }), effects: dflt(arr(text(300, { min: 1 }), 10), []), usageNotes: text(400, { def: "" }),
  damage: opt(text(60)), cost: opt(text(60)), cooldown: opt(text(60)), range: opt(text(60)), duration: opt(text(60)), element: opt(text(40)) });
const passive = obj({ name: text(80, { min: 1 }), description: text(500, { def: "" }), effect: text(300, { def: "" }) });
const stats = obj({ hp: num({ lo: 0, hi: 1e6 }), maxHp: num({ lo: 0, hi: 1e6 }), mp: opt(num({ lo: 0, hi: 1e6 })), maxMp: opt(num({ lo: 0, hi: 1e6 })), attack: num({ lo: 0, hi: 1e6, def: 0 }), defense: num({ lo: 0, hi: 1e6, def: 0 }), speed: num({ lo: 0, hi: 1e6, def: 0 }), level: opt(num({ lo: 0, hi: 9999 })), xp: opt(num({ lo: 0, hi: 1e9 })), xpToNextLevel: opt(num({ lo: 0, hi: 1e9 })) });
const combat = obj({ threatLevel: num({ lo: 1, hi: 10, def: 1 }), abilities: dflt(arr(text(200, { min: 1 }), 10), []), weaknesses: dflt(arr(text(200, { min: 1 }), 10), []), resistances: strings(10), lootDrops: strings(10), dangerNotes: opt(text(500)) });
const ecology = obj({ ecosystemRole: text(200, { def: "" }), migrationPattern: opt(text(200)), symbioticRelations: strings(10), populationStatus: opt(oneOf(["thriving", "stable", "declining", "endangered", "near-extinct"] as const)), seasonalBehavior: opt(text(200)) });
const taming = obj({ tameable: bool({ def: false }), method: opt(text(300)), requirements: strings(10), loyaltyBase: opt(num({ lo: 0, hi: 100 })), mountable: opt(bool()), specialAbilityWhenTamed: opt(text(300)) });
const arcana = obj({ magicAffinity: opt(text(100)), reagentsYielded: strings(10), ritualUses: strings(10), leyLineInfluence: opt(text(200)), cursedVariant: opt(bool()) });
const research = obj({ knowledgeLevel: oneOf(KNOWLEDGE, "unknown"), fieldNotes: dflt(arr(text(400, { min: 1 }), 10), []), specimensCollected: opt(num({ lo: 0, hi: 100000 })), dissectionNotes: opt(text(500)), pendingHypotheses: strings(10) });
const taxonomy = obj({ order: text(80, { def: "" }), family: text(80, { def: "" }), kind: opt(text(80)), kindRevealed: opt(bool()), kindHint: opt(text(160)) });

const speciesFields = {
  name: text(120, { min: 1 }), classification: text(80, { def: "Beast" }), taxonomy: opt(taxonomy),
  rarity: oneOf(RARITIES, "common"), disposition: oneOf(DISPOSITIONS, "neutral"), habitat: text(200, { def: "Unknown" }),
  description: text(1500, { def: "" }), appearance: text(800, { def: "" }),
  baseTraits: dflt(arr(text(100, { min: 1 }), 12), []), baseBehaviors: dflt(arr(text(200, { min: 1 }), 12), []),
  diet: opt(text(120)), lifespan: opt(text(80)),
  abilities: opt(arr(ability, 10)), passives: opt(arr(passive, 6)), baseNeeds: opt(rec(need, 12)), baseStats: opt(stats),
  combatProfile: opt(combat), ecology: opt(ecology), taming: opt(taming), arcana: opt(arcana), research: opt(research),
};
const speciesShape = obj({ ...speciesFields, id: text(80, { min: 1 }), removedAt: opt(num({ lo: 0, hi: 1e15 })) });
export type Species = Of<typeof speciesShape>;
export type SpeciesMade = Omit<Species, "id" | "removedAt">;

const encounter = obj({ date: text(80, { def: "" }), description: text(500, { def: "" }), outcome: oneOf(OUTCOMES, "other"), notes: opt(text(300)) });
const creatureFields = {
  nickname: opt(text(80)), location: text(160, { def: "Unknown" }), condition: text(300, { def: "healthy" }), mood: text(80, { def: "neutral" }), status: oneOf(STATUSES, "alive"),
  bond: opt(num({ lo: 0, hi: 100 })), trust: opt(num({ lo: 0, hi: 100 })), temperament: opt(text(500)),
  appearance: opt(text(800)), traits: strings(10), behaviors: strings(10), abilities: opt(arr(ability, 10)), passives: opt(arr(passive, 6)),
  encounters: dflt(arr(encounter, MAX_ENCOUNTERS), []), notes: opt(text(1000)), needs: opt(rec(need, 12)), currentStats: opt(obj({ hp: opt(num({ lo: 0, hi: 1e6 })), maxHp: opt(num({ lo: 0, hi: 1e6 })), mp: opt(num({ lo: 0, hi: 1e6 })), maxMp: opt(num({ lo: 0, hi: 1e6 })), attack: opt(num({ lo: 0, hi: 1e6 })), defense: opt(num({ lo: 0, hi: 1e6 })), speed: opt(num({ lo: 0, hi: 1e6 })), xp: opt(num({ lo: 0, hi: 1e9 })), xpToNextLevel: opt(num({ lo: 0, hi: 1e9 })) })),
  combatProfile: opt(combat), taming: opt(taming), arcana: opt(arcana), research: opt(research),
};
const creatureShape = obj({ ...creatureFields, id: text(80, { min: 1 }), speciesId: text(80, { min: 1 }), firstEncountered: opt(text(80)), lastSeen: opt(text(80)), corruptionLevel: opt(num({ lo: 0, hi: 100 })), removedAt: opt(num({ lo: 0, hi: 1e15 })) });
export type Creature = Of<typeof creatureShape>;
/** What Generate makes for a creature: the species by name, never by id. */
export type CreatureMade = Omit<Creature, "id" | "speciesId" | "removedAt" | "firstEncountered" | "lastSeen" | "corruptionLevel"> & { speciesName: string };

export interface Codex { species: Species[]; creatures: Creature[]; subs: Record<string, boolean> }
export const DEFAULT_CODEX: Codex = { species: [], creatures: [], subs: {} };

const stateShape = obj({ species: arr(speciesShape, MAX_SPECIES * 2), creatures: arr(creatureShape, MAX_CREATURES * 2), subs: dflt(rec(bool(), 8), {}) });
export function parseCodex(data: unknown): Codex | null {
  const s = stateShape.check(data);
  if (!s || !hasUniqueIds(s.species) || !hasUniqueIds(s.creatures) || !subsKnown("codex", s.subs)) return null;
  return s.creatures.every((c) => s.species.some((sp) => sp.id === c.speciesId)) ? s : null;
}
export const readCodex = (data: unknown): Codex => (data === undefined ? DEFAULT_CODEX : parseCodex(data) ?? DEFAULT_CODEX);
export const liveSpecies = (c: Codex): Species[] => liveOf(c.species);
export const liveCreatures = (c: Codex): Creature[] => liveOf(c.creatures);
export const creaturesOf = (c: Codex, speciesId: string): Creature[] => liveCreatures(c).filter((x) => x.speciesId === speciesId);
export const speciesByName = (c: Codex, name: string): Species | undefined => liveSpecies(c).find((s) => sameName(s.name, name));

export type CodexAction =
  | { kind: "addSpecies"; species: SpeciesMade; id: string }
  | { kind: "refreshSpecies"; id: string; species: SpeciesMade }
  | { kind: "addCreature"; creature: CreatureMade; id: string }
  | { kind: "refreshCreature"; id: string; creature: CreatureMade }
  | { kind: "removeSpecies"; id: string; at: number }
  | { kind: "removeCreature"; id: string; at: number }
  | { kind: "restoreSpecies"; id: string }
  | { kind: "restoreCreature"; id: string };

const withoutName = ({ speciesName: _s, ...rest }: CreatureMade): Omit<CreatureMade, "speciesName"> => rest;

/** One panel action, as RoleCall's store does it (creature-codex.ts), returning the next state; the same state when nothing changes (a creature naming no species included). */
export function applyCodex(c: Codex, a: CodexAction): Codex {
  switch (a.kind) {
    case "addSpecies": {
      const species = appendItem(c.species, { ...a.species, id: a.id } as Species, MAX_SPECIES);
      return species ? { ...c, species } : c;
    }
    case "refreshSpecies": return { ...c, species: patchItem(c.species, a.id, (s) => ({ ...s, ...a.species })) };
    case "addCreature": {
      const sp = speciesByName(c, a.creature.speciesName);
      if (!sp) return c;
      const creatures = appendItem(c.creatures, { ...withoutName(a.creature), id: a.id, speciesId: sp.id } as Creature, MAX_CREATURES);
      return creatures ? { ...c, creatures } : c;
    }
    case "refreshCreature": return { ...c, creatures: patchItem(c.creatures, a.id, (x) => ({ ...x, ...withoutName(a.creature) })) };
    case "removeSpecies": {
      if (!find(c.species, a.id)) return c;
      const mark = <T extends { id: string; removedAt?: number }>(x: T, hit: boolean): T => (hit && x.removedAt === undefined ? { ...x, removedAt: a.at } : x);
      return { ...c, species: c.species.map((s) => mark(s, s.id === a.id)), creatures: c.creatures.map((x) => mark(x, x.speciesId === a.id)) };
    }
    case "removeCreature": return find(c.creatures, a.id) ? { ...c, creatures: c.creatures.map((x) => (x.id === a.id ? { ...x, removedAt: a.at } : x)) } : c;
    case "restoreSpecies": {
      const gone = c.species.find((s) => s.id === a.id && s.removedAt !== undefined);
      if (!gone) return c;
      const unmark = <T extends { removedAt?: number }>(x: T): T => { const { removedAt: _r, ...rest } = x; return rest as T; };
      return { ...c, species: c.species.map((s) => (s === gone ? unmark(s) : s)), creatures: c.creatures.map((x) => (x.speciesId === a.id && x.removedAt === gone.removedAt ? unmark(x) : x)) };
    }
    case "restoreCreature": {
      const x = c.creatures.find((y) => y.id === a.id && y.removedAt !== undefined);
      if (!x || !find(c.species, x.speciesId)) return c;
      const { removedAt: _r, ...rest } = x;
      return { ...c, creatures: c.creatures.map((y) => (y === x ? rest : y)) };
    }
  }
}

/** The narrator's Creature Codex block (immersion-context.ts:456-510): the species known and the creatures met, five species in detail with up to three of their creatures. */
export function codexLines(c: Codex): string[] {
  const species = liveSpecies(c);
  if (species.length === 0) return [];
  const creatures = liveCreatures(c);
  let out = `**Creature Codex**: ${species.length} species known | ${creatures.length} individuals encountered`;
  const details = species.slice(0, 5).map((sp) => {
    const here = creatures.filter((x) => x.speciesId === sp.id);
    let d = `- ${sp.name} (${sp.rarity}, ${sp.classification}, ${sp.disposition})`;
    if (sp.habitat) d += ` \u2014 habitat: ${sp.habitat}`;
    if (sp.combatProfile) {
      d += `\n    Combat: threat ${sp.combatProfile.threatLevel}/10`;
      if (sp.combatProfile.abilities.length) d += `, abilities: ${sp.combatProfile.abilities.join(", ")}`;
      if (sp.combatProfile.weaknesses.length) d += `, weak to: ${sp.combatProfile.weaknesses.join(", ")}`;
    }
    if (sp.ecology) {
      d += `\n    Ecology: ${sp.ecology.ecosystemRole}`;
      if (sp.ecology.populationStatus) d += ` (${sp.ecology.populationStatus})`;
    }
    if (sp.taming) {
      d += `\n    Taming: ${sp.taming.tameable ? `tameable via ${sp.taming.method || "unknown method"}` : "not tameable"}`;
      if (sp.taming.mountable) d += ", mountable";
    }
    if (sp.arcana) {
      d += `\n    Arcana: ${sp.arcana.magicAffinity || "unknown affinity"}`;
      if (sp.arcana.reagentsYielded?.length) d += `, yields: ${sp.arcana.reagentsYielded.join(", ")}`;
    }
    if (sp.research) {
      d += `\n    Research: ${sp.research.knowledgeLevel}`;
      if (sp.research.fieldNotes.length) d += ` (${sp.research.fieldNotes.length} notes)`;
    }
    if (here.length > 0) {
      const seen = here.slice(0, 3).map((x) => {
        let info = `${x.nickname || "unnamed"} (${x.status}`;
        if (x.bond !== undefined) info += `, bond: ${x.bond}`;
        if (x.trust !== undefined) info += `, trust: ${x.trust}`;
        if (x.condition) info += `, ${x.condition}`;
        if (x.mood) info += `, ${x.mood}`;
        return `${info})`;
      }).join("; ");
      d += `\n    Encounters: ${here.length} \u2014 ${seen}`;
    }
    return d;
  });
  if (details.length > 0) out += `\n${details.join("\n")}`;
  return [out];
}

const DESCRIBE_SPECIES = (subs: Readonly<Record<string, boolean>>): string => `Creature SPECIES entry \u2014 the GENERAL template for this kind of creature. Focus on what ALL members of this species share, not individual traits. Create a creature that feels ALIVE \u2014 not a generic "Forest Wolf" or "Cave Spider." Rules:
- NAME: Evocative compound names ("Gloomwing Moth", "Ironhide Basilisk", "Whisper Lynx", "Duskpetal Serpent"). Never generic.
- DESCRIPTION: Vivid sensory picture \u2014 bioluminescent markings? Crystalline growths? A haunting call? 2-3 sentences minimum.
- APPEARANCE: Specific features \u2014 feathered antlers, obsidian scales, iridescent wing membranes.
- TRAITS: Behavioral quirks \u2014 mimics voices? Collects shiny objects? Dances before attacking?
- ABILITIES: 2-5 detailed abilities with names, types, descriptions, effects, and usage notes.
- PASSIVES: 1-3 innate passive effects.
- NEEDS: 3-5 Sims-like needs appropriate to the species (hunger, territory, social, etc.).
- TAXONOMY: Every species MUST have a taxonomy with order (broadest, e.g. 'Mana Remnant', 'Beastfolk', 'Fae'), family (e.g. 'Slime', 'Wolf', 'Pixie'), and kind (specific variant \u2014 use kindRevealed:false with a kindHint if the player hasn't identified it yet).
${subs["combat"] ? " REQUIRED: Include a full combatProfile with threat level, abilities, weaknesses, resistances, loot drops, and tactical danger notes." : ""}${subs["ecology"] ? " REQUIRED: Include ecology data with ecosystem role, migration patterns, symbiotic relations, and population status." : ""}${subs["taming"] ? " REQUIRED: Include taming data \u2014 is it tameable, what method works, requirements, base loyalty, mountability, and special tamed ability." : ""}${subs["arcana"] ? " REQUIRED: Include arcana data \u2014 magic affinity, reagents yielded, ritual uses, ley line influence, and whether a cursed variant exists." : ""}${subs["research"] ? " REQUIRED: Include research data \u2014 knowledge level, 2-4 field notes, specimens collected, dissection notes, and pending hypotheses." : ""}`;

const abilityShape = (subs: Readonly<Record<string, boolean>>, count: string): string => `[{ "name": string, "type": "attack"|"spell"|"passive"|"buff"|"debuff"|"heal"|"utility"|"ultimate", "description": string (vivid, 1-2 sentences), "effects": [string] (what it does), "usageNotes": string (how to use it in roleplay/combat)${subs["creatureStats"] ? ', "damage": string (e.g. "2d6 poison"), "cost": string (e.g. "20 MP"), "cooldown": string (e.g. "3 turns"), "range": string, "duration": string, "element": string' : ""} }] ${count}`;

/** RoleCall's schema text for a `creatureCodex` species (generate-tracker-item/route.ts, moduleSchemas.creatureCodex). */
export const SPECIES_GEN: GenSpec<SpeciesMade> = {
  description: DESCRIBE_SPECIES,
  maxTokens: 3500,
  schema: (subs) => `{
  "name": string (unique species name),
  "classification": string ("Beast", "Fae", "Elemental", "Undead", "Construct", "Dragon", "Aberration", etc.),
  "taxonomy": { "order": string (broadest category like "Mana Remnant", "Beast", "Fae"), "family": string (mid-level like "Slime", "Canine", "Drake"), "kind": string or null (specific variant like "Frost Slime" \u2014 null/omit if player doesn't know yet), "kindRevealed": boolean (false if player hasn't identified the specific kind yet), "kindHint": string (evocative hint shown when kind unknown, like "shimmers with icy essence") },
  "rarity": "common" | "uncommon" | "rare" | "legendary" | "mythical" | "unique",
  "disposition": "docile" | "cautious" | "neutral" | "aggressive" | "territorial" | "predatory",
  "habitat": string (where found),
  "description": string (2-3 vivid sentences),
  "appearance": string (visual description),
  "baseTraits": [string] (3-6 defining traits like "nocturnal", "bioluminescent", "pack hunter"),
  "baseBehaviors": [string] (2-4 behaviors),
  "diet": string (optional),
  "lifespan": string (optional),
  "abilities": ${abilityShape(subs, "(2-5 abilities)")},
  "passives": [{ "name": string, "description": string, "effect": string (mechanical/gameplay effect) }] (1-3 passives),
  "baseNeeds": { key: { "value": number (0-100), "maxValue": 100, "label": string } } (3-5 species-appropriate needs like hunger, territory, social, energy)${subs["creatureStats"] ? `,
  "baseStats": { "hp": number, "maxHp": number, "mp": number (optional), "maxMp": number (optional), "attack": number, "defense": number, "speed": number, "level": number (optional), "xp": number (0-100+, current experience), "xpToNextLevel": number (XP needed for next level) }` : ""}${subs["combat"] ? `,
  "combatProfile": { "threatLevel": number (1-10), "abilities": [string] (3-5 unique combat abilities), "weaknesses": [string] (2-3 exploitable weaknesses), "resistances": [string] (optional), "lootDrops": [string] (items dropped on defeat, optional), "dangerNotes": string (tactical advice) }` : ""}${subs["ecology"] ? `,
  "ecology": { "ecosystemRole": string (niche it fills), "migrationPattern": string (optional), "symbioticRelations": [string] (optional), "populationStatus": "thriving"|"stable"|"declining"|"endangered"|"near-extinct" (optional), "seasonalBehavior": string (optional) }` : ""}${subs["taming"] ? `,
  "taming": { "tameable": boolean, "method": string (how to tame), "requirements": [string] (optional), "loyaltyBase": number (0-100, optional), "mountable": boolean (optional), "specialAbilityWhenTamed": string (optional) }` : ""}${subs["arcana"] ? `,
  "arcana": { "magicAffinity": string, "reagentsYielded": [string] (optional), "ritualUses": [string] (optional), "leyLineInfluence": string (optional), "cursedVariant": boolean (optional) }` : ""}${subs["research"] ? `,
  "research": { "knowledgeLevel": "unknown"|"rumored"|"observed"|"studied"|"mastered", "fieldNotes": [string] (2-4 scholarly observations), "specimensCollected": number (optional), "dissectionNotes": string (optional), "pendingHypotheses": [string] (optional) }` : ""}
}`,
  item: obj(speciesFields) as GenSpec<SpeciesMade>["item"],
};

/** RoleCall's schema text for a `creatureCodex-creature` entry (moduleSchemas["creatureCodex-creature"]). */
export const CREATURE_GEN: GenSpec<CreatureMade> = {
  description: (subs) => `Individual creature instance \u2014 a SPECIFIC living being with its own personality, scars, abilities, habits, and story. This is NOT a species template; this is ONE creature. Rules:
- APPEARANCE: Describe THIS creature's unique look \u2014 scars, unusual markings, mutations, size anomalies, coloring differences from species norm.
- TRAITS: 3-5 personality quirks specific to this individual \u2014 "hoarder of shiny objects", "unusually skittish around fire", "bonds quickly with children".
- BEHAVIORS: 2-4 individual habits \u2014 "patrols the eastern ridge at dawn", "sleeps upside-down in caves", "follows the player from a distance".
- ABILITIES: 2-4 abilities this SPECIFIC creature has developed \u2014 may share some with its species, but include any unique or modified ones.
- PASSIVES: 1-2 passive traits specific to this individual.
- TEMPERAMENT: Not just "aggressive" or "docile" \u2014 describe personality richly: "fiercely protective of its territory but curious about humanoids, often watching from a safe distance before approaching."
- CONDITION: Vivid, not generic \u2014 "well-fed with a glossy coat and a fresh scar across the left haunch" not just "healthy".${subs["combat"] ? "\n- COMBAT: Include this creature's specific combat profile \u2014 its personal threat level, fighting style, weaknesses, and resistances." : ""}${subs["taming"] ? "\n- TAMING: How to approach THIS specific creature for taming \u2014 what works for it specifically." : ""}${subs["arcana"] ? "\n- ARCANA: This creature's specific magical properties \u2014 may differ from species baseline." : ""}${subs["research"] ? "\n- RESEARCH: Observations about THIS specific creature \u2014 field notes, hypotheses about its unique traits." : ""}`,
  maxTokens: 3500,
  schema: (subs) => `{
  "speciesName": string (must match an existing species),
  "nickname": string (optional, player-given name),
  "location": string (where encountered),
  "condition": string (vivid description, not just "healthy"),
  "mood": string ("content", "agitated", "fearful", "playful", "curious"),
  "status": "alive" | "tamed" | "captured" | "fled" | "unknown",
  "bond": number (0-100, optional),
  "trust": number (0-100, optional),
  "temperament": string (rich personality description, 1-2 sentences),
  "appearance": string (THIS creature's unique physical features \u2014 scars, markings, mutations, size, coloring),
  "traits": [string] (3-5 individual personality quirks),
  "behaviors": [string] (2-4 individual habits),
  "abilities": ${abilityShape(subs, "(2-4 abilities)").replace("(vivid, 1-2 sentences), \"effects\": [string] (what it does), \"usageNotes\": string (how to use it in roleplay/combat)", "(vivid, 1-2 sentences), \"effects\": [string], \"usageNotes\": string")},
  "passives": [{ "name": string, "description": string, "effect": string }] (1-2 passives),
  "encounters": [{ "date": string, "description": string, "outcome": "peaceful"|"fled"|"fought"|"captured"|"tamed"|"observed"|"other", "notes": string (optional) }],
  "notes": string (optional),
  "needs": { key: { "value": number (0-100), "maxValue": 100, "label": string } } (current needs for this individual)${subs["creatureStats"] ? `,
  "currentStats": { "hp": number, "maxHp": number, "mp": number (optional), "maxMp": number (optional), "attack": number (optional), "defense": number (optional), "speed": number (optional), "xp": number, "xpToNextLevel": number }` : ""}${subs["combat"] ? `,
  "combatProfile": { "threatLevel": number (1-10), "abilities": [string] (combat abilities), "weaknesses": [string], "resistances": [string] (optional), "lootDrops": [string] (optional), "dangerNotes": string }` : ""}${subs["taming"] ? `,
  "taming": { "tameable": boolean, "method": string, "requirements": [string] (optional), "loyaltyBase": number (0-100, optional), "mountable": boolean (optional), "specialAbilityWhenTamed": string (optional) }` : ""}${subs["arcana"] ? `,
  "arcana": { "magicAffinity": string, "reagentsYielded": [string] (optional), "ritualUses": [string] (optional), "leyLineInfluence": string (optional), "cursedVariant": boolean (optional) }` : ""}${subs["research"] ? `,
  "research": { "knowledgeLevel": "unknown"|"rumored"|"observed"|"studied"|"mastered", "fieldNotes": [string] (2-4 observations about this individual), "specimensCollected": number (optional), "dissectionNotes": string (optional), "pendingHypotheses": [string] (optional) }` : ""}
}`,
  item: obj({ speciesName: text(120, { min: 1 }), ...creatureFields }) as GenSpec<CreatureMade>["item"],
};

const BESTIARY = `Update the bestiary of creatures from this story. List only creatures mentioned, encountered, or described in the conversation.
NAMING: Use evocative compound names that feel like real bestiary entries ("Gloomwing Moth", "Thornback Lurker", "Crystalhorn Stag", "Ashwalker Hound"). NEVER use generic names like "Forest Wolf" or "Giant Spider."
DESCRIPTIONS: Each species needs 2-3 vivid sentences \u2014 bioluminescent patterns? Crystalline growths? A haunting call?
TAXONOMY: Every species MUST have a taxonomy with order (broadest category like "Mana Remnant", "Beast", "Fae"), family (mid-level like "Slime", "Wolf", "Pixie"), and kind (specific variant \u2014 null/omit if the player hasn't identified it yet, with a kindHint like "shimmers with icy essence").
TRAITS: 4-6 memorable traits mixing physical and behavioral ("nocturnal", "bioluminescent glands", "mimics birdsong to lure prey", "hoards gemstones").
ABILITIES: Each species MUST have 2-5 detailed abilities with names, types ("attack"|"spell"|"passive"|"buff"|"debuff"|"heal"|"utility"|"ultimate"), vivid descriptions, effects arrays, and usageNotes explaining how they work in practice.
PASSIVES: Each species MUST have 1-3 passive effects (name, description, mechanical effect).
NEEDS: Each species MUST have "baseNeeds" \u2014 3-5 Sims-like needs appropriate to the creature type (e.g., a predator: hunger, territory, aggression, rest; a fae creature: essence, whimsy, moonlight, social).
For creature instances, only generate individuals the protagonist has actually met.`;

/** Refresh from chat history (RoleCall initialize-trackers moduleInstructions.creatureCodex, without its line that invents species when none have appeared). */
export const CODEX_REFRESH: RefreshSpec = {
  maxTokens: 8000,
  instruction: (subs) => `${BESTIARY}
Format: { "species": [${SPECIES_GEN.schema(subs)}], "creatures": [${CREATURE_GEN.schema(subs)}] }`,
  rows: (d) => {
    const c = readCodex(d);
    const named = (x: Creature): CreatureMade => ({ ...x, speciesName: c.species.find((s) => s.id === x.speciesId)?.name ?? "" });
    return [
      ...liveSpecies(c).map((s) => entry("species", s.name, SPECIES_GEN.item.coerce(s) ?? s)),
      ...liveCreatures(c).map((x) => ({ ...entry("creatures", x.nickname || named(x).speciesName, CREATURE_GEN.item.coerce(named(x)) ?? x), key: creatureKey(named(x)) })),
    ];
  },
  next(d, a, env) {
    const species = listOf(a, "species", SPECIES_GEN.item, env), creatures = listOf(a, "creatures", CREATURE_GEN.item, env);
    if (!species || !creatures) return null;
    const c = readCodex(d);
    const withSpecies = sync(c, liveSpecies(c), species, byName, {
      refresh: (s, old, sp) => applyCodex(s, { kind: "refreshSpecies", id: old.id, species: sp }),
      add: (s, sp) => applyCodex(s, { kind: "addSpecies", species: sp, id: env.id() }),
      remove: (s, old) => env.skipped.length > 0 ? s : applyCodex(s, { kind: "removeSpecies", id: old.id, at: env.now }),
    });
    const met = creatures.filter((m) => speciesByName(withSpecies, m.speciesName) || (env.skipped.push({ name: m.nickname || m.speciesName, reason: `its species, ${m.speciesName}, is not in the answer` }), false));
    const named = (x: Creature | CreatureMade): CreatureMade => ("speciesName" in x ? x : { ...x, speciesName: withSpecies.species.find((s) => s.id === x.speciesId)?.name ?? "" });
    return sync(withSpecies, liveCreatures(withSpecies), met, (x) => creatureKey(named(x)), {
      refresh: (s, old, creature) => applyCodex(s, { kind: "refreshCreature", id: old.id, creature }),
      add: (s, creature) => applyCodex(s, { kind: "addCreature", creature, id: env.id() }),
      remove: (s, old) => env.skipped.length > 0 ? s : applyCodex(s, { kind: "removeCreature", id: old.id, at: env.now }),
    });
  },
};

/** A creature is known by its species and its nickname. */
const creatureKey = (x: CreatureMade): string => `${norm(x.speciesName)}|${norm(x.nickname ?? "")}`;
