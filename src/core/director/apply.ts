/**
 * Applying one planning round to the Director's state (RoleCall `DMStreamService.ts` mergeArcUpdates, processToolChapterUpdate, processToolSeedUpdates, processToolInvisibleArcUpdates,
 * updatePacing; `findArcMatch`): a pure function from the state a turn started with and the round the planner committed to the next state and the activity lines the round earned.
 * Same rules as RoleCall (counters, caps, dedupe, a first chapter forced, a new chapter refused in its first three turns), with these differences, each deliberate:
 * removal is soft (`removedAt`, never a splice); pacing is given the real turn, so its rhythm hints can fire (RoleCall passes none, and they never do); a collection at its cap refuses a
 * new item rather than growing past what the store accepts. Nothing here reads a clock or a store: `now` and `turn` come in.
 */
import {
  DIRECTOR_ACTIVITY_MAX, DIRECTOR_ANALYSIS_MAX, DIRECTOR_CAPS, DIRECTOR_DETAILS_MAX, DIRECTOR_REINFORCEMENTS_MAX, type DirectorActivity, type DirectorActivityType, type DirectorArc, type DirectorChapter, type DirectorHorizon, type DirectorInvisibleArc,
  type DirectorPacingState, type DirectorSeed, type DirectorStage, type DirectorState, type PlanningArcUpdate, type PlanningChapterUpdate, type PlanningInvisibleArcUpdate, type PlanningRound, type PlanningSeedUpdate,
} from "../../stage/contracts/director-types";
import { prune } from "./bounds";

export interface ApplyContext { turn: number; userAction: string; now: number; model?: string }
export interface Applied { state: DirectorState; activity: DirectorActivity[] }

const STAGES_MAX = 12;
const CLUES_MAX = 12;
/** A stage's, a reinforcement's and a clue's text are notes, not essays; the state has to hold hundreds of turns of them. */
const STAGE_TEXT_MAX = 300;
const NOTE_TEXT_MAX = 200;
const SEED_THRESHOLDS: Record<DirectorHorizon, number> = { immediate: 1, short: 3, medium: 5, long: 10, epic: 25 };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const STOP = new Set(["the", "a", "an", "of", "and", "in", "to", "for", "is", "on", "at", "by", "with", "as", "from"]);
const words = (s: string) => s.toLowerCase().replace(/'s\b/g, "").split(/\s+/).map((w) => w.replace(/[^a-z0-9]/g, "")).filter((w) => w.length > 2 && !STOP.has(w));

/** The arc an incoming id or title names: exact id, same title with the punctuation gone, then at least two shared significant words covering half of the shorter title (RoleCall findArcMatch). */
function matchArc<T extends { id: string; title: string }>(candidates: readonly T[], selector: string): T | undefined {
  const byId = candidates.find((c) => c.id === selector);
  if (byId) return byId;
  const key = norm(selector);
  const byTitle = key ? candidates.find((c) => norm(c.title) === key) : undefined;
  if (byTitle) return byTitle;
  const incoming = words(selector);
  if (incoming.length < 2) return undefined;
  let best: { c: T; ratio: number } | undefined;
  for (const c of candidates) {
    const theirs = words(c.title);
    if (theirs.length < 1) continue;
    const overlap = incoming.filter((w) => theirs.includes(w)).length;
    const ratio = overlap / Math.min(incoming.length, theirs.length);
    if (overlap >= 2 && ratio >= 0.5 && (!best || ratio > best.ratio)) best = { c, ratio };
  }
  return best?.c;
}

/** A label, not a description: one sentence, 80 characters (RoleCall sanitizeArcTitle). */
function cleanTitle(raw: string): string {
  const one = raw.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s|:\s/)[0]?.trim() ?? "";
  if (one.length <= 80) return one;
  const cut = one.slice(0, 80);
  const space = cut.lastIndexOf(" ");
  return (space > 48 ? cut.slice(0, space) : cut).trim();
}

