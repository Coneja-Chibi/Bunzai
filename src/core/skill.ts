/**
 * When a linked skill is on (.claude/plans/skill-agent-kinds.md section 2.2): always; when the chat mentions it, matched by the
 * lore engine's own trigger matcher over the newest `scanDepth` messages (newest first, as a lore entry's scan text is), its
 * primary triggers any-of and its secondary ones by its logic; or while the model has it open, which closes it when its
 * triggers stop matching if it asks to.
 */
import { matchTrigger, recentScanParts, selectiveLogicMatches, type LoreScan } from "./lore/engine";
import type { SkillBody } from "../entities/skill/schema";

export interface SkillVerdict {
  on: boolean;
  /** One plain sentence: why it is on or off this turn, for the scene and the Try rail. */
  why: string;
  /** An open picked skill whose triggers stopped matching: it closes. */
  close?: true;
}

/** The keywords that matched, or null when the skill's triggers do not match the scan (or it has none). */
export function skillMentioned(body: SkillBody, scan: LoreScan, rng: () => number): string[] | null {
  if (body.triggers.length === 0 || body.scanDepth <= 0) return null;
  const text = recentScanParts(scan.messages, body.scanDepth).join("\n");
  const lower = text.toLowerCase();
  const options = { caseSensitive: body.caseSensitive, matchWholeWords: body.matchWholeWords };
  const primary = body.triggers.filter((t) => matchTrigger(t, text, options, scan, rng, lower));
  if (primary.length === 0) return null;
  const secondary = body.secondaryTriggers.filter((t) => matchTrigger(t, text, options, scan, rng, lower));
  if (body.secondaryTriggers.length > 0 && !selectiveLogicMatches(primary.length, secondary.length, body.secondaryTriggers.length, body.selectiveLogic)) return null;
  return [...primary, ...secondary].map((t) => t.keyword);
}

/** Whether the skill is in the prompt this turn, and why. `open` is whether the model has it open (scene state). */
export function skillVerdict(body: SkillBody, scan: LoreScan, rng: () => number, open: boolean): SkillVerdict {
  switch (body.when) {
    case "always":
      return { on: true, why: "Always on." };
    case "mentioned": {
      const hit = skillMentioned(body, scan, rng);
      return hit ? { on: true, why: `Mentioned: ${hit.join(", ")}.` } : { on: false, why: "Not mentioned." };
    }
    case "picked":
      if (!open) return { on: false, why: "Not opened." };
      // with no triggers, or nothing scanned, there is nothing to stop mentioning, so it stays open
      if (body.closeWhenUnmentioned && body.triggers.length > 0 && body.scanDepth > 0 && !skillMentioned(body, scan, rng)) return { on: false, why: "Closed: no longer mentioned.", close: true };
      return { on: true, why: "Opened by the model." };
  }
}
