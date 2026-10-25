/**
 * The Director's one command, `commit_planning_round` (RoleCall `dm-stream/tools/commit-planning-round.ts`): its definition for the provider, and the one place its arguments are read.
 * The directive must be whole and valid or the round is refused (a malformed directive is never repaired into a neutral one); the other sections are read leniently, a malformed entry
 * skipped, because RoleCall's models drift in small ways there and a lost entry costs one update, not the turn. Every text is bounded, because it can reach the narrator or the next prompt.
 */
import { isRecord, recOr } from "../guards";
import type {
  DirectorArc, DirectorHorizon, DirectorUrgency, NarratorDirective, PlanningAnalysis, PlanningArcUpdate, PlanningChapterUpdate, PlanningInvisibleArcUpdate, PlanningRound, PlanningSeedUpdate,
} from "../../stage/contracts/director-types";
import { analysisSchema, arcUpdateItemSchema, chapterUpdateSchema, directiveSchema, invisibleArcUpdateItemSchema, seedUpdateItemSchema } from "./plan-schema";

export const PLANNING_TOOL_NAME = "commit_planning_round";

const DESCRIPTION =
  "SINGLETON. Call this tool EXACTLY ONE time per response - never twice in the same assistant turn, never in parallel with itself. There is no 're-commit'; if you start typing it and want to revise, finish a single complete call with all your final values. Calling it a second time in the same response is a contract violation; the server will discard the duplicate. " +
  "The single planning call: emit your narrator directive AND update the chapter lifecycle, arcs, seeds, invisible arcs, and turn analysis in one batch. " +
  "AUTHOR THE DIRECTIVE RICHLY. The directive is the narrator's marching orders for this turn - and the narrator is blind to everything except what you write here. A thin directive (just mood + pacing + arcDirections) produces generic prose. A rich directive (include + avoid + dialogueGuidance + sceneGuidance + endingHook + characterBeats + narrativeGoal) produces prose that feels authored. Default to filling EVERY sub-field of `directive` that the scene supports - most engaged turns merit 8+ filled directive sub-fields. The optional fields are optional in the schema, not optional in practice. " +
  "Fill `analysis` similarly - whatHappened + pacingAnalysis + intentions + suggestedActions are how YOU read your own turn and plan the next. Skipping them blinds the next planning round. " +
  "Always make an explicit chapterUpdate decision. If no chapter exists, action MUST be start_new so Chapter 1 is created. Use update only for meaningful evolution, start_new only for a major transition, and none when the existing chapter remains accurate. " +
  "If a section truly has no changes this turn (arcUpdates, seedUpdates, invisibleArcUpdates), send an empty array. " +
  "Arc rule: stages are history; nextBeat is the specific future event/opportunity to push next. Active arcs should have a pending nextBeat; if delivered, mark it and set the next one. " +
  "Seed rule: plant concrete details with known future payoff; if seed pressure is present, plant at least one. " +
  "Shadow rule: keep hidden arcs secret until surfaced; when surface-ready, add a clue/rumor/consequence or surface the item.";

/** The command as a provider tool definition. */
export const PLANNING_TOOL = {
  type: "function" as const,
  function: {
    name: PLANNING_TOOL_NAME,
    description: DESCRIPTION,
    parameters: {
      type: "object",
      required: ["directive", "arcUpdates", "seedUpdates", "invisibleArcUpdates", "analysis", "chapterUpdate"],
      properties: {
        directive: { ...directiveSchema, description: "The narrator directive for this turn (mood, pacing, include/avoid, beats, callbacks, etc.). mood and pacing are required." },
        arcUpdates: { type: "array", description: "Updates for visible story arcs. Include one entry per arc that meaningfully changed this turn; send [] if none changed.", items: arcUpdateItemSchema },
        seedUpdates: { type: "array", description: "Updates for narrative seeds - every pending seed needs an entry (plant/reinforce/resolve/delete). Send [] only when there are zero pending seeds AND nothing new to plant.", items: seedUpdateItemSchema },
        invisibleArcUpdates: { type: "array", description: "Updates for invisible (shadow world) arcs. Send [] if no shadow arcs exist or changed this turn.", items: invisibleArcUpdateItemSchema },
        analysis: { ...analysisSchema, description: "Turn-level analysis: whatHappened, pacing read, intentions for upcoming turns, suggestedActions. All fields optional but provide as many as apply." },
        chapterUpdate: { ...chapterUpdateSchema, description: "The mandatory chapter-lifecycle decision for this turn. No current chapter means action=start_new. Existing chapters may use none, update, or start_new as warranted." },
      },
    },
  },
};

export type ReadRound = { ok: true; round: PlanningRound } | { ok: false; error: string };

