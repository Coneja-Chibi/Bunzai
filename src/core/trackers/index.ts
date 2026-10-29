/**
 * The tracker modules by id: what each one keeps (checked once when it is written; its state is the scene-state slot `tracker.<module>`, state.ts) and the lines it adds to the prompt.
 * One entry per module; the Prop for a module (ui/apps/scenes/props/trackers) and the assembler (core/assembly/trackers.ts) both go through
 * this table, so a module cannot be stored in one shape and read in another.
 */
import { TRACKER_MODULES, TRACKER_PROP_PREFIX, type ChatTrackers, type TrackerContext, type TrackerModule } from "../../stage/contracts/chat-tracker-types";
import type { Delta, SceneState, SlotDef } from "../scene-state/types";
import { normalizeProfile, DOSSIER_TYPES } from "../compendium/dossiers/base";
import { isPlainObject } from "../guards";
import { BATTLE_REFRESH, BATTLE_STATE, battleLines, repairBattle, parseBattle, readBattle } from "./battle";
import type { GenSpec } from "./generate";
import { INVENTORY_GEN, INVENTORY_REFRESH, inventoryLines, parseInventory, readInventory, INVENTORY_STATE, repairInventory } from "./inventory";
import { BONDS_GEN, BONDS_REFRESH, bondsLines, parseBonds, readBonds, BONDS_STATE, repairBonds } from "./bonds";
import { CORRUPTION_GEN, CORRUPTION_REFRESH, corruptionLines, parseCorruption, readCorruption, CORRUPTION_STATE, repairCorruption } from "./corruption";
import { EVENTS_GEN, EVENTS_REFRESH, eventsLines, parseEvents, readEvents, EVENTS_STATE, repairEvents } from "./events";
import { MEMORIES_GEN, MEMORIES_REFRESH, memoriesLines, parseMemories, readMemories, MEMORIES_STATE, repairMemories } from "./memories";
import { CYCLES_GEN, CYCLES_REFRESH, cyclesLines, parseCycles, readCycles, CYCLES_STATE, repairCycles } from "./cycles";
import { CODEX_REFRESH, CREATURE_GEN, SPECIES_GEN, codexLines, parseCodex, readCodex, CODEX_STATE, repairCodex } from "./codex";
import { PARTY_GEN, PARTY_REFRESH, parseParty, partyLines, readParty, PARTY_STATE, repairParty } from "./party";
import { KNOWLEDGE_GEN, KNOWLEDGE_REFRESH, knowledgeLines, parseKnowledge, readKnowledge, KNOWLEDGE_STATE, repairKnowledge } from "./knowledge";
import { SPELLBOOK_GEN, SPELLBOOK_REFRESH, afterReply, parseSpellbook, pendingInjection, readSpellbook, spellbookLines, SPELLBOOK_STATE, repairSpellbook } from "./spellbook";
import { RESOURCES_REFRESH, RESOURCES_STATE, parseResources, repairResources, readResources, resourcesLines } from "./resources";
import { composeData, heldInBase, slotOfSpec, stateDeltas, stateSpec, type StateSpec } from "./state";
import type { RefreshSpec } from "./refresh";

interface ModuleDef {
  /** The state to keep, normalised, or null when the data is not a state of this module. */
  parse(data: unknown): unknown | null;
  /** The module's data as it reads: what is given, else the defaults (data undefined). */
  read(data: unknown): unknown;
  /** What of the data is scene state (one slot, `tracker.<module>`) and its strategy; absent for the Storyboards, whose only data is a setting. The rest of the data, the sub-features, is a setting of the scene. */
  state?: StateSpec;
  /** The module's one repair step: the state it can keep of a state that does not pass its whole-state rule, or null when none (state.ts repairOf). */
  repair?(data: unknown): unknown | null;
  /** The prompt lines for the stored state, or undefined data when nothing has changed yet (the module reads as its defaults). Empty: add nothing. */
  lines(data: unknown): string[];
  /** What Generate and Refresh make, by kind of item (generate.ts); the default kind is "item". */
  gen?: Readonly<Record<string, GenSpec>>;
  /** What Refresh from chat history asks for and does with the answer (refresh.ts). */
  refresh?: RefreshSpec;
  /** A note the module holds for the next reply (the Spellbook's cast): sent once, as its own message after the tracker block. */
  injection?(data: unknown): string | undefined;
  /** What a committed reply does to the module's state (`carried`: it carried the note above); the same object when nothing changes. */
  afterReply?(data: unknown, carried: boolean): unknown;
}

