/** Pure Promptbook recipes, forward hand-offs and rehearsal, using the skill matcher and preset block model. */
import type { BookCard, BookPhase, PromptbookBody } from "../entities/promptbook/schema";
import { emptySkillBody } from "../entities/skill/schema";
import { skillMentioned } from "./skill";
import { sheetAsPreset } from "./preset/script-sheet";
import type { LoreScan } from "./lore/engine";

export function newBookPhase(id: string, name: string, role: BookPhase["role"]): BookPhase {
  return { id, name, role, description: "", enabled: true, reads: [], cards: [], preset: sheetAsPreset({ name, content: "Write the next part of the scene." }) };
}
export function emptyPromptbookBody(name: string): PromptbookBody {
  return { name, description: "", phases: [newBookPhase("write", "Write", "reply")], setups: [] };
}
export function bookRecipe(name: string, recipe: "blank" | "think"): PromptbookBody {
  const book = emptyPromptbookBody(name);
  if (recipe === "blank") return book;
  const think = newBookPhase("think", "Think", "private");
  think.preset.prompts[0]!.content = "Plan the next beat briefly. Note what changed, what the player wants, and what should happen next. Return notes for the writer.";
  book.phases.unshift(think);
  book.phases[1]!.reads = [think.id];
  return book;
}
export function phaseVerdict(phase: BookPhase, scan: LoreScan, rng: () => number = () => 0): { on: boolean; why: string } {
  if (!phase.enabled) return { on: false, why: "Switched off." };
  if (!phase.condition) return { on: true, why: "Always runs." };
  const hit = skillMentioned({ ...emptySkillBody(phase.name), ...phase.condition }, scan, rng);
  return hit ? { on: true, why: `Mentioned: ${hit.join(", ")}.` } : { on: false, why: "Conditions did not match." };
}
export const replyPhase = (book: PromptbookBody): BookPhase => book.phases.find((p) => p.role === "reply")!;
export const canGroupCard = (cards: readonly BookCard[], at: number): boolean => at > 0 && [cards[at], cards[at - 1]].every((c) => c?.kind === "scriptsheet" || c?.kind === "skill");
export const cardGroupProblem = (cards: readonly BookCard[]): string | null => cards.some((c, at) => c.joinPrevious && !canGroupCard(cards, at)) ? "Together groups need adjacent Prompt or Skill cards." : null;
export function withoutBookCard(cards: readonly BookCard[], id: string): BookCard[] {
  const next = cards.filter((c) => c.id !== id);
  return next.map((c, at) => c.joinPrevious && !canGroupCard(next, at) ? { ...c, joinPrevious: false } : c);
}