const TEXT_MAX = 1_200;
const LIST_MAX = 12;
const text = (v: unknown, max = TEXT_MAX): string | undefined => (typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, max) : undefined);
const list = (v: unknown, max = LIST_MAX): string[] | undefined => {
  const out = Array.isArray(v) ? v.flatMap((x) => text(x) ?? []).slice(0, max) : [];
  return out.length > 0 ? out : undefined;
};
const oneOf = <T extends string>(v: unknown, options: readonly T[]): T | undefined => (typeof v === "string" && (options as readonly string[]).includes(v) ? (v as T) : undefined);
const records = (v: unknown, max = 40): Record<string, unknown>[] => (Array.isArray(v) ? v.filter(isRecord).slice(0, max) : []);
const horizon = (v: unknown): DirectorHorizon | undefined => oneOf(typeof v === "string" ? v.replace(/-term$/, "") : v, ["immediate", "short", "medium", "long", "epic"]);
const turn = (v: unknown): number | undefined => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
};
const define = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
const PACINGS = ["slow", "medium", "fast", "breakneck"] as const;

function readDirective(raw: unknown): NarratorDirective | string {
  if (!isRecord(raw)) return "the planning command had no directive";
  const mood = text(raw["mood"], 200);
  const pacing = oneOf(raw["pacing"], PACINGS);
  if (!mood || !pacing) return "the directive needs a mood and a pacing";
  const inc = recOr(raw["include"]);
  const av = recOr(raw["avoid"]);
  const scene = recOr(raw["sceneGuidance"]);
  const tension = typeof scene["tension_level"] === "number" && Number.isFinite(scene["tension_level"]) ? Math.max(0, Math.min(10, scene["tension_level"])) : undefined;
  const include = define({ characters: list(inc["characters"]), themes: list(inc["themes"]), sensoryDetails: list(inc["sensoryDetails"]), foreshadowing: list(inc["foreshadowing"]) });
  const avoid = define({ topics: list(av["topics"]), characters: list(av["characters"]), revelations: list(av["revelations"]) });
  const sceneGuidance = define({ setting: text(scene["setting"]), atmosphere: text(scene["atmosphere"]), tension_level: tension });
  const dialogueGuidance = records(raw["dialogueGuidance"], LIST_MAX).flatMap((d) => { const character = text(d["character"], 120); const tone = text(d["tone"]); return character && tone ? [define({ character, tone, hints: list(d["hints"]) })] : []; });
  const arcDirections = records(raw["arcDirections"], LIST_MAX).flatMap((a) => { const arcName = text(a["arcName"], 200); const instruction = text(a["instruction"]); return arcName && instruction ? [{ arcName, instruction, urgency: oneOf<DirectorUrgency>(a["urgency"], ["subtle", "moderate", "forceful"]) ?? "moderate" }] : []; });
  const callbacks = records(raw["callbacks"], LIST_MAX).flatMap((c) => { const reference = text(c["reference"]); const instruction = text(c["instruction"]); return reference && instruction ? [{ reference, instruction }] : []; });
  const characterBeats = records(raw["characterBeats"], LIST_MAX).flatMap((b) => { const character = text(b["character"], 120); const beat = text(b["beat"]); return character && beat ? [define({ character, beat, motivation: text(b["motivation"]) })] : []; });
  return define({
    mood, pacing,
    include: Object.keys(include).length > 0 ? include : undefined, avoid: Object.keys(avoid).length > 0 ? avoid : undefined,
    dialogueGuidance: dialogueGuidance.length > 0 ? dialogueGuidance : undefined, sceneGuidance: Object.keys(sceneGuidance).length > 0 ? sceneGuidance : undefined,
    endingHook: text(raw["endingHook"]), arcDirections: arcDirections.length > 0 ? arcDirections : undefined, callbacks: callbacks.length > 0 ? callbacks : undefined,
    characterBeats: characterBeats.length > 0 ? characterBeats : undefined, narrativeGoal: text(raw["narrativeGoal"]),
  });
}

const readArcs = (raw: unknown): PlanningArcUpdate[] => records(raw).flatMap((u) => {
  const arcId = text(u["arcId"] ?? u["id"] ?? u["title"], 200);
  if (!arcId) return [];
  const beat = isRecord(u["nextBeat"]) ? text(u["nextBeat"]["description"]) : undefined;
  return [define({
    arcId, title: text(u["title"], 80), description: text(u["description"]), status: oneOf<DirectorArc["status"]>(u["status"], ["seeding", "building", "climax", "resolution", "complete", "abandoned"]),
    horizon: horizon(u["horizon"]), priority: oneOf<DirectorArc["priority"]>(u["priority"], ["background", "active", "urgent"]), arcType: oneOf<DirectorArc["arcType"]>(u["arcType"], ["main", "side", "character", "world", "mystery"]),
    newStageTitle: text(u["newStageTitle"], 200), newStageDescription: text(u["newStageDescription"]), markNextBeatDelivered: u["markNextBeatDelivered"] === true ? true : undefined,
    nextBeat: beat ? define({ description: beat, targetTurn: turn((u["nextBeat"] as Record<string, unknown>)["targetTurn"]) }) : undefined,
  })];
});

