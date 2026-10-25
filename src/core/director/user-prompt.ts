/**
 * The planner's user prompt (RoleCall `DMStreamService.buildDMUserPrompt`, `:2548-2744`, and `buildDMTurnVariableContext`), word for word except: the lines that named tools the planner does
 * not have now name the `commit_planning_round` fields; the closing demand for one JSON object is gone (the answer is the command); the story state that RoleCall put in the system prompt
 * (`formatContextForPrompt`) opens this one instead, so the system prompt can be cached (map 13 #14); and the sections for core memories, storyboards, trackers, mechanics and the /btw
 * steering note are not here, because nothing in this app writes them. The person's standing instructions keep RoleCall's wording.
 */
import { DIRECTOR_INSTRUCTIONS_MAX, type DirectorState } from "../../stage/contracts/director-types";
import { formatDirectorHistory, type HistoryLine } from "./history";
import { formatMomentumReport, type MomentumReport } from "./momentum";
import { selfAuditBlock } from "./self-audit";
import { liveArcs, liveInvisible, liveNotes, liveSeeds } from "./state";

export interface UserPromptInput {
  state: DirectorState;
  report: MomentumReport;
  turn: number;
  userMessage: string;
  /** The conversation before the user's message, the old thinking already taken out of the assistant's replies. */
  history: readonly HistoryLine[];
  instructions?: string | undefined;
  /** The Compendium snapshot (compendium-snapshot.ts) of the books the Compendium may read; blank sends none. */
  compendium?: string | undefined;
}

const SEED_THRESHOLDS: Record<string, number> = { immediate: 1, short: 3, medium: 5, long: 10, epic: 25 };
const ARC_STAGES_SHOWN = 6;

/** What the story state may take of the prompt, however long the story: how many of each list, and how much of each item's text. The rest is counted, not sent; momentum names what most needs action. */
export const PROMPT_LIMITS = { arcs: 25, seeds: 40, hidden: 25, notes: 30, text: 300 } as const;
const clip = (t: string): string => (t.length > PROMPT_LIMITS.text ? `${t.slice(0, PROMPT_LIMITS.text)}...` : t);
const more = (n: number, what: string): string => (n > 0 ? `\n(+${n} more ${what} not shown)` : "");

/** The person's standing instructions (RoleCall `buildDmCustomInstructionsSection`); nothing when blank. */
export function instructionsSection(instructions: string | null | undefined): string {
  const trimmed = instructions?.trim().slice(0, DIRECTOR_INSTRUCTIONS_MAX);
  if (!trimmed) return "";
  return (
    `\n### Custom Instructions for DM (persistent, from the player - HIGH-PRIORITY STANDING DIRECTIVE)\n` +
    `These are the player's standing instructions for you, applied every turn. Honor them in your planning ` +
    `(arcs, seeds, beats, pacing, tone) unless doing so would violate safety, the character card, or the ` +
    `player-character POV rule.\n${trimmed}\n`
  );
}

/** What the planner knows of the story so far, in short (RoleCall `formatContextForPrompt`). */
function storyState(s: DirectorState): string {
  const sections: string[] = [];
  const arcs = liveArcs(s).slice(-PROMPT_LIMITS.arcs);
  if (arcs.length > 0) sections.push(`Active Story Arcs:\n${arcs.map((a) => `- "${a.title}" [${a.status}/${a.priority}]: ${clip(a.description)}`).join("\n")}`);
  if (s.nextIntentions.length > 0) sections.push(`Your Current Intentions:\n${s.nextIntentions.map((i) => `- [${i.priority}] ${i.type}: ${i.description}`).join("\n")}`);
  sections.push(`Current Mood: ${s.pacing.currentMood} (${s.pacing.turnsAtCurrentMood} turns)`);
  return sections.join("\n\n");
}

