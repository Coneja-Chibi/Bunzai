/**
 * Canonical skill piece: instructions the model gets only when they matter, such as how to run a sword fight
 * (.claude/plans/skill-agent-kinds.md section 2). It turns on always, when the chat mentions it (the lorebook entry's own
 * trigger fields, matched by the lore engine: core/skill.ts), or when the model opens it with open_skill.
 */
import type { CanonicalEntity } from "../../core/canonical";
import { DEFAULT_SCAN_DEPTH, type SelectiveLogic, type Trigger } from "../lorebook/schema";

/** When a linked skill is in the prompt: every turn, when its triggers match, or once the model opens it. */
export type SkillWhen = "always" | "mentioned" | "picked";

export interface SkillBody {
  /** What the person and the model call it; the block heads its text with it. */
  name: string;
  /** One line: what it is for. The model reads it when it may pick the skill, and the Library and the scene show it. */
  description: string;
  /** The instructions; macros render as in any prompt text. */
  text: string;
  /** "always": every turn while linked; "mentioned": when its triggers match; "picked": while the model has it open. */
  when: SkillWhen;
  /** "mentioned": a lorebook entry's primary triggers, matched as a lore entry's are (any one of them). */
  triggers: Trigger[];
  /** With the primary ones, combined by `selectiveLogic`, as a lore entry's secondary triggers. */
  secondaryTriggers: Trigger[];
  /** How the secondary triggers combine with the primary ones (the lorebook's and_any, and_all, not_any, not_all). */
  selectiveLogic: SelectiveLogic;
  /** The triggers match case as written. */
  caseSensitive: boolean;
  /** A plain trigger matches only as a whole word. */
  matchWholeWords: boolean;
  /** How many of the newest messages the triggers read, the one being answered included. */
  scanDepth: number;
  /** "picked": it also closes on a turn its triggers no longer match. */
  closeWhenUnmentioned: boolean;
}

export type CanonicalSkill = CanonicalEntity<"skill", SkillBody>;

export const emptySkillBody = (name: string): SkillBody => ({
  name, description: "", text: "", when: "mentioned",
  triggers: [], secondaryTriggers: [], selectiveLogic: "and_any", caseSensitive: false, matchWholeWords: true,
  scanDepth: DEFAULT_SCAN_DEPTH, closeWhenUnmentioned: false,
});
