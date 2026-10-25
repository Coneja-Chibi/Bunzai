/**
 * The tracker modules by id: what each one keeps (checked once when it is written, ChatStore rule 43) and the lines it adds to the prompt.
 * One entry per module; the Prop for a module (ui/apps/scenes/props/trackers) and the assembler (core/assembly/trackers.ts) both go through
 * this table, so a module cannot be stored in one shape and read in another.
 */
import { TRACKER_MODULES, TRACKER_PROP_PREFIX, type TrackerContext, type TrackerModule } from "../../stage/contracts/chat-tracker-types";
import { normalizeProfile, DOSSIER_TYPES } from "../compendium/dossiers/base";
import { isPlainObject } from "../guards";
import { BATTLE_REFRESH, battleLines, parseBattle, readBattle } from "./battle";
import type { GenSpec } from "./generate";
import { INVENTORY_GEN, INVENTORY_REFRESH, inventoryLines, parseInventory, readInventory } from "./inventory";
import { BONDS_GEN, BONDS_REFRESH, bondsLines, parseBonds, readBonds } from "./bonds";
import { CORRUPTION_GEN, CORRUPTION_REFRESH, corruptionLines, parseCorruption, readCorruption } from "./corruption";
import { EVENTS_GEN, EVENTS_REFRESH, eventsLines, parseEvents, readEvents } from "./events";
import { MEMORIES_GEN, MEMORIES_REFRESH, memoriesLines, parseMemories, readMemories } from "./memories";
import { CYCLES_GEN, CYCLES_REFRESH, cyclesLines, parseCycles, readCycles } from "./cycles";
import { CODEX_REFRESH, CREATURE_GEN, SPECIES_GEN, codexLines, parseCodex, readCodex } from "./codex";
import { PARTY_GEN, PARTY_REFRESH, parseParty, partyLines, readParty } from "./party";
import { KNOWLEDGE_GEN, KNOWLEDGE_REFRESH, knowledgeLines, parseKnowledge, readKnowledge } from "./knowledge";
import { SPELLBOOK_GEN, SPELLBOOK_REFRESH, afterReply, parseSpellbook, pendingInjection, readSpellbook, spellbookLines } from "./spellbook";
import { SUBFEATURES } from "./subfeatures";
import { RESOURCES_REFRESH, parseResources, readResources, resourcesLines } from "./resources";
import type { RefreshSpec } from "./refresh";

interface ModuleDef {
  /** The state to keep, normalised, or null when the data is not a state of this module. */
  parse(data: unknown): unknown | null;
  /** The prompt lines for the stored state, or undefined data when nothing has changed yet (the module reads as its defaults). Empty: add nothing. */
  lines(data: unknown): string[];
  /** What Generate and Refresh make, by kind of item (generate.ts); the default kind is "item". */
  gen?: Readonly<Record<string, GenSpec>>;
  /** What Refresh from chat history asks for and does with the answer (refresh.ts). */
  refresh?: RefreshSpec;
  /** For a module with sub-features: its state with `subs` set, and the `subs` of a stored state. */
  setSubs?(data: unknown, subs: Record<string, boolean>): unknown;
  /** A note the module holds for the next reply (the Spellbook's cast): sent once, as its own message after the tracker block. */
  injection?(data: unknown): string | undefined;
  /** What a committed reply does to the module's state (`carried`: it carried the note above); the same object when nothing changes. */
  afterReply?(data: unknown, carried: boolean): unknown;
  subsOf?(data: unknown): Record<string, boolean>;
}

/** A Storyboard's whole state is its AI Context profile: a mode and a radius, nothing else (the book's entries are the data; they live in the book). */
function parseProfile(data: unknown): unknown | null {
  if (!isPlainObject(data) || Object.keys(data).some((k) => k !== "mode" && k !== "radius")) return null;
  if (data["mode"] !== undefined && !["focused", "compact", "radius", "full"].includes(data["mode"] as string)) return null;
  if (data["radius"] !== undefined && !(typeof data["radius"] === "number" && Number.isInteger(data["radius"]) && data["radius"] >= 1 && data["radius"] <= 30)) return null;
  return { ...data };
}
const storyboard: ModuleDef = { parse: parseProfile, lines: () => [] };

