/** A story workflow: ordered phases using the existing preset blocks and reusable library pieces. */
import type { CanonicalEntity } from "../../core/canonical";
import type { PresetBody } from "../preset/schema";
import type { SkillCondition } from "../skill/schema";

export type BookCondition = SkillCondition;
export const BOOK_CARD_KINDS = ["scriptsheet", "skill", "tool", "dice", "regex", "tracker"] as const;
export interface BookCard {
  id: string;
  kind: typeof BOOK_CARD_KINDS[number];
  pieceId: string;
  enabled: boolean;
  /** Context cards in the same row compile to one preset message. Placement still belongs to that preset block. */
  joinPrevious?: boolean;
  condition?: BookCondition;
}
export interface BookPhase {
  id: string;
  name: string;
  description: string;
  role: "private" | "reply" | "after";
  enabled: boolean;
  preset: PresetBody;
  cards: BookCard[];
  agentId?: string;
  connection?: { id: string; model: string };
  maxTokens?: number;
  condition?: BookCondition;
  /** The outputs this phase reads. Only earlier phases may be named. */
  reads: string[];
}
export interface PromptbookBody {
  name: string;
  description: string;
  phases: BookPhase[];
  setups: { id: string; name: string; off: string[] }[];
}
export type CanonicalPromptbook = CanonicalEntity<"promptbook", PromptbookBody>;
