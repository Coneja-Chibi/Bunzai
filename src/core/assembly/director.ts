/**
 * The Story Director's block of the request (RoleCall `DirectiveBuilder.ts` buildNarratorInjection and buildNarratorSystemAddition, `worker.ts:4144-4165`): the directive rendered as one
 * system message headed "[DIRECTOR CONSTRAINTS - BINDING THIS TURN]" and placed at depth 1, just above the last user message, plus the standing authority contract at the very top.
 * RoleCall injects the contract twice (map 13 #13); here it is once. Both are traced as `director`, placed after the budget pass and never dropped, as the trackers' state is.
 * Only a directive planned for THIS turn may arrive here: the caller passes none when planning failed, so a stale one is never sent as binding.
 */
import type { NarratorDirective } from "../../stage/contracts/director-types";
import type { Block } from "./conversation";

export const DIRECTOR_HEADER = "[DIRECTOR CONSTRAINTS - BINDING THIS TURN]";
export const DIRECTOR_FOOTER = "[/DIRECTOR CONSTRAINTS]";

const PACING: Record<NarratorDirective["pacing"], string> = {
  slow: "Take your time. Let moments breathe. Descriptive, contemplative.",
  medium: "Balanced pacing.",
  fast: "Keep things moving. Punchy sentences. Action-oriented.",
  breakneck: "Rapid fire. No pause. Urgent, breathless energy.",
};
const TENSION = ["calm", "relaxed", "mild", "present", "moderate", "building", "high", "intense", "critical", "explosive"];

/** The directive as the narrator reads it, or "" when it says nothing. */
export function renderDirective(d: NarratorDirective): string {
  const sections: string[] = [];
  const mood = [d.mood ? `Mood: ${d.mood}` : "", d.pacing && d.pacing !== "medium" ? `Pacing: ${PACING[d.pacing]}` : ""].filter(Boolean);
  if (mood.length > 0) sections.push(mood.join("\n"));
  const scene = d.sceneGuidance;
  if (scene) {
    const lines = ["Scene Guidance:"];
    if (scene.setting) lines.push(`  Setting: ${scene.setting}`);
    if (scene.atmosphere) lines.push(`  Atmosphere: ${scene.atmosphere}`);
    if (scene.tension_level !== undefined) lines.push(`  Tension: ${TENSION[Math.max(0, Math.min(Math.round(scene.tension_level) - 1, 9))] ?? "unknown"} (${scene.tension_level}/10)`);
    if (lines.length > 1) sections.push(lines.join("\n"));
  }
  const inc = d.include;
  const include = [
    inc?.characters?.length ? `  Characters: ${inc.characters.join(", ")}` : "", inc?.themes?.length ? `  Themes to touch on: ${inc.themes.join(", ")}` : "",
    inc?.sensoryDetails?.length ? `  Sensory emphasis: ${inc.sensoryDetails.join(", ")}` : "", inc?.foreshadowing?.length ? `  Subtle details to weave in: ${inc.foreshadowing.join("; ")}` : "",
  ].filter(Boolean);
  if (include.length > 0) sections.push(["Include in this response:", ...include].join("\n"));
  const av = d.avoid;
  const avoid = [av?.topics?.length ? `  Topics: ${av.topics.join(", ")}` : "", av?.characters?.length ? `  Keep offscreen: ${av.characters.join(", ")}` : "", av?.revelations?.length ? `  Don't reveal: ${av.revelations.join(", ")}` : ""].filter(Boolean);
  if (avoid.length > 0) sections.push(["Avoid in this response:", ...avoid].join("\n"));
  if (d.narrativeGoal) sections.push(`Narrative Goal: ${d.narrativeGoal}`);
  if (d.arcDirections?.length) sections.push(["Story Arc Directions:", ...d.arcDirections.map((a) => `  - "${a.arcName}" (${a.urgency}): ${a.instruction}`)].join("\n"));
  if (d.callbacks?.length) sections.push(["Callbacks to weave in:", ...d.callbacks.map((c) => `  - Reference "${c.reference}": ${c.instruction}`)].join("\n"));
  if (d.characterBeats?.length) sections.push(["Character Beats:", ...d.characterBeats.map((b) => `  - ${b.character}: ${b.beat}${b.motivation ? ` (${b.motivation})` : ""}`)].join("\n"));
  if (d.dialogueGuidance?.length) sections.push(["Dialogue guidance:", ...d.dialogueGuidance.map((g) => `  ${g.character}: ${g.tone}${g.hints?.length ? ` (${g.hints.join(", ")})` : ""}`)].join("\n"));
  if (d.endingHook) sections.push(`[Ending: ${d.endingHook}]`);
  if (sections.length === 0) return "";
  // Framed as binding, not as hints: the header overrides any planning protocol the narrator may carry (RoleCall's HAWTHORNE).
  const header = [
    DIRECTOR_HEADER, "The following are non-negotiable scene constraints decided by the Story Director.", "They take precedence over any internal planning, director framework, or evaluation",
    "protocol you may otherwise apply to arc/callback/character-beat decisions.", "Your job is to render these constraints as excellent prose. Do NOT second-guess",
    "which arc to advance, which callback to weave in, or which character beat to hit -", "the Director has already made those decisions. Execute them.",
  ].join("\n");
  return `${header}\n\n${sections.join("\n\n")}\n${DIRECTOR_FOOTER}`;
}