const readSeeds = (raw: unknown): PlanningSeedUpdate[] => records(raw).flatMap((u) => {
  const title = text(u["title"], 200);
  if (!title) return [];
  return [define({
    id: text(u["id"], 80), title, action: oneOf<PlanningSeedUpdate["action"]>(typeof u["action"] === "string" ? u["action"].toLowerCase() : u["action"], ["plant", "reinforce", "resolve", "delete"]) ?? "reinforce",
    scope: oneOf<"world" | "player">(u["scope"], ["world", "player"]), relatedArcId: text(u["relatedArcId"], 200), description: text(u["description"]), payoffHorizon: horizon(u["payoffHorizon"]),
    reinforcement: text(u["reinforcement"]), outcome: text(u["outcome"]),
  })];
});

const readHidden = (raw: unknown): PlanningInvisibleArcUpdate[] => records(raw).flatMap((u) => {
  const title = text(u["title"], 200);
  const action = oneOf<PlanningInvisibleArcUpdate["action"]>(u["action"], ["add", "update", "surface", "resolve", "delete"]);
  if (!title || !action) return [];
  const beats = records(u["plannedBeats"], 20).flatMap((b) => { const description = text(b["description"]); return description ? [define({ description, completed: typeof b["completed"] === "boolean" ? b["completed"] : undefined, hidden: typeof b["hidden"] === "boolean" ? b["hidden"] : undefined })] : []; });
  return [define({
    title, action, arcId: text(u["arcId"], 80), description: text(u["description"]), status: oneOf<PlanningInvisibleArcUpdate["status"] & string>(u["status"], ["seeding", "building", "approaching_player", "visible", "resolved"]),
    arcType: oneOf<NonNullable<PlanningInvisibleArcUpdate["arcType"]>>(u["arcType"], ["faction", "npc_agenda", "world_event", "conspiracy", "background"]), horizon: horizon(u["horizon"]),
    scope: oneOf<"world" | "player">(u["scope"], ["world", "player"]), surfaceCondition: text(u["surfaceCondition"]), expectedSurfaceTurn: turn(u["expectedSurfaceTurn"]),
    plannedBeats: beats.length > 0 ? beats : undefined, foreshadowingSeeds: list(u["foreshadowingSeeds"]), relatedVisibleArcs: list(u["relatedVisibleArcs"]), newClue: text(u["newClue"]),
    newStageTitle: text(u["newStageTitle"], 200), newStageDescription: text(u["newStageDescription"]),
  })];
});

function readAnalysis(raw: unknown): PlanningAnalysis {
  // Models sometimes send the analysis as a bare string.
  const a = typeof raw === "string" ? { whatHappened: raw } : recOr(raw);
  const intentions = records(a["intentions"], 10).flatMap((i) => { const description = text(i["description"]); return description ? [define({ type: text(i["type"], 60), description, priority: oneOf(i["priority"], ["must", "should", "could"] as const), targetTurn: oneOf(i["targetTurn"], ["next", "soon", "eventually"] as const) })] : []; });
  const plain = (Array.isArray(a["intentions"]) ? a["intentions"] : []).flatMap((i) => (typeof i === "string" && text(i) ? [{ description: text(i)! }] : []));
  const all = [...plain, ...intentions].slice(0, 10);
  return define({
    whatHappened: text(a["whatHappened"]), summary: text(a["summary"]), seedsPlanted: list(a["seedsPlanted"]), seedsPaidOff: list(a["seedsPaidOff"]), unexpected: list(a["unexpected"]),
    pacingAnalysis: text(a["pacingAnalysis"]), playerEnergy: text(a["playerEnergy"]), intentions: all.length > 0 ? all : undefined, suggestedActions: list(a["suggestedActions"], 8),
  });
}

function readChapter(raw: unknown): PlanningChapterUpdate {
  const c = recOr(raw);
  return define({
    action: oneOf<PlanningChapterUpdate["action"]>(c["action"], ["none", "update", "start_new"]) ?? "none", title: text(c["title"], 120) ?? "The Story Begins", description: text(c["description"]),
    status: oneOf<NonNullable<PlanningChapterUpdate["status"]>>(c["status"], ["active", "concluding", "complete"]), themes: list(c["themes"]), objectives: list(c["objectives"]), tone: text(c["tone"], 200), closingMoment: text(c["closingMoment"]),
  });
}

/** Reads the command's arguments once. A missing or malformed directive refuses the whole round. */
export function readPlanningRound(raw: unknown): ReadRound {
  if (!isRecord(raw)) return { ok: false, error: "the planning command's arguments were not an object" };
  const directive = readDirective(raw["directive"]);
  if (typeof directive === "string") return { ok: false, error: directive };
  return { ok: true, round: { directive, arcUpdates: readArcs(raw["arcUpdates"]), seedUpdates: readSeeds(raw["seedUpdates"]), invisibleArcUpdates: readHidden(raw["invisibleArcUpdates"]), analysis: readAnalysis(raw["analysis"]), chapterUpdate: readChapter(raw["chapterUpdate"]) } };
}
