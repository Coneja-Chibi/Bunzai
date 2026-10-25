/**
 * Shared runLore wiring for the Workbench's lore tools (2e): wrap a
 * canonical LorebookBody as the engine's LoreBookInput, build a minimal LoreScan from a chat window,
 * and count tokens with the same counter a scene's turn uses (countText), so a budget preset here cuts
 * exactly what chat would cut.
 */
import type { LorebookBody } from "../../../../entities/lorebook/schema";
import type { LoreBookInput, LoreScan, LoreScanMessage } from "../../../../core/lore";
import { countText } from "../../../../core/tokens";

export const LORE_BOOK_ID = "book";

export function toBookInput(body: LorebookBody): LoreBookInput {
  return { id: LORE_BOOK_ID, name: body.name, body };
}

/** Neutralizes a book's own tokenBudget/budgetMode so only the caller's own budgetTokens cap
 * applies (the engine's per-book stage would otherwise always cut against the book's own numbers,
 * even when the caller asked for no budget or a fixed preset). */
export function withoutOwnBudget(body: LorebookBody): LorebookBody {
  return { ...body, tokenBudget: 0, budgetMode: "token" };
}

/** activation.ts never modeled character filters (every entry got a fair look regardless of who
 * was speaking); the engine enforces them for real. The Workbench's preview tools have no current
 * character to check against, so a whitelisted entry would otherwise always read "character-filter"
 * here - strictly worse than the old blind spot. Strip filters instead, matching activation.ts's
 * behavior until a real character is threaded into these tools. */
export function withoutCharacterFilters(body: LorebookBody): LorebookBody {
  return {
    ...body,
    entries: body.entries.map((e) => (e.characterFilter ? { ...e, characterFilter: null } : e)),
  };
}

/** The turn's own counter: the Workbench and chat must agree on what a budget cuts. */
export const loreTokens = countText;

export function toScan(messages: LoreScanMessage[]): LoreScan {
  return {
    messages,
    messageCount: messages.length,
    character: { name: "", tags: [], description: "", personality: "", scenario: "" },
    persona: "",
    generationType: "normal",
    variables: {},
    now: Date.now(),
  };
}
