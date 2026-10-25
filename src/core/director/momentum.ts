/**
 * The momentum engine (RoleCall `dm-stream/momentum-engine.ts`): deterministic pressure computed from the Director's state before it plans. Which arcs are stale or overdue, which seeds
 * are ripe, whether planting has stalled, which hidden arcs are ready to surface. Thresholds are RoleCall's, exactly. The report is shown to the planner (formatMomentumReport) and read
 * again after it plans (directive.ts enrichFromMomentum), so the pressure reaches the narrator even when the planner forgets. Detectors for hidden events, off-screen NPC actions and
 * parallel timelines are not ported: nothing writes those fields.
 */
import type { DirectorState } from "../../stage/contracts/director-types";
import { liveArcs, liveInvisible, liveSeeds } from "./state";

export interface MomentumConfig { arcStaleThreshold: number; seedRipeThreshold: number }
/** RoleCall's balanced preset; it has no control, so this is the only one. */
export const MOMENTUM: MomentumConfig = { arcStaleThreshold: 15, seedRipeThreshold: 30 };

export interface StaleArc { name: string; status: string; turnsSinceProgress: number; suggestedAction: string }
export interface ForcedArcAction { id: string; name: string; status: string; horizon: string; turnsActive: number; horizonLimit: number; overdueBy: number }
export interface RipeSeed { name: string; turnsPlanted: number; reinforcements: number; payoff: string; suggestedAction: string }
export interface TensionPeak { characters: string[]; source: string; intensity: "low" | "medium" | "high" }
export interface PlantingPressure { active: boolean; severity: "none" | "moderate" | "high" | "critical"; pendingCount: number; turnsSinceLastPlant: number; reason: string; suggestedAction: string }
export interface ShadowOpportunity { id: string; title: string; summary: string; reason: string; turnsRipe: number; urgency: "low" | "medium" | "high"; suggestedAction: string }
export interface MomentumReport {
  staleArcs: StaleArc[]; ripeSeeds: RipeSeed[]; tensionPeaks: TensionPeak[]; forcedActions: ForcedArcAction[]; shadowOpportunities: ShadowOpportunity[];
  plantingPressure: PlantingPressure; pacingRecommendation: string; summary: string;
}

/** An arc past horizon x 3 turns without progress must be acted on this turn. */
const HORIZON_LIMITS: Record<string, number> = { immediate: 2, short: 9, medium: 15, long: 30, epic: 75 };
const INVISIBLE_SURFACE: Record<string, number> = { immediate: 2, short: 6, medium: 12, long: 25, epic: 60 };
/** The most entries of each list the planner is shown; the report states the full count in its summary, and the most overdue come first. */
const LIST_MAX = 10;
const PLANTING = { moderate: 12, high: 20, critical: 35 } as const;