function chapterInfo(s: DirectorState, turn: number): string {
  const done = s.chapters.filter((c) => c.status === "complete").sort((a, b) => a.number - b.number);
  const current = s.chapters.find((c) => c.id === s.currentChapterId);
  let info = "";
  if (done.length > 0) info += `Previous chapters:\n${done.map((c) => ` - Chapter ${c.number}: "${c.title}" (${c.turnsElapsed} turns) - ${c.premise || c.majorGoal || "completed"}\n`).join("")}\n`;
  if (!current) return `${info}No chapter defined yet - commit_planning_round.chapterUpdate MUST use action "start_new" to create Chapter 1.`;
  const elapsed = Math.max(current.turnsElapsed, Math.max(0, turn - current.createdAtTurn));
  const { target, maximum } = current.estimatedTurns;
  info += `Current: Chapter ${current.number}: "${current.title}" (${current.status}) - ${elapsed}/${target} turns`;
  if (current.themes.length > 0) info += `\nThemes: ${current.themes.join(", ")}`;
  if (current.majorGoal) info += `\nGoal: ${current.majorGoal}`;
  if (elapsed < 10) info += `\nThis chapter just started - commit_planning_round.chapterUpdate must use action "none" or "update", never "start_new".`;
  else if (elapsed >= maximum) info += `\nOVERDUE: This chapter has EXCEEDED its maximum length (${elapsed}/${maximum}). Set commit_planning_round.chapterUpdate.action to "start_new" THIS TURN or next turn. Find a transition point NOW.`;
  else if (elapsed >= target) info += `\nThis chapter has reached its target length. Actively look for a good moment to set commit_planning_round.chapterUpdate.action to "start_new". If the chapter objectives are mostly met, transition now.`;
  else if (elapsed >= target * 0.7) info += `\nThis chapter is approaching its target length. Start wrapping up - use commit_planning_round.chapterUpdate with action "update" and status "concluding" if the chapter is nearing its climax.`;
  return info;
}

function arcInfo(s: DirectorState, turn: number): string {
  const active = liveArcs(s).filter((a) => a.status !== "complete" && a.status !== "abandoned");
  // The ones that have gone longest without progress come first, so the cap never hides an arc that needs action.
  const shown = [...active].sort((a, b) => (a.lastProgressTurn ?? Infinity) - (b.lastProgressTurn ?? Infinity)).slice(0, PROMPT_LIMITS.arcs);
  const lines = shown.map((arc) => {
    let line = `- [${arc.id}] ${arc.title} (${arc.status}, ${arc.horizon || "medium"} horizon, ${arc.turnsActive} turns): ${clip(arc.description)}`;
    const b = arc.nextBeat;
    // Forward-looking: the planner's own next beat. Missing or delivered, it is told to set a new one.
    if (b?.status === "pending") line += `\n -> NEXT BEAT${typeof b.plannedAtTurn === "number" ? ` [set on turn ${b.plannedAtTurn}]` : ""}${typeof b.targetTurn === "number" ? ` (target: turn ${b.targetTurn})` : ""}: ${clip(b.description)}`;
    else if (b?.status === "delivered") line += `\n -> NEXT BEAT: delivered on turn ${b.deliveredAtTurn ?? "?"} - PLAN A NEW ONE this turn via commit_planning_round.arcUpdates.nextBeat`;
    else if (!b) line += `\n -> NEXT BEAT: NONE SET - you MUST set one this turn via commit_planning_round.arcUpdates.nextBeat. An arc without a forward-looking plan is an arc that drifts.`;
    if (arc.stages.length > 0) {
      const recent = arc.stages.slice(-ARC_STAGES_SHOWN);
      const hidden = arc.stages.length - recent.length;
      line += `\n Stages so far (${arc.stages.length}, backward-looking log):\n${hidden > 0 ? ` · (+${hidden} earlier)\n` : ""}${recent.map((st) => ` · ${st.title}`).join("\n")}`;
    }
    return line;
  }).join("\n") + more(active.length - shown.length, "active arcs") || "None yet";
  const types = new Set(active.map((a) => a.arcType));
  const hints: string[] = [];
  if (active.length < 2 && turn > 5) hints.push(` Only ${active.length} active arc(s) after ${turn} turns - stories feel richer with 3-6 concurrent arcs. Add new narrative threads in commit_planning_round.arcUpdates.`);
  if (active.length === 1 && active[0]!.stages.length > 5) hints.push(` Your single arc has ${active[0]!.stages.length} stages - consider splitting emerging subplots into their own arcs rather than cramming everything into one.`);
  if (!types.has("character") && turn > 8) hints.push("Consider adding a character arc - NPC relationships and personal growth make great arcs.");
  if (!types.has("side") && turn > 10) hints.push("Consider adding a side arc - subplots from player actions or NPC agendas add depth.");
  return lines + (hints.length > 0 ? `\n${hints.join("\n")}` : "");
}

function seedInfo(s: DirectorState): string {
  const pending = liveSeeds(s).filter((x) => !x.payoffDelivered);
  if (pending.length === 0) return "None planted yet - use commit_planning_round.seedUpdates with action 'plant' to start tracking narrative threads";
  const over = (x: (typeof pending)[number]): number => x.turnsActive / (SEED_THRESHOLDS[x.payoffHorizon] ?? 5);
  const shown = [...pending].sort((a, b) => over(b) - over(a)).slice(0, PROMPT_LIMITS.seeds);
  return shown.map((x) => {
    const threshold = SEED_THRESHOLDS[x.payoffHorizon] ?? 5;
    const status = x.turnsActive >= threshold ? ` OVERDUE (${x.turnsActive}/${threshold} turns) - MUST resolve or advance this seed NOW` : `${x.turnsActive}/${threshold} turns`;
    return `- [${x.payoffHorizon}] "${x.hint}" (id: ${x.id}, ${status}, ${x.reinforcements.length} reinforcements): ${x.payoff ? clip(x.payoff) : " MISSING DESCRIPTION - provide 'description' in the seedUpdates entry"}`;
  }).join("\n") + more(pending.length - shown.length, "pending seeds");
}