const horizonFor = (h: string | undefined): DirectorHorizon => (h && h in SEED_THRESHOLDS ? (h as DirectorHorizon) : "medium");
/** Makes room for one more by dropping removed rows the model made; a removed row a person made or planted is kept, so a list full of those refuses the newcomer instead. */
const cap = <T extends { removedAt?: number }>(list: T[], max: number): T[] => {
  while (list.length >= max) {
    const gone = list.findIndex((x) => x.removedAt !== undefined && !(x as { userAuthored?: true }).userAuthored);
    if (gone < 0) return list;
    list.splice(gone, 1);
  }
  return list;
};
const pushStage = (stages: DirectorStage[], stage: DirectorStage): DirectorStage[] => {
  const last = stages[stages.length - 1];
  if (last && (last.title.trim().toLowerCase() === stage.title.trim().toLowerCase() || (stage.description && last.description?.trim().toLowerCase() === stage.description.trim().toLowerCase()))) return stages;
  return [...stages, stage].slice(-STAGES_MAX);
};

export function applyRound(base: DirectorState, round: PlanningRound, ctx: ApplyContext): Applied {
  const s: DirectorState = structuredClone(base);
  const activity: DirectorActivity[] = [];
  const note = (type: DirectorActivityType, description: string, result: DirectorActivity["result"] = "success", details?: string) =>
    activity.push({ id: `act-${s.nextId++}`, at: ctx.now, turn: ctx.turn, type, result, description, ...(details ? { details: details.slice(0, DIRECTOR_DETAILS_MAX) } : {}), ...(ctx.model ? { model: ctx.model } : {}) });

  applyChapter(s, round.chapterUpdate, ctx);
  applyArcs(s, round.arcUpdates, ctx, note);
  applySeeds(s, round.seedUpdates, ctx, note);
  applyHidden(s, round.invisibleArcUpdates, ctx, note);

  const a = round.analysis;
  s.recentAnalysis = [...s.recentAnalysis, {
    turn: ctx.turn, userAction: ctx.userAction.slice(0, 200), whatHappened: a.whatHappened ?? a.summary ?? a.pacingAnalysis ?? "", seedsPlanted: a.seedsPlanted ?? [], seedsPaidOff: a.seedsPaidOff ?? [], unexpected: a.unexpected ?? [],
    ...(a.pacingAnalysis ? { pacingAnalysis: a.pacingAnalysis } : {}), ...(a.playerEnergy ? { playerEnergy: a.playerEnergy } : {}),
  }].slice(-DIRECTOR_ANALYSIS_MAX);
  s.nextIntentions = (a.intentions ?? []).map((i) => ({ type: i.type ?? "advance_arc", description: i.description ?? "", priority: i.priority ?? "should", targetTurn: i.targetTurn ?? "next" })).filter((i) => i.description !== "");
  s.suggestedActions = a.suggestedActions ?? [];
  s.pacing = pacingAfter(s.pacing, round.directive.mood, ctx.turn);
  s.lastDirective = round.directive;
  s.lastDirectiveTurn = ctx.turn;
  s.turn = ctx.turn;

  const d = round.directive;
  const counts = [d.arcDirections?.length ? `${d.arcDirections.length} arc direction${d.arcDirections.length === 1 ? "" : "s"}` : "", d.characterBeats?.length ? `${d.characterBeats.length} character beat${d.characterBeats.length === 1 ? "" : "s"}` : "", d.callbacks?.length ? `${d.callbacks.length} callback${d.callbacks.length === 1 ? "" : "s"}` : ""].filter(Boolean);
  note("directive", `Directive: ${[d.mood, d.pacing, ...counts].join(" · ")}`, "success", [d.narrativeGoal ? `Goal: ${d.narrativeGoal}` : "", d.endingHook ? `Ending Hook: ${d.endingHook}` : ""].filter(Boolean).join("\n") || undefined);
  s.activity = [...s.activity, ...activity].slice(-DIRECTOR_ACTIVITY_MAX);
  return { state: prune(s), activity };
}

