/** Strict workflow decoding, including unique ids, a single reply, and forward-only hand-offs. */
import { z } from "zod";
import { defineExhaustiveShape } from "../_shared/runtime-shape";
import { entityShape } from "../_shared/envelope";
import { presetBodySchema } from "../preset/runtime-schema";
import { skillBodySchema } from "../skill/runtime-schema";
import { BOOK_CARD_KINDS, type BookCard, type BookPhase, type CanonicalPromptbook, type PromptbookBody } from "./schema";
import { cardGroupProblem } from "../../core/promptbook";

const id = z.string().min(1).max(200);
const condition = skillBodySchema.pick({ triggers: true, primaryLogic: true, secondaryTriggers: true, selectiveLogic: true, caseSensitive: true, matchWholeWords: true, scanDepth: true });
const card = z.strictObject(defineExhaustiveShape<BookCard>()({ id, kind: z.enum(BOOK_CARD_KINDS), pieceId: id, enabled: z.boolean(), joinPrevious: z.boolean().optional(), condition: condition.optional() }));
export const bookPhaseSchema = z.strictObject(defineExhaustiveShape<BookPhase>()({
  id, name: z.string().max(200), description: z.string(), role: z.enum(["private", "reply", "after"]), enabled: z.boolean(),
  preset: presetBodySchema, cards: z.array(card), agentId: id.optional(),
  connection: z.strictObject({ id, model: id }).optional(), maxTokens: z.number().int().positive().optional(),
  condition: condition.optional(), reads: z.array(id),
}));
const shape = defineExhaustiveShape<PromptbookBody>()({
  name: z.string().max(200), description: z.string(), phases: z.array(bookPhaseSchema).min(1),
  setups: z.array(z.strictObject({ id, name: z.string().max(200), off: z.array(id) })),
});
export const promptbookBodySchema = z.strictObject(shape).superRefine((book, ctx) => {
  const seen = new Set<string>();
  let replied = false;
  for (const [i, phase] of book.phases.entries()) {
    const issue = (message: string) => ctx.addIssue({ code: "custom", path: ["phases", i], message });
    if (seen.has(phase.id)) issue("Phase ids must be unique.");
    if (new Set(phase.cards.map((c) => c.id)).size !== phase.cards.length) issue("Card ids must be unique within a phase.");
    const groupProblem = cardGroupProblem(phase.cards);
    if (groupProblem) issue(groupProblem);
    if (phase.reads.some((from) => !seen.has(from))) issue("A phase may read only earlier phases.");
    if ((phase.role === "after") !== replied && phase.role !== "reply") issue("Private phases come before the reply; after phases come after it.");
    if (phase.role === "reply") {
      if (replied || !phase.enabled || phase.condition) issue("Keep exactly one enabled, unconditional reply phase.");
      replied = true;
    }
    seen.add(phase.id);
  }
  if (!replied) ctx.addIssue({ code: "custom", path: ["phases"], message: "A Promptbook needs one reply phase." });
  if (new Set(book.setups.map((s) => s.id)).size !== book.setups.length) ctx.addIssue({ code: "custom", path: ["setups"], message: "Setup ids must be unique." });
  for (const setup of book.setups) if (setup.off.some((key) => !seen.has(key) || book.phases.find((p) => p.id === key)?.role === "reply")) ctx.addIssue({ code: "custom", path: ["setups"], message: "Setups may switch off existing private or after phases only." });
});
export const promptbookProfileSchema = z.strictObject(shape).partial();
export const entitySchema = z.strictObject(defineExhaustiveShape<CanonicalPromptbook>()(entityShape("promptbook", promptbookBodySchema, promptbookProfileSchema)));