function shadowInfo(s: DirectorState): string {
  const parts: string[] = [];
  const hidden = liveInvisible(s).filter((a) => a.status !== "resolved" && a.status !== "visible");
  // The person's own come first and are always sent; the rest, the longest-running first.
  const mine = hidden.filter((a) => a.userAuthored);
  const hiddenShown = [...mine, ...hidden.filter((a) => !a.userAuthored).sort((a, b) => b.turnsActive - a.turnsActive)].slice(0, Math.max(PROMPT_LIMITS.hidden, mine.length));
  if (hidden.length > 0) {
    parts.push("Invisible Arcs:\n" + hiddenShown.map((a) => {
      const threshold = SEED_THRESHOLDS[a.horizon] ?? 5;
      const status = a.turnsActive >= threshold ? ` OVERDUE ${a.turnsActive}/${threshold} - MUST advance/surface/resolve NOW` : `${a.turnsActive}/${threshold} turns`;
      let line = `- [${a.id}] "${a.title}" [${a.status}, ${a.arcType}, ${a.horizon}]${a.userAuthored ? " PLAYER-PLANTED" : ""} (${status}): ${a.description ? clip(a.description) : " MISSING DESCRIPTION - provide 'description' in the invisibleArcUpdates entry"}`;
      if (a.userAuthored) line += `\n  NOTE: This arc was planted directly by the player. Weight surfacing toward their stated intent - they're telling you they want this to land.`;
      if (a.surfaceCondition) line += ` | surfaces: ${a.surfaceCondition}`;
      if (a.stages.length > 0) line += `\n Stages: ${a.stages.map((st) => `"${st.title}" (turn ${st.turn})`).join(" -> ")}`;
      if (a.playerClues.length > 0) line += `\n Clues noticed: ${a.playerClues.map((c) => c.clue).join("; ")}`;
      return line;
    }).join("\n") + more(hidden.length - hiddenShown.length, "hidden arcs"));
  }
  const notes = liveNotes(s);
  const notesShown = notes.slice(-PROMPT_LIMITS.notes);
  if (notes.length > 0) parts.push("Notes from the player:\n" + notesShown.map((n) => `- [${n.id}] ${n.content}`).join("\n") + more(notes.length - notesShown.length, "older notes"));
  return parts.length > 0 ? parts.join("\n") : "No shadow world data yet - use invisibleArcUpdates in commit_planning_round to track hidden storylines";
}

export function userPrompt(i: UserPromptInput): string {
  const { state: s, turn } = i;
  const lastProse = [...i.history].reverse().find((m) => m.role === "assistant" && m.content)?.content;
  const audit = selfAuditBlock(s.lastDirective, s.lastDirectiveTurn, turn, lastProse);
  const pacing = `Current mood: ${s.pacing.currentMood} (${s.pacing.turnsAtCurrentMood} turns)
Chapter phase: ${s.pacing.chapterPhase || "development"}
${s.pacing.recommendations.needsQuietMoment ? " Consider slowing down - too much action recently" : ""}
${s.pacing.recommendations.needsTension ? " Consider adding tension - too quiet for too long" : ""}`;
  return `## Turn ${turn}

## Current Story State
${storyState(s)}

${formatMomentumReport(i.report)}
${i.compendium ? `
${i.compendium}
` : ""}${audit ? `\n${audit}\n` : ""}
### Chapters
${chapterInfo(s, turn)}

### User's Action
${i.userMessage}
${instructionsSection(i.instructions)}
### Conversation History (${i.history.length} total turns)
${formatDirectorHistory(i.history)}

### Active Story Arcs (MANDATORY: send a commit_planning_round.arcUpdates entry for every arc that changed this turn)
${arcInfo(s, turn)}

### Pacing Status
${pacing}

### Your Current Intentions
${s.nextIntentions.map((n) => `- [${n.priority}] ${n.description}`).join("\n") || "None set"}

### Pending Seeds (MANDATORY: send commit_planning_round.seedUpdates every turn to reinforce/resolve these)
${seedInfo(s)}

### Shadow World (Your Private Tracking)
${shadowInfo(s)}

---

Remember: The "directive" section is ALL the Narrator will see. Don't spoil your plans!`;
}
