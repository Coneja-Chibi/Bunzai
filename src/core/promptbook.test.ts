/** Workflow contracts: native fidelity, safe ordering, one reply, and the shared conditional matcher. */
import { expect, test } from "bun:test";
import { CANONICAL_SCHEMA_VERSION } from "./canonical";
import { parseCanonicalEntity } from "../entities/runtime-schema";
import { promptbookBodySchema } from "../entities/promptbook/runtime-schema";
import { bookRecipe, emptyPromptbookBody, newBookPhase, phaseVerdict } from "./promptbook";
import { emptySkillBody } from "../entities/skill/schema";
import type { LoreScan } from "./lore/engine";
import { linkedRefs, withLinksRenamed } from "./links";

test("a native Promptbook preserves its phases and preset blocks through canonical decoding", () => {
  const body = bookRecipe("Casebook", "think");
  const entity = { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "promptbook" as const, id: "casebook", body };
  expect(parseCanonicalEntity(JSON.parse(JSON.stringify(entity)))).toEqual(entity);
  expect(body.phases[1]!.reads).toEqual(["think"]);
});
test("a workflow rejects missing or duplicate replies, duplicate ids, backward phase roles and future hand-offs", () => {
  const book = bookRecipe("Casebook", "think");
  for (const phases of [[], [book.phases[0]!], [...book.phases, book.phases[1]!], [book.phases[1]!, book.phases[0]!], [{ ...book.phases[0]!, reads: ["write"] }, book.phases[1]!]]) {
    expect(promptbookBodySchema.safeParse({ ...book, phases }).success).toBe(false);
  }
  expect(promptbookBodySchema.safeParse({ ...book, phases: [...book.phases, newBookPhase("tidy", "Tidy up", "after")] }).success).toBe(true);
  expect(promptbookBodySchema.safeParse({ ...book, arbitrary: "code" }).success).toBe(false);
});
test("rehearsal uses the lore matcher and respects phase switches", () => {
  const phase = emptyPromptbookBody("Fight").phases[0]!;
  const { triggers, secondaryTriggers, selectiveLogic, caseSensitive, matchWholeWords, scanDepth } = emptySkillBody("Fight");
  phase.condition = { triggers, secondaryTriggers, selectiveLogic, caseSensitive, matchWholeWords, scanDepth };
  phase.condition.triggers = [{ keyword: "sword", isRegex: false }];
  const scan = (content: string): LoreScan => ({ messages: [{ role: "user", content }], messageCount: 1, character: { name: "", tags: [], description: "", personality: "", scenario: "" }, persona: "", generationType: "normal", variables: {}, now: 0 });
  expect(phaseVerdict(phase, scan("I draw a sword")).on).toBe(true);
  expect(phaseVerdict(phase, scan("a swordfish")).on).toBe(false);
  expect(phaseVerdict({ ...phase, enabled: false }, scan("sword")).why).toBe("Switched off.");
});
test("shared link resolution and keep-both import renaming reach nested phase cards and Agents", () => {
  const book = emptyPromptbookBody("Casebook");
  book.phases[0]!.cards.push({ id: "voice-card", kind: "scriptsheet", pieceId: "voice", enabled: true });
  book.phases[0]!.agentId = "narrator";
  expect(linkedRefs("promptbook", book).map(({ kind, id }) => ({ kind, id }))).toEqual([{ kind: "scriptsheet", id: "voice" }, { kind: "agent", id: "narrator" }]);
  const renamed = withLinksRenamed("promptbook", book, new Map([["scriptsheet:voice", "voice-2"], ["agent:narrator", "narrator-2"]]));
  expect(renamed.phases[0]!.cards[0]!.pieceId).toBe("voice-2");
  expect(renamed.phases[0]!.agentId).toBe("narrator-2");
  expect(book.phases[0]!.cards[0]!.pieceId).toBe("voice");
  expect(linkedRefs("promptbook", { phases: [null, { cards: [null] }] })).toEqual([]);
});