function applyChapter(s: DirectorState, u: PlanningChapterUpdate, ctx: ApplyContext): void {
  const current = s.chapters.find((c) => c.id === s.currentChapterId);
  // No chapter yet: the first one is created whatever the planner asked for.
  const action = s.chapters.length === 0 ? "start_new" : u.action;
  const touch = (c: DirectorChapter) => { c.turnsElapsed += 1; };
  if (action === "start_new") {
    const elapsed = current ? Math.max(current.turnsElapsed, ctx.turn - current.createdAtTurn) : 0;
    // A chapter in its first three turns is not closed, whatever the planner asked for.
    if (current && current.status === "active" && elapsed < 3) { touch(current); return; }
    for (const c of s.chapters) if (c.status === "active" || c.status === "concluding") { c.status = "complete"; if (u.closingMoment) c.closingMoment = u.closingMoment; }
    if (s.chapters.length >= DIRECTOR_CAPS.chapters) return;
    const number = s.chapters.reduce((n, c) => Math.max(n, c.number), 0) + 1;
    const chapter: DirectorChapter = {
      id: `chapter-${number}`, number, title: u.title.replace(/^chapter\s*\d+\s*[:.\-]\s*/i, "").trim() || `Chapter ${number}`, premise: u.description ?? "", status: "active", themes: u.themes ?? [], tone: u.tone ?? "",
      majorGoal: (u.objectives ?? []).join("; "), estimatedTurns: { minimum: 20, target: 50, maximum: 100 }, turnsElapsed: 0, createdAtTurn: ctx.turn,
    };
    s.chapters.push(chapter);
    s.currentChapterId = chapter.id;
    return;
  }
  if (!current) return;
  if (action === "update") {
    if (u.description) current.premise = u.description;
    if (u.themes) current.themes = u.themes;
    if (u.objectives) current.majorGoal = u.objectives.join("; ");
    if (u.tone) current.tone = u.tone;
    if (u.status) current.status = u.status;
    if (u.closingMoment) current.closingMoment = u.closingMoment;
  }
  touch(current);
}

type Note = (type: DirectorActivityType, description: string, result?: DirectorActivity["result"], details?: string) => void;

function applyArcs(s: DirectorState, updates: PlanningArcUpdate[], ctx: ApplyContext, note: Note): void {
  for (const u of updates) {
    const live = s.arcs.filter((a) => a.removedAt === undefined);
    const hit = matchArc(live, u.arcId) ?? (u.title ? matchArc(live, u.title) : undefined);
    const stage = u.newStageTitle ? { title: u.newStageTitle, ...(u.newStageDescription ? { description: u.newStageDescription.slice(0, STAGE_TEXT_MAX) } : {}), turn: hit?.turnsActive ?? 0 } : undefined;
    const beat = u.nextBeat ? { description: u.nextBeat.description, plannedAtTurn: ctx.turn, ...(u.nextBeat.targetTurn !== undefined ? { targetTurn: u.nextBeat.targetTurn } : {}), status: "pending" as const } : undefined;
    if (hit) {
      const before = hit.stages.length;
      if (stage) hit.stages = pushStage(hit.stages, stage);
      const wasPending = hit.nextBeat?.status === "pending";
      if (u.markNextBeatDelivered && hit.nextBeat?.status === "pending") hit.nextBeat = { ...hit.nextBeat, status: "delivered", deliveredAtTurn: ctx.turn };
      if (beat) hit.nextBeat = beat;
      const statusChanged = u.status !== undefined && u.status !== hit.status;
      if (u.description) hit.description = u.description;
      if (u.status) hit.status = u.status;
      if (u.horizon) hit.horizon = u.horizon;
      if (u.priority) hit.priority = u.priority;
      if (u.arcType) hit.arcType = u.arcType;
      hit.turnsActive += 1;
      // Rewriting the description is not progress; a new stage, a status change or a delivered beat is.
      if (hit.stages.length > before || statusChanged || (u.markNextBeatDelivered && wasPending)) hit.lastProgressTurn = ctx.turn;
      note("arc", `Arc "${hit.title}"${statusChanged ? ` is now ${hit.status}` : stage ? ` gained a stage: ${stage.title}` : " updated"}`);
      continue;
    }
    const title = cleanTitle(u.title ?? u.arcId);
    if (!title || cap(s.arcs, DIRECTOR_CAPS.arcs).length >= DIRECTOR_CAPS.arcs) continue;
    const arcType = u.arcType ?? "side";
    const arc: DirectorArc = {
      id: `arc-${s.nextId++}`, title, description: u.description ?? "", ...(s.currentChapterId ? { chapterId: s.currentChapterId } : {}), status: u.status ?? "seeding", priority: u.priority ?? "background", arcType,
      horizon: u.horizon ?? "medium", scope: arcType === "main" || arcType === "world" ? "world" : "player", turnsActive: 0, lastProgressTurn: ctx.turn, involvedCharacters: [],
      stages: stage ? [{ ...stage, turn: 0 }] : [], ...(beat ? { nextBeat: beat } : {}), createdAtTurn: ctx.turn,
    };
    s.arcs.push(arc);
    note("arc", `New arc "${arc.title}" (${arc.status}, ${arc.horizon})`);
  }
}