const MODULES: Readonly<Record<TrackerModule, ModuleDef>> = {
  resources: { refresh: RESOURCES_REFRESH, parse: parseResources, lines: (d) => resourcesLines(readResources(d)) },
  battle: { refresh: BATTLE_REFRESH, parse: parseBattle, lines: (d) => battleLines(readBattle(d)) },
  knowledge: { refresh: KNOWLEDGE_REFRESH, parse: parseKnowledge, lines: (d) => knowledgeLines(readKnowledge(d)), gen: { item: KNOWLEDGE_GEN as GenSpec }, setSubs: (d, subs) => ({ ...readKnowledge(d), subs }), subsOf: (d) => readKnowledge(d).subs },
  codex: { refresh: CODEX_REFRESH, parse: parseCodex, lines: (d) => codexLines(readCodex(d)), gen: { item: SPECIES_GEN as GenSpec, creature: CREATURE_GEN as GenSpec }, setSubs: (d, subs) => ({ ...readCodex(d), subs }), subsOf: (d) => readCodex(d).subs },
  cycles: { refresh: CYCLES_REFRESH, parse: parseCycles, lines: (d) => cyclesLines(readCycles(d)), gen: { item: CYCLES_GEN as GenSpec }, setSubs: (d, subs) => ({ ...readCycles(d), subs }), subsOf: (d) => readCycles(d).subs },
  memories: { refresh: MEMORIES_REFRESH, parse: parseMemories, lines: (d) => memoriesLines(readMemories(d)), gen: { item: MEMORIES_GEN as GenSpec } },
  spellbook: { refresh: SPELLBOOK_REFRESH, parse: parseSpellbook, lines: (d) => spellbookLines(readSpellbook(d)), gen: { item: SPELLBOOK_GEN as GenSpec }, setSubs: (d, subs) => ({ ...readSpellbook(d), subs }), subsOf: (d) => readSpellbook(d).subs, injection: pendingInjection, afterReply: (d, carried) => { const b = readSpellbook(d); const next = afterReply(b, carried); return next === b ? d : next; } },
  events: { refresh: EVENTS_REFRESH, parse: parseEvents, lines: (d) => eventsLines(readEvents(d)), gen: { item: EVENTS_GEN as GenSpec } },
  bonds: { refresh: BONDS_REFRESH, parse: parseBonds, lines: (d) => bondsLines(readBonds(d)), gen: { item: BONDS_GEN as GenSpec } },
  corruption: { refresh: CORRUPTION_REFRESH, parse: parseCorruption, lines: (d) => corruptionLines(readCorruption(d)), gen: { item: CORRUPTION_GEN as GenSpec } },
  party: { refresh: PARTY_REFRESH, parse: parseParty, lines: (d) => partyLines(readParty(d)), gen: { item: PARTY_GEN as GenSpec } },
  inventory: { refresh: INVENTORY_REFRESH, parse: parseInventory, lines: (d) => inventoryLines(readInventory(d)), gen: { item: INVENTORY_GEN as GenSpec } },
  quests: storyboard, cast: storyboard, map: storyboard, renown: storyboard,
};

/** The Storyboards, which add to the prompt through core/assembly/storyboards.ts rather than as tracker lines. */
export const isStoryboard = (module: TrackerModule): boolean => (DOSSIER_TYPES as readonly string[]).includes(module);
/** RoleCall's include defaults (context-profile.ts:normalizeDossierContextConfig): Quest Board and Cast are sent, Map and Renown are not until chosen. */
export const storyboardIncludedByDefault = (module: TrackerModule): boolean => module === "quests" || module === "cast";
export const storyboardProfile = (data: unknown) => normalizeProfile(data);

export const isTrackerModule = (id: string): id is TrackerModule => (TRACKER_MODULES as readonly string[]).includes(id);

export const parseTrackerData = (module: TrackerModule, data: unknown): unknown | null => MODULES[module].parse(data);
export const trackerLines = (module: TrackerModule, data: unknown): string[] => MODULES[module].lines(data);

/**
 * The order the modules' lines go in the prompt (immersion-context.ts:70-480): Stats, Combat, Map, Party, Cast, Calendar, Quests, Inventory,
 * Corruption, Bonds, Knowledge, Events, Spellbook, Renown, Creature Codex, Memories, Cycles. Modules not built yet are simply absent.
 */
export const PROMPT_ORDER: readonly TrackerModule[] = ["resources", "battle", "party", "inventory", "corruption", "bonds", "knowledge", "events", "spellbook", "codex", "memories", "cycles"];

/** The spec for one kind of item a module can generate, or undefined when it generates none (Stats, Combat and the Storyboards do not). */
export const genSpecOf = (module: TrackerModule, kind = "item"): GenSpec | undefined => MODULES[module].gen?.[kind];
/** What Refresh from chat history does for a module, or undefined when it has none (the Storyboards: their entries live in the Compendium). */
export const refreshSpecOf = (module: TrackerModule): RefreshSpec | undefined => MODULES[module].refresh;
/** The sub-feature switches a module keeps (Knowledge's Secrets), by id; none for a module without. */
export const subsOf = (module: TrackerModule, data: unknown): Record<string, boolean> => MODULES[module].subsOf?.(data) ?? {};
/** The module's state with its sub-features set; the sub-features are only ever those of SUBFEATURES. */
export const withSubs = (module: TrackerModule, data: unknown, subs: Record<string, boolean>): unknown =>
  SUBFEATURES[module] && MODULES[module].setSubs ? MODULES[module].setSubs!(data, subs) : data;
/** The notes the modules hold for this turn, in the modules' order: only for a Prop that is on, and a note a module's AI Context turns away is not sent. */
export function injectionsOf(entries: Readonly<Partial<Record<TrackerModule, { context?: TrackerContext; data?: unknown }>>>, on: readonly string[], turn: number): { module: TrackerModule; text: string }[] {
  return PROMPT_ORDER.flatMap((module) => {
    const entry = entries[module];
    const text = on.includes(`${TRACKER_PROP_PREFIX}${module}`) && contextDue(entry?.context, turn) ? MODULES[module].injection?.(entry?.data) : undefined;
    return text ? [{ module, text }] : [];
  });
}

/** The data a module should hold after a committed reply, or undefined when it holds what it should. `carried` is whether this reply carried the module's note. */
export function dataAfterReply(module: TrackerModule, data: unknown, carried: boolean): unknown | undefined {
  const next = MODULES[module].afterReply?.(data, carried);
  return next === undefined || next === data ? undefined : next;
}
export const hasAfterReply = (module: TrackerModule): boolean => MODULES[module].afterReply !== undefined;
export const canGenerate = (module: TrackerModule): boolean => MODULES[module].gen !== undefined;

/**
 * Whether a module's AI Context lets it ride this turn (immersion-context.ts:46-62): always, every second turn (even turn numbers), every
 * fifth (multiples of five), never. `turn` is the number of user messages including the one being answered; no turn number means included.
 */
export function contextDue(context: TrackerContext | undefined, turn: number): boolean {
  switch (context ?? "always") {
    case "never": return false;
    case "every2": return !turn || turn % 2 === 0;
    case "every5": return !turn || turn % 5 === 0;
    default: return true;
  }
}