export function computeMomentum(state: DirectorState, turn: number, config: MomentumConfig = MOMENTUM): MomentumReport {
  const staleArcs: StaleArc[] = [];
  const forcedActions: ForcedArcAction[] = [];
  for (const arc of liveArcs(state)) {
    if (arc.status === "complete" || arc.status === "abandoned") continue;
    // An arc with no progress turn gets a grace period: it counts as having just moved.
    const turnsSince = turn - (arc.lastProgressTurn ?? turn);
    if (turnsSince >= config.arcStaleThreshold) {
      const suggestedAction = arc.status === "seeding" ? "Time to escalate this arc from setup to active development."
        : arc.status === "building" ? "This arc has been building too long - push toward a turning point or complication."
        : arc.status === "climax" ? "Climax has stalled - deliver the payoff or force a resolution."
        : `Force progression - ${turnsSince} turns is too long without movement.`;
      staleArcs.push({ name: arc.title, status: arc.status, turnsSinceProgress: turnsSince, suggestedAction });
    }
    // Seeding arcs are allowed to simmer.
    if (arc.status === "seeding") continue;
    const limit = HORIZON_LIMITS[arc.horizon] ?? HORIZON_LIMITS["medium"]!;
    if (turnsSince >= limit) forcedActions.push({ id: arc.id, name: arc.title, status: arc.status, horizon: arc.horizon, turnsActive: turnsSince, horizonLimit: limit, overdueBy: turnsSince - limit });
  }
  staleArcs.sort((a, b) => b.turnsSinceProgress - a.turnsSinceProgress);
  forcedActions.sort((a, b) => b.overdueBy - a.overdueBy);

  const seeds = liveSeeds(state);
  const ripeSeeds: RipeSeed[] = seeds
    .filter((s) => !s.payoffDelivered && turn - s.plantedAtTurn >= config.seedRipeThreshold && s.reinforcements.length >= 2)
    .map((s) => ({
      name: s.hint, turnsPlanted: turn - s.plantedAtTurn, reinforcements: s.reinforcements.length, payoff: s.payoff,
      suggestedAction: turn - s.plantedAtTurn > config.seedRipeThreshold * 2 ? "OVERDUE - this seed has been waiting far too long. Deliver the payoff soon or it will feel forgotten." : "Ready for payoff. Look for a natural moment to deliver the reveal.",
    }))
    .sort((a, b) => b.turnsPlanted - a.turnsPlanted);

  const plantingPressure = plantingOf(seeds, turn);
  const shadowOpportunities = shadowOf(state, turn);
  const tensionPeaks = tensionOf(state);
  const pacingRecommendation = pacingOf(state, staleArcs.length, ripeSeeds.length);

  const parts: string[] = [];
  if (forcedActions.length > 0) parts.push(`${forcedActions.length} arc(s) MUST be resolved/advanced this turn`);
  if (staleArcs.length > 0) parts.push(`${staleArcs.length} stale arc(s) need attention`);
  if (ripeSeeds.length > 0) parts.push(`${ripeSeeds.length} seed(s) ripe for payoff`);
  if (plantingPressure.active) parts.push(`planting pressure: ${plantingPressure.severity}`);
  if (shadowOpportunities.length > 0) parts.push(`${shadowOpportunities.length} shadow item(s) ready to surface`);
  if (tensionPeaks.length > 0) parts.push(`${tensionPeaks.length} tension convergence(s) detected`);
  const summary = parts.length > 0 ? `${parts.join("; ")}. ${pacingRecommendation}` : `All arcs progressing normally. ${pacingRecommendation}`;
  return { staleArcs, ripeSeeds, tensionPeaks, forcedActions, shadowOpportunities, plantingPressure, pacingRecommendation, summary };
}

function plantingOf(seeds: readonly { plantedAtTurn: number; payoffDelivered: boolean }[], turn: number): PlantingPressure {
  const pendingCount = seeds.filter((s) => !s.payoffDelivered).length;
  const last = seeds.length > 0 ? Math.max(...seeds.map((s) => s.plantedAtTurn)) : undefined;
  const turnsSinceLastPlant = last === undefined ? turn : Math.max(0, turn - last);
  const on = (severity: "moderate" | "high" | "critical", reason: string, suggestedAction: string): PlantingPressure => ({ active: true, severity, pendingCount, turnsSinceLastPlant, reason, suggestedAction });
  if (last === undefined) {
    return on("critical", "No seeds have ever been planted in this chat. The foreshadowing/payoff machinery is inert.", "PLANT NOW. Include at least one action:\"plant\" entry in seedUpdates this turn. Think ahead: what could the narrator mention in passing this scene that pays off 30+ turns from now? A character quirk, an overheard rumor, a strange symbol, an NPC's odd behavior - anything that sets up a future reveal.");
  }
  if (turnsSinceLastPlant >= PLANTING.critical) return on("critical", `Last new seed was planted ${turnsSinceLastPlant} turns ago. The plant-early/pay-off-later loop has stopped producing.`, "PLANT NOW. Include at least one action:\"plant\" entry in seedUpdates this turn. You've been letting the seed system rot. Without new seeds, the ripe-seed machinery has nothing to surface later.");
  if (turnsSinceLastPlant >= PLANTING.high) return on("high", `Last new seed was planted ${turnsSinceLastPlant} turns ago. Planting has stalled.`, "Include at least one action:\"plant\" entry in seedUpdates this turn. What could the narrator mention in passing that pays off later? A rumor, a character quirk, a strange detail - anything that seeds a future reveal.");
  if (turnsSinceLastPlant >= PLANTING.moderate) return on("moderate", `Last new seed was planted ${turnsSinceLastPlant} turns ago.`, "Consider planting a new seed this turn. The plant-early/pay-off-later pattern works best with steady planting rhythm - don't let the hopper go empty.");
  return { active: false, severity: "none", pendingCount, turnsSinceLastPlant, reason: `Last plant was ${turnsSinceLastPlant} turns ago. Planting rhythm healthy.`, suggestedAction: "" };
}

