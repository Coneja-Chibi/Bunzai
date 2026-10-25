/**
 * Character knowledgeRefs attach/detach/reorder (pure).
 */
import { moveItem } from "../../../../core/list-ops";

export function attachKnowledgeRef(refs: readonly string[], bookId: string): string[] {
  if (!bookId || refs.includes(bookId)) return [...refs];
  return [...refs, bookId];
}

export function detachKnowledgeRef(refs: readonly string[], bookId: string): string[] {
  return refs.filter((id) => id !== bookId);
}

export function reorderKnowledgeRef(
  refs: readonly string[],
  bookId: string,
  toIndex: number,
): string[] {
  const from = refs.indexOf(bookId);
  if (from < 0) return [...refs];
  return moveItem(refs, from, toIndex);
}

export function missingKnowledgeRefs(
  refs: readonly string[],
  knownIds: ReadonlySet<string>,
): string[] {
  return refs.filter((id) => !knownIds.has(id));
}