function applySeeds(s: DirectorState, updates: PlanningSeedUpdate[], ctx: ApplyContext, note: Note): void {
  for (const seed of s.seeds) if (!seed.payoffDelivered && seed.removedAt === undefined) seed.turnsActive += 1;
  for (const u of updates) {
    const live = s.seeds.filter((x) => x.removedAt === undefined);
    // A named id that does not exist is skipped; a shared title is not identity.
    const hit = u.id ? live.find((x) => x.id === u.id) : live.find((x) => x.hint.toLowerCase() === u.title.toLowerCase());
    if (u.id && !hit) continue;
    if (u.action === "plant") {
      if (hit) {
        if (u.description) hit.payoff = u.description;
        if (u.scope) hit.scope = u.scope;
        if (u.relatedArcId) hit.relatedArcId = u.relatedArcId;
        continue;
      }
      if (cap(s.seeds, DIRECTOR_CAPS.seeds).length >= DIRECTOR_CAPS.seeds) continue;
      const payoffHorizon = horizonFor(u.payoffHorizon);
      s.seeds.push({ id: `seed-${s.nextId++}`, hint: u.title, payoff: u.description ?? "", scope: u.scope ?? "player", ...(u.relatedArcId ? { relatedArcId: u.relatedArcId } : {}), plantedAtTurn: ctx.turn, payoffHorizon, turnsActive: 0, payoffDelivered: false, reinforcements: [] });
      note("seed", `Planted seed "${u.title}" (${payoffHorizon})`);
    } else if (u.action === "reinforce" && hit) {
      if (u.description && !hit.payoff) hit.payoff = u.description;
      if (u.scope) hit.scope = u.scope;
      if (u.relatedArcId) hit.relatedArcId = u.relatedArcId;
      if (u.reinforcement) { hit.reinforcements = [...hit.reinforcements, { turn: ctx.turn, description: u.reinforcement.slice(0, NOTE_TEXT_MAX) }].slice(-DIRECTOR_REINFORCEMENTS_MAX); note("seed", `Reinforced seed "${hit.hint}"`); }
    } else if (u.action === "resolve" && hit) {
      hit.payoffDelivered = true;
      hit.payoffTurn = ctx.turn;
      const outcome = u.outcome ?? u.description;
      if (outcome) hit.payoff = outcome;
      note("seed", `Paid off seed "${hit.hint}"`);
    } else if (u.action === "delete" && hit) {
      hit.removedAt = ctx.now;
      note("seed", `Removed seed "${hit.hint}"`);
    }
  }
}

