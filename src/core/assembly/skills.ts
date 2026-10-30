/**
 * The skills' block of the request (.claude/plans/skill-agent-kinds.md section 2.4): every linked skill that is on this turn
 * (core/skill.ts decides), its text rendered by the turn's macros, as one system message headed "### Skills". It goes where the
 * preset's `skills` marker stands, else after the leading system messages as the trackers' block does, and the budget reserves
 * it like the trackers' block: history gives way to it, it is never dropped (Chi, 2026-10-29).
 */
import type { LoreScan } from "../lore/engine";
import { skillVerdict, type SkillVerdict } from "../skill";
import type { SkillBody } from "../../entities/skill/schema";

export const SKILLS_HEADER = "### Skills";

/** One linked skill for a turn: its body, and whether the model has it open (scene state). */
export interface AssemblySkill {
  id: string;
  body: SkillBody;
  open: boolean;
  /** The preset's named slots for this skill; absent means its normal shared Skills block. */
  slots?: readonly string[];
}

export type SkillRun = SkillVerdict & { id: string; name: string };

/** Each linked skill's verdict this turn, in the scene's order. */
export const skillRuns = (skills: readonly AssemblySkill[], scan: LoreScan, rng: () => number): SkillRun[] =>
  skills.map((s) => ({ id: s.id, name: s.body.name, ...skillVerdict(s.body, scan, rng, s.open) }));

/** The block's text: each skill that is on, under its name, its text rendered by `render`; "" when none is on or all are blank. */
export function skillsText(skills: readonly AssemblySkill[], runs: readonly SkillRun[], render: (text: string) => string): string {
  const parts = skills.flatMap((s, i) => {
    if (!runs[i]?.on) return [];
    const text = render(s.body.text).trim();
    return text ? [`## ${s.body.name}\n${text}`] : [];
  });
  return parts.length === 0 ? "" : [SKILLS_HEADER, "", parts.join("\n\n")].join("\n");
}