function shadowOf(state: DirectorState, turn: number): ShadowOpportunity[] {
  const out: ShadowOpportunity[] = [];
  for (const arc of liveInvisible(state)) {
    if (arc.status === "visible" || arc.status === "resolved") continue;
    const threshold = INVISIBLE_SURFACE[arc.horizon] ?? INVISIBLE_SURFACE["medium"]!;
    const expectedReached = arc.expectedSurfaceTurn !== undefined && turn >= arc.expectedSurfaceTurn;
    if (!expectedReached && arc.turnsActive < threshold) continue;
    const turnsRipe = expectedReached ? Math.max(0, turn - arc.expectedSurfaceTurn!) : arc.turnsActive - threshold;
    const actions = {
      seeding: "Plant the first breadcrumb - have an NPC drop a rumor or the environment show a trace. Add a newClue in invisibleArcUpdates or weave it into the directive as a callback.",
      building: "Escalate the clues - have the player notice a pattern, or let an NPC reference the underlying truth obliquely. Consider action \"surface\" in invisibleArcUpdates if the player has enough clues to start connecting dots.",
      approaching_player: "SURFACE NOW. This arc should break into the visible story this scene. Use action \"surface\" in invisibleArcUpdates and write a directive that introduces the player to it.",
    } as const;
    out.push({
      id: arc.id, title: arc.title, summary: arc.description.slice(0, 140) || arc.title,
      reason: expectedReached ? `Expected surface turn (${arc.expectedSurfaceTurn}) reached ${turnsRipe} turns ago` : `Active for ${arc.turnsActive} turns (threshold for ${arc.horizon} horizon: ${threshold})`,
      turnsRipe, urgency: turnsRipe >= 10 ? "high" : turnsRipe >= 4 ? "medium" : "low", suggestedAction: actions[arc.status],
    });
  }
  const rank = { high: 3, medium: 2, low: 1 };
  return out.sort((a, b) => rank[b.urgency] - rank[a.urgency] || b.turnsRipe - a.turnsRipe);
}

function tensionOf(state: DirectorState): TensionPeak[] {
  const byCharacter = new Map<string, string[]>();
  for (const arc of liveArcs(state)) {
    if (arc.status === "complete" || arc.status === "abandoned") continue;
    for (const c of arc.involvedCharacters) byCharacter.set(c, [...(byCharacter.get(c) ?? []), arc.title]);
  }
  return [...byCharacter].filter(([, titles]) => titles.length >= 2).map(([c, titles]) => ({ characters: [c], source: `Involved in ${titles.length} active arcs: ${titles.join(", ")}`, intensity: titles.length >= 3 ? "high" as const : "medium" as const }));
}

function pacingOf(state: DirectorState, stale: number, ripe: number): string {
  const r = state.pacing.recommendations;
  if (stale >= 3 || ripe >= 2) return "Multiple storylines need attention. Prioritize the most stale arc and deliver at least one seed payoff this scene.";
  if (r.needsQuietMoment) return "The story needs a breather. Use this scene for character development, but weave in a subtle callback or seed reinforcement.";
  if (r.needsTension) return "Tension is low. Push an arc forward or surface a hidden complication to build momentum.";
  if (r.readyForClimax) return "The story is primed for a climax. If any arc is at 'building' status, consider pushing it to its turning point.";
  if (stale > 0) return "One or more arcs need progression. Weave advancement into the natural flow of the scene.";
  return "Pacing is healthy. Continue the current rhythm.";
}

