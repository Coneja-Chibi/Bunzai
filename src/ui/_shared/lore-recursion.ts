/**
 * The lore entry editor's recursion control: one mode over three canonical fields
 * (preventRecursion, delayUntilRecursion, excludeRecursion), the same fold every authored lore
 * editor uses (2e-d7 plan step 4; formerly duplicated in scenes/lore-core.ts and
 * workbench/lore/entry-when-where.tsx). Pure.
 */
import type { LorebookEntry } from "../../entities/lorebook/schema";

export type RecursionMode = "normal" | "prevent" | "delay";

export function recursionModeOf(entry: Pick<LorebookEntry, "preventRecursion" | "delayUntilRecursion">): RecursionMode {
  if (entry.preventRecursion) return "prevent";
  if (entry.delayUntilRecursion > 0) return "delay";
  return "normal";
}

/** `excludeRecursion` is a fourth, independent field this control never sets - only "normal" clears it. */
export function recursionPatch(mode: RecursionMode, currentDelay: number): Partial<LorebookEntry> {
  if (mode === "prevent") return { preventRecursion: true, delayUntilRecursion: 0 };
  if (mode === "delay") return { preventRecursion: false, delayUntilRecursion: currentDelay > 0 ? currentDelay : 1 };
  return { preventRecursion: false, delayUntilRecursion: 0, excludeRecursion: false };
}
