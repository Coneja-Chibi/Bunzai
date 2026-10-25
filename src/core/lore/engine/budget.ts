/**
 * Priority/sortOrder eviction and two-stage budgeting (Bunraku change 3, - do NOT
 * copy RoleCall's selection/priority.ts here). Within a position, entries place in `sortOrder`
 * order. When the budget is short, entries are cut by `priority`, lowest first; ties break by
 * `sortOrder`, last first. Survivors are re-sorted back into `sortOrder`. `ignoreBudget` entries
 * are never cut (and still count toward the running spend, so accounting stays coherent). The
 * eviction/placement split matches src/core/lore/activation.ts's evictionOrder/placementOrder,
 * reused here rather than reinvented (coordinator decision, 2026-09-28).
 *
 * Two stages, per the coordinator's decision: each book's own tokenBudget/budgetMode/entryBudget
 * runs first (RoleCall's production path always uses per-book budgets), then the caller's single
 * `budgetTokens` runs as a global cut across every book's survivors, both using the same rule.
 */
import type { LoreBookInput } from "./types";
import type { EntryRef } from "./types";

export interface BudgetItem {
  ref: EntryRef;
  tokens: number;
}

function placementOrder<T extends BudgetItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.ref.entry.sortOrder !== b.ref.entry.sortOrder) return a.ref.entry.sortOrder - b.ref.entry.sortOrder;
    return b.ref.entry.priority - a.ref.entry.priority;
  });
}

function evictionOrder<T extends BudgetItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.ref.entry.priority !== b.ref.entry.priority) return b.ref.entry.priority - a.ref.entry.priority;
    return a.ref.entry.sortOrder - b.ref.entry.sortOrder;
  });
}

export interface BudgetResult<T> {
  kept: T[];
  cut: T[];
  spent: number;
}

/** limit === null means unlimited (everything survives, in placement order). */
export function evictByTokenBudget<T extends BudgetItem>(items: readonly T[], limit: number | null): BudgetResult<T> {
  if (limit === null || !Number.isFinite(limit)) {
    return { kept: placementOrder(items), cut: [], spent: items.reduce((s, i) => s + i.tokens, 0) };
  }

  const kept: T[] = [];
  const cut: T[] = [];
  let spent = 0;
  for (const item of evictionOrder(items)) {
    if (item.ref.entry.ignoreBudget || spent + item.tokens <= limit) {
      kept.push(item);
      spent += item.tokens;
    } else {
      cut.push(item);
    }
  }
  return { kept: placementOrder(kept), cut: placementOrder(cut), spent };
}

/** Entry-count budget mode: same priority/sortOrder rule, counting entries instead of tokens.
 * ignoreBudget entries still don't count against the cap, matching the token-mode rule. */
export function evictByEntryCount<T extends BudgetItem>(items: readonly T[], maxEntries: number): BudgetResult<T> {
  const kept: T[] = [];
  const cut: T[] = [];
  let count = 0;
  let spent = 0;
  for (const item of evictionOrder(items)) {
    if (item.ref.entry.ignoreBudget || count < maxEntries) {
      kept.push(item);
      if (!item.ref.entry.ignoreBudget) count++;
      spent += item.tokens;
    } else {
      cut.push(item);
    }
  }
  return { kept: placementOrder(kept), cut: placementOrder(cut), spent };
}

/** Stage 1: each book's own tokenBudget/budgetMode/entryBudget, independent of its neighbors
 * (an unlimited book never eats another book's cap). `tokenBudget <= 0` means unlimited. */
export function evictPerBook<T extends BudgetItem>(items: readonly T[]): BudgetResult<T> {
  const byBook = new Map<string, T[]>();
  for (const item of items) {
    const list = byBook.get(item.ref.book.id) ?? [];
    list.push(item);
    byBook.set(item.ref.book.id, list);
  }

  const kept: T[] = [];
  const cut: T[] = [];
  let spent = 0;
  for (const [, bookItems] of byBook) {
    const book: LoreBookInput = (bookItems[0] as T).ref.book;
    const result =
      book.body.budgetMode === "entry"
        ? evictByEntryCount(bookItems, book.body.entryBudget)
        : evictByTokenBudget(bookItems, book.body.tokenBudget > 0 ? book.body.tokenBudget : null);
    kept.push(...result.kept);
    cut.push(...result.cut);
    spent += result.spent;
  }
  return { kept: placementOrder(kept), cut: placementOrder(cut), spent };
}