function applyHidden(s: DirectorState, updates: PlanningInvisibleArcUpdate[], ctx: ApplyContext, note: Note): void {
  for (const arc of s.invisibleArcs) if (arc.removedAt === undefined && arc.status !== "resolved" && arc.status !== "visible") arc.turnsActive += 1;
  const beats = (u: PlanningInvisibleArcUpdate) => (u.plannedBeats ?? []).map((b, i) => ({ id: `beat-${ctx.turn}-${i}`, description: b.description, completed: b.completed ?? false, hidden: b.hidden ?? true }));
  const apply = (arc: DirectorInvisibleArc, u: PlanningInvisibleArcUpdate) => {
    if (u.description) arc.description = u.description;
    if (u.status) arc.status = u.status;
    if (u.arcType) arc.arcType = u.arcType;
    if (u.horizon) arc.horizon = u.horizon;
    if (u.surfaceCondition) arc.surfaceCondition = u.surfaceCondition;
    if (u.relatedVisibleArcs) arc.relatedVisibleArcs = u.relatedVisibleArcs;
    if (u.foreshadowingSeeds) arc.foreshadowingSeeds = u.foreshadowingSeeds;
    if (u.plannedBeats) arc.plannedBeats = beats(u);
    arc.expectedSurfaceTurn = ctx.turn - arc.turnsActive + SEED_THRESHOLDS[arc.horizon];
  };
  for (const u of updates) {
    const live = s.invisibleArcs.filter((a) => a.removedAt === undefined);
    const hit = live.find((a) => (u.arcId && a.id === u.arcId) || a.title.toLowerCase() === u.title.toLowerCase());
    const stage = u.newStageTitle ? { title: u.newStageTitle, ...(u.newStageDescription ? { description: u.newStageDescription.slice(0, STAGE_TEXT_MAX) } : {}), turn: ctx.turn } : undefined;
    if (u.action === "add" || u.action === "update") {
      if (hit) {
        apply(hit, u);
        if (u.action === "update") {
          if (u.newClue && !hit.playerClues.some((c) => c.clue.trim().toLowerCase() === u.newClue!.trim().toLowerCase())) hit.playerClues = [...hit.playerClues, { turn: ctx.turn, clue: u.newClue.slice(0, NOTE_TEXT_MAX) }].slice(-CLUES_MAX);
          if (stage) hit.stages = pushStage(hit.stages, stage);
        }
        note("invisible_arc", `Hidden arc "${hit.title}" updated`);
        continue;
      }
      if (cap(s.invisibleArcs, DIRECTOR_CAPS.invisibleArcs).length >= DIRECTOR_CAPS.invisibleArcs) continue;
      const horizon = u.horizon ?? "medium";
      s.invisibleArcs.push({
        id: `hidden-${s.nextId++}`, title: u.title, description: u.description ?? u.title, arcType: u.arcType ?? "background", horizon, scope: u.scope ?? "world", status: u.action === "update" ? (u.status ?? "seeding") : "seeding",
        turnsActive: 0, plannedBeats: beats(u), stages: stage ? [stage] : [], ...(u.surfaceCondition ? { surfaceCondition: u.surfaceCondition } : {}), expectedSurfaceTurn: ctx.turn + SEED_THRESHOLDS[horizon],
        relatedVisibleArcs: u.relatedVisibleArcs ?? [], foreshadowingSeeds: u.foreshadowingSeeds ?? [], playerClues: u.action === "update" && u.newClue ? [{ turn: ctx.turn, clue: u.newClue.slice(0, NOTE_TEXT_MAX) }] : [], createdAtTurn: ctx.turn,
      });
      note("invisible_arc", `New hidden arc "${u.title}"`);
    } else if (hit) {
      if (u.action === "surface") hit.status = "visible";
      else if (u.action === "resolve") hit.status = "resolved";
      else hit.removedAt = ctx.now;
      note("invisible_arc", `Hidden arc "${hit.title}" ${u.action === "surface" ? "surfaced" : u.action === "resolve" ? "resolved" : "removed"}`);
    }
  }
}

/** RoleCall's rhythm tracking: when the story last had action, quiet and an emotional beat, and what the pacing now needs. "Too much action" needs some action to have happened, and "too quiet" some quiet: a planner whose moods are never these words is not nagged. */
function pacingAfter(prev: DirectorPacingState, mood: string, turn: number): DirectorPacingState {
  const same = mood === prev.currentMood;
  const rhythm = { ...prev.rhythm };
  if (mood === "action" || mood === "climax") rhythm.lastActionSequence = turn;
  if (mood === "calm" || mood === "reflective" || mood === "intimate") rhythm.lastQuietMoment = turn;
  if (mood === "intimate" || mood === "aftermath") rhythm.lastEmotionalBeat = turn;
  return {
    currentMood: mood, turnsAtCurrentMood: same ? prev.turnsAtCurrentMood + 1 : 1, recentMoodHistory: [...prev.recentMoodHistory.slice(-10), mood], rhythm, chapterPhase: prev.chapterPhase || "development",
    recommendations: { needsQuietMoment: rhythm.lastActionSequence > 0 && turn - rhythm.lastQuietMoment > 8, needsTension: rhythm.lastQuietMoment > 0 && turn - rhythm.lastActionSequence > 12, readyForClimax: prev.turnsAtCurrentMood >= 4 && mood === "tense", needsBreather: mood === "climax" || (prev.currentMood === "climax" && !same) },
  };
}