/** The momentum section of the planner's user prompt (RoleCall `formatMomentumReport`). */
export function formatMomentumReport(report: MomentumReport): string {
  const quiet = report.staleArcs.length + report.ripeSeeds.length + report.tensionPeaks.length + report.forcedActions.length + report.shadowOpportunities.length === 0 && !report.plantingPressure.active;
  if (quiet) return `[MOMENTUM REPORT]\n${report.pacingRecommendation}\nAll storylines progressing normally - no forced escalation needed.`;
  const out: string[] = ["[MOMENTUM REPORT]"];
  if (report.forcedActions.length > 0) {
    out.push("MANDATORY ARC ACTIONS THIS TURN - NON-NEGOTIABLE:", "The following arcs have exceeded their horizon x 3 turn budget.", "You MUST include a commit_planning_round.arcUpdates entry for each one with either:", "  - status: \"complete\" or \"abandoned\" (if the arc has played out)", "  - a meaningful newStageTitle and newStageDescription that advance the arc toward its climax/resolution", "Do NOT skip, defer, or leave these for a later turn. They are overdue.", "");
    for (const a of report.forcedActions.slice(0, LIST_MAX)) out.push(`  [${a.id}] "${a.name}" (${a.status}, ${a.horizon} horizon) - ${a.turnsActive} turns without progress (${a.overdueBy} past limit of ${a.horizonLimit}). RESOLVE OR ADVANCE.`);
    out.push("");
  }
  if (report.staleArcs.length > 0) {
    out.push("STALE ARCS (need progression):");
    for (const a of report.staleArcs.slice(0, LIST_MAX)) out.push(`  "${a.name}" (${a.status}) - ${a.turnsSinceProgress} turns since last progress. ${a.suggestedAction}`);
  }
  if (report.ripeSeeds.length > 0) {
    out.push("RIPE SEEDS (ready for payoff):");
    for (const s of report.ripeSeeds.slice(0, LIST_MAX)) out.push(`  "${s.name}" - planted ${s.turnsPlanted} turns ago, reinforced ${s.reinforcements}x. Payoff: ${s.payoff}. ${s.suggestedAction}`);
  }
  const p = report.plantingPressure;
  if (p.active) {
    out.push("", `SEED PLANTING PRESSURE (${p.severity.toUpperCase()}):`, `  ${p.reason}`, `  Pending seeds currently tracked: ${p.pendingCount}`, `  -> ${p.suggestedAction}`);
    if (p.severity === "critical") out.push("  This is a CRITICAL pressure - planting a seed this turn is NOT optional.");
  }
  if (report.shadowOpportunities.length > 0) {
    out.push("", "SURFACE-READY SHADOW WORLD (hidden arcs ready to bleed into the visible story):", "You have been writing invisible arcs. Some are ripe to touch the visible narrative now. For each one below, either:", "  (a) set its action to \"surface\" in commit_planning_round.invisibleArcUpdates", "  (b) OR weave a clue/reference into this turn's directive as an arcDirection or callback", "  (c) OR add a newClue to it this turn", "");
    for (const o of report.shadowOpportunities.slice(0, LIST_MAX)) {
      out.push(`  [INVISIBLE ARC] "${o.title}" (${o.urgency}, ripe ${o.turnsRipe}t)`, `     Summary: ${o.summary}`, `     Why ripe: ${o.reason}`, `     -> ${o.suggestedAction}`);
    }
  }
  if (report.tensionPeaks.length > 0) {
    out.push("TENSION CONVERGENCES:");
    for (const t of report.tensionPeaks.slice(0, LIST_MAX)) out.push(`  ${t.characters.join(" / ")} (${t.intensity}): ${t.source}`);
  }
  out.push(`\nPacing: ${report.pacingRecommendation}`);
  return out.join("\n");
}