/** A Storyboard's whole state is its AI Context profile: a mode and a radius, nothing else (the book's entries are the data; they live in the book). */
function parseProfile(data: unknown): unknown | null {
  if (!isPlainObject(data) || Object.keys(data).some((k) => k !== "mode" && k !== "radius")) return null;
  if (data["mode"] !== undefined && !["focused", "compact", "radius", "full"].includes(data["mode"] as string)) return null;
  if (data["radius"] !== undefined && !(typeof data["radius"] === "number" && Number.isInteger(data["radius"]) && data["radius"] >= 1 && data["radius"] <= 30)) return null;
  return { ...data };
}
const storyboard: ModuleDef = { parse: parseProfile, read: (d) => d, lines: () => [] };

const MODULES: Readonly<Record<TrackerModule, ModuleDef>> = {
  resources: { refresh: RESOURCES_REFRESH, parse: parseResources, read: readResources, state: RESOURCES_STATE, repair: repairResources, lines: (d) => resourcesLines(readResources(d)) },
  battle: { refresh: BATTLE_REFRESH, parse: parseBattle, read: readBattle, state: BATTLE_STATE, repair: repairBattle, lines: (d) => battleLines(readBattle(d)) },
  knowledge: { refresh: KNOWLEDGE_REFRESH, parse: parseKnowledge, read: readKnowledge, state: KNOWLEDGE_STATE, repair: repairKnowledge, lines: (d) => knowledgeLines(readKnowledge(d)), gen: { item: KNOWLEDGE_GEN as GenSpec } },
  codex: { refresh: CODEX_REFRESH, parse: parseCodex, read: readCodex, state: CODEX_STATE, repair: repairCodex, lines: (d) => codexLines(readCodex(d)), gen: { item: SPECIES_GEN as GenSpec, creature: CREATURE_GEN as GenSpec } },
  cycles: { refresh: CYCLES_REFRESH, parse: parseCycles, read: readCycles, state: CYCLES_STATE, repair: repairCycles, lines: (d) => cyclesLines(readCycles(d)), gen: { item: CYCLES_GEN as GenSpec } },
  memories: { refresh: MEMORIES_REFRESH, parse: parseMemories, read: readMemories, state: MEMORIES_STATE, repair: repairMemories, lines: (d) => memoriesLines(readMemories(d)), gen: { item: MEMORIES_GEN as GenSpec } },
  spellbook: { refresh: SPELLBOOK_REFRESH, parse: parseSpellbook, read: readSpellbook, state: SPELLBOOK_STATE, repair: repairSpellbook, lines: (d) => spellbookLines(readSpellbook(d)), gen: { item: SPELLBOOK_GEN as GenSpec }, injection: pendingInjection, afterReply: (d, carried) => { const b = readSpellbook(d); const next = afterReply(b, carried); return next === b ? d : next; } },
  events: { refresh: EVENTS_REFRESH, parse: parseEvents, read: readEvents, state: EVENTS_STATE, repair: repairEvents, lines: (d) => eventsLines(readEvents(d)), gen: { item: EVENTS_GEN as GenSpec } },
  bonds: { refresh: BONDS_REFRESH, parse: parseBonds, read: readBonds, state: BONDS_STATE, repair: repairBonds, lines: (d) => bondsLines(readBonds(d)), gen: { item: BONDS_GEN as GenSpec } },
  corruption: { refresh: CORRUPTION_REFRESH, parse: parseCorruption, read: readCorruption, state: CORRUPTION_STATE, repair: repairCorruption, lines: (d) => corruptionLines(readCorruption(d)), gen: { item: CORRUPTION_GEN as GenSpec } },
  party: { refresh: PARTY_REFRESH, parse: parseParty, read: readParty, state: PARTY_STATE, repair: repairParty, lines: (d) => partyLines(readParty(d)), gen: { item: PARTY_GEN as GenSpec } },
  inventory: { refresh: INVENTORY_REFRESH, parse: parseInventory, read: readInventory, state: INVENTORY_STATE, repair: repairInventory, lines: (d) => inventoryLines(readInventory(d)), gen: { item: INVENTORY_GEN as GenSpec } },
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

/** The modules whose state lives in a slot, `tracker.<module>` (the Storyboards keep only a setting). The slot declarations are made from this list (scene-state/slots/tracker.ts). */
export const TRACKER_STATE_MODULES: readonly TrackerModule[] = TRACKER_MODULES.filter((m) => MODULES[m].state !== undefined);
export const hasTrackerState = (module: TrackerModule): boolean => MODULES[module].state !== undefined;
export const trackerSlotId = (module: TrackerModule): string => `tracker.${module}`;
/** The slot of a module that keeps state. */
export const trackerSlotDef = (module: TrackerModule): SlotDef => slotOfSpec(trackerSlotId(module), MODULES[module].state!);
const defaultsOf = (module: TrackerModule): Record<string, unknown> => MODULES[module].read(undefined) as Record<string, unknown>;

/**
 * A module's data in a scene state: its slot over the module's defaults, with the scene's sub-feature switches, REPAIRED by the module's one repair step (a cut or a swipe can leave fields that each fit
 * and together break a rule: HP past its maximum). Every reader and every writer starts from this, so a write's base and expectation describe what was read. Undefined while nothing was written (the module
 * reads as its defaults) and always for a module without state; the composed state as it is when nothing in it is salvageable (`trackerUnreadable` says so).
 */
export function trackerDataIn(module: TrackerModule, state: SceneState, subs?: Readonly<Record<string, boolean>>): unknown {
  const raw = trackerRawIn(module, state, subs);
  return raw === undefined ? undefined : MODULES[module].repair?.(raw) ?? raw;
}

/** A module's data in a scene state exactly as it is stored (over the defaults, with the switches), not repaired: what a write's guard must describe, since the store holds this and not the repaired read. */
export function trackerRawIn(module: TrackerModule, state: SceneState, subs?: Readonly<Record<string, boolean>>): unknown {
  const spec = MODULES[module].state;
  return spec ? composeData(spec, defaultsOf(module), state[trackerSlotId(module)], subs) : undefined;
}

/** Whether a module has a saved state of which nothing can be read: the panel then says so and shows the module's empty start, never defaults presented as the saved state. */
export function trackerUnreadable(module: TrackerModule, state: SceneState, subs?: Readonly<Record<string, boolean>>): boolean {
  const spec = MODULES[module].state;
  const raw = spec ? composeData(spec, defaultsOf(module), state[trackerSlotId(module)], subs) : undefined;
  return raw !== undefined && MODULES[module].repair?.(raw) === null;
}

/** What a write computed from `base` (a module's data as its writer read it) expects to find at the paths of its deltas: its guard against another writer's change to the same field or row. */
export function trackerHeldIn(module: TrackerModule, base: unknown, deltas: readonly Delta[]): Delta[] {
  const spec = MODULES[module].state;
  return spec ? heldInBase(trackerSlotDef(module), spec, defaultsOf(module), base, deltas) : [];
}

/** A module's data as it reads: what is given, else the defaults. Two data that read alike are the same state, whether or not the defaults were ever written. */
export const readTrackerData = (module: TrackerModule, data: unknown): unknown => MODULES[module].read(data);

/** The scene's tracker settings with each stateful module's data read from a scene state: the entries a prompt, a panel or a round reads. A module with state but no settings gets an entry holding its data. */
export function trackerOverlay(entries: ChatTrackers | undefined, state: SceneState): ChatTrackers {
  const out: ChatTrackers = { ...entries };
  for (const module of TRACKER_STATE_MODULES) {
    const data = trackerDataIn(module, state, entries?.[module]?.subs);
    if (data !== undefined) out[module] = { ...entries?.[module], data: data as never };
  }
  return out;
}

/** The deltas that turn a module's data `before` into `after` (undefined reads as the defaults): only what changed, by the slot's strategy. */
export function trackerDeltas(module: TrackerModule, before: unknown, after: unknown, at: number): Delta[] {
  const spec = MODULES[module].state;
  return spec ? stateDeltas(trackerSlotDef(module), spec, defaultsOf(module), before, after, at) : [];
}
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

/**
 * What a committed reply does to the Props that keep time (the Spellbook's cast is spent by the reply that carried it, its cooldowns count down on every other), as deltas.
 * `entries` are the tracker entries with the data the reply was built on (`trackerOverlay` of the state it loaded), so the tick is computed in the turn and stamped with the reply:
 * a regenerate loads the state before the reply it replaces and so ticks once, and a cut takes the tick with the reply.
 */
export function afterReplyDeltas(entries: ChatTrackers, on: readonly string[], carried: ReadonlySet<TrackerModule>, at: number): Delta[] {
  return TRACKER_MODULES.flatMap((module) => {
    const entry = entries[module];
    if (!entry || !hasAfterReply(module) || !on.includes(`${TRACKER_PROP_PREFIX}${module}`)) return [];
    const next = dataAfterReply(module, entry.data, carried.has(module));
    return next === undefined ? [] : trackerDeltas(module, entry.data, next, at);
  });
}
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