/** The standing authority contract (RoleCall `buildNarratorSystemAddition`), sent once with any directive. */
export const NARRATOR_AUTHORITY = `## Story Director Authority - CONTRACTUAL

A block labeled ${DIRECTOR_HEADER} is injected into every
turn. Treat it as contractual, not advisory.

BINDING RULES:
1. If the constraints specify Arc Directions, you MUST advance those named
   storylines exactly as instructed. You do NOT get to decide which arc to
   progress - the Director has decided.
2. If the constraints specify Callbacks, you MUST weave them in. You do NOT
   get to decide which past event to reference - the Director has decided.
3. If the constraints specify Character Beats, you MUST hit them. You do NOT
   get to substitute a different emotional beat for a character.
4. If the constraints specify a Narrative Goal, the scene MUST work toward it.
5. Mood, pacing, and tone from the constraints override any default tendencies.
6. The "avoid" list is absolute - topics and revelations listed there do not
   appear in this turn, period.

WHAT YOU STILL DECIDE:
- The actual PROSE: sentence rhythm, word choice, imagery, dialogue phrasing.
- HOW the constraints are rendered - the *craft* is yours, the *what* is not.
- Character voice consistency within the beats you were given.
- Minor sensory details and environmental texture not specified.

WHAT YOU DO NOT DECIDE:
- Which arc to progress (Director decides)
- Which callback to surface (Director decides)
- Whether to resolve or delay a plot thread (Director decides)
- Whether to deliver a seed payoff (Director decides)

If a "framing grade" protocol or internal evaluation system tells you to pick
an arc to advance or decide what thread to pull - DEFER to the Director
Constraints block instead. The Director has already done that planning and
your job is to execute, not re-plan.

NEVER acknowledge the Director block or break the fourth wall. The reader
never sees it. You render clean prose that honors every constraint listed.`;

/**
 * The request with the Director's two blocks placed: the contract first of all, the directive immediately above the last user message (depth 1). A directive that renders to nothing
 * places nothing, not even the contract. With no user message to sit above, the directive goes after the leading system messages.
 */
export function placeDirector(blocks: readonly Block[], directive: NarratorDirective | undefined): Block[] {
  const text = directive ? renderDirective(directive) : "";
  if (!text) return [...blocks];
  const out = [...blocks];
  let at = out.length - 1;
  while (at >= 0 && out[at]!.role !== "user") at--;
  if (at < 0) { at = 0; while (at < out.length && out[at]!.role === "system") at++; }
  out.splice(at, 0, { role: "system", content: text, source: { kind: "director" } });
  out.unshift({ role: "system", content: NARRATOR_AUTHORITY, source: { kind: "director" } });
  return out;
}