/** The pressure message sent after the user prompt (RoleCall `buildMomentumPressures`): forced arc resolutions, a nextBeat for every arc without one, and seed planting. */
export function planningPressures(state: DirectorState, report: MomentumReport): string {
  const sections: string[] = [];
  if (report.forcedActions.length > 0) {
    const list = report.forcedActions.slice(0, LIST_MAX).map((a) => `  - [${a.id}] "${a.name}" (currently ${a.status}, ${a.horizon} horizon, ${a.turnsActive} turns without progress, ${a.overdueBy} past limit)`).join("\n");
    sections.push(`MANDATORY ARC RESOLUTIONS - THIS TURN IS NOT OPTIONAL:\nThe following arcs have exceeded their horizon x 3 turn budget and MUST be acted upon in this turn's commit_planning_round.arcUpdates:\n\n${list}\n\nFor EACH arc above, your arcUpdates entry MUST include ONE of:\n  (a) status: "complete" - arc has played out, mark done\n  (b) status: "abandoned" - arc has lost relevance, drop it\n  (c) newStageTitle + newStageDescription - meaningful stage transition advancing toward climax/resolution\n\nDo NOT skip these. Do NOT leave them for a later turn. Do NOT add a pointless label to pretend you acted on them. If an arc has been sitting for this long, the story no longer needs it OR it needs a real turning point - pick one.`);
  }
  const needing = liveArcs(state).filter((a) => a.status !== "complete" && a.status !== "abandoned" && (!a.nextBeat || a.nextBeat.status === "delivered" || a.nextBeat.status === "abandoned"));
  if (needing.length > 0) {
    const list = needing.slice(0, LIST_MAX).map((a) => `  - [${a.id}] "${a.title}" (${a.status}) - ${!a.nextBeat ? "no nextBeat set" : a.nextBeat.status === "delivered" ? `previous beat delivered on turn ${a.nextBeat.deliveredAtTurn ?? "?"}, needs new plan` : "previous beat abandoned, needs new plan"}`).join("\n");
    sections.push(`MANDATORY: SET A FORWARD-LOOKING nextBeat FOR THESE ARCS THIS TURN:\n${list}\n\nFor each arc above, include an arcUpdates entry with a new nextBeat:\n  { "arcId": "<id>", "nextBeat": { "description": "<specific, prescriptive beat>", "targetTurn": <optional> } }\n\nA good nextBeat describes an OBSERVABLE event or staged opportunity the narrator can deliver, not an emotional state. "Valen drops a small slip - mentions a place name from his claimed backstory" is good. "Valen becomes suspicious" is not. Be specific.\n\nArcs without a nextBeat drift. Arcs with a delivered-but-not-replaced beat go to sleep. Neither is acceptable - set a plan.`);
  }
  const p = report.plantingPressure;
  if (p.active) {
    const header = p.severity === "critical" ? "SEED PLANTING IS MANDATORY THIS TURN - NOT OPTIONAL:" : `SEED PLANTING PRESSURE (${p.severity.toUpperCase()}):`;
    sections.push(`${header}\n${p.reason}\n\nYou MUST include at least one entry in commit_planning_round.seedUpdates this turn with action:"plant". Think ahead: what detail could the narrator mention in passing this scene that sets up a future reveal 20-100 turns from now? A rumor, an NPC quirk, an overheard snippet, a strange symbol, an odd behavior, an off-hand remark. The plant-early/pay-off-later philosophy only works if you plant. Creating arcs is easy; committing to future seed payoffs requires planning.\n\nPlant format for seedUpdates:\n  { "action": "plant", "title": "<short seed hint, 3-8 words>", "description": "<what this sets up>", "scope": "player"|"world", "relatedArcId": "<arc id or empty string>", "payoffHorizon": "short"|"medium"|"long"|"epic" }`);
  }
  return sections.join("\n\n");
}
