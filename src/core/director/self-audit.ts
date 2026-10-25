/**
 * The self-audit block of the planner's user prompt (RoleCall `DMStreamService.buildSelfAuditBlock`): the Director's own last directive beside the narrator's actual prose for that turn,
 * cut to 2,400 characters, so it can see what landed and what was ignored. It is input to the planner and nothing else: the last directive is never sent to the narrator again.
 */
import type { NarratorDirective } from "../../stage/contracts/director-types";

export const AUDIT_PROSE_MAX = 2_400;

export function selfAuditBlock(last: NarratorDirective | undefined, lastTurn: number | undefined, turn: number, lastProse: string | undefined): string {
  if (!last || !lastProse) return "";
  const ago = lastTurn !== undefined ? Math.max(0, turn - lastTurn) : null;
  const when = ago === 1 ? "last turn" : ago !== null ? `${ago} turns ago` : "previously";
  const lines: string[] = [];
  if (last.mood || last.pacing) lines.push(`Mood/Pacing: ${last.mood || "-"} / ${last.pacing || "-"}`);
  if (last.narrativeGoal) lines.push(`Goal: ${last.narrativeGoal}`);
  if (last.arcDirections?.length) lines.push("Arc Directions:", ...last.arcDirections.map((a) => `  - [${a.urgency}] "${a.arcName}": ${a.instruction}`));
  if (last.callbacks?.length) lines.push("Callbacks:", ...last.callbacks.map((c) => `  - "${c.reference}": ${c.instruction}`));
  if (last.characterBeats?.length) lines.push("Character Beats:", ...last.characterBeats.map((b) => `  - ${b.character}: ${b.beat}`));
  if (last.endingHook) lines.push(`Ending Hook: ${last.endingHook}`);
  if (lines.length === 0) return "";
  // The middle of a long reply is where the prose lives, but its head and tail say most.
  const prose = lastProse.length > AUDIT_PROSE_MAX
    ? `${lastProse.slice(0, AUDIT_PROSE_MAX / 2)}\n\n[... ${lastProse.length - AUDIT_PROSE_MAX} chars truncated ...]\n\n${lastProse.slice(-AUDIT_PROSE_MAX / 2)}`
    : lastProse;
  return `### [SELF-AUDIT] Your Directive From ${when} -> What The Narrator Actually Wrote
This is the directive YOU authored ${when}. Below it is the narrator's actual prose for that turn. Compare them BEFORE you write this turn's directive.

YOUR DIRECTIVE WAS:
${lines.join("\n")}

NARRATOR'S ACTUAL PROSE:
${prose}

AUDIT QUESTIONS (answer in your own head, do not output):
1. Which arcDirections / callbacks / characterBeats did the narrator HONOR? (Look for specific beats landing in the prose.)
2. Which were IGNORED or watered down? (Look for absence - beats you asked for that didn't show up.)
3. Did the narrator deliver something good you DIDN'T ask for? (The narrator has its own taste - work with it.)
4. Are there beats you keep asking for that keep getting ignored? (If so, change tactics - different angle, more force, or move on.)

Use this audit to shape THIS TURN's directive. If a beat was missed last turn and still matters, escalate it (more specific, more forceful, or via a different angle). If a beat was honored, move on - don't repeat it. Learn the narrator's actual behavior.`;
}
