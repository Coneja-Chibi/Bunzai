/**
 * Takes as RoleCall lays them out, the pure half: the Branching Tree's nesting (rc app/scenes/branching-tree page.tsx:88-162), a row's
 * title and second line (:114-129), what the take menu lists for the take you are on (BranchIndicator.tsx:431-729), and the pill's
 * sentence (:257-269). A take whose parent is gone stays on the tree under the original; RoleCall drops it.
 */
import { plural } from "../../../core/text";
import type { TakeSummary } from "../../../studio/scenes";

export interface TreeNode { take: TakeSummary; depth: number; children: TreeNode[] }

const oldestFirst = (a: TakeSummary, b: TakeSummary): number => a.createdAt - b.createdAt;

/** The original take with its descendants nested oldest first, or null when the list holds no original. */
export function takeTree(takes: readonly TakeSummary[]): TreeNode | null {
  const original = takes.find((t) => t.parentBranchId === null);
  if (!original) return null;
  const ids = new Set(takes.map((t) => t.id));
  const parentOf = (t: TakeSummary): string => (t.parentBranchId !== null && ids.has(t.parentBranchId) ? t.parentBranchId : original.id);
  const grow = (take: TakeSummary, depth: number): TreeNode => ({
    take, depth, children: takes.filter((t) => t !== original && parentOf(t) === take.id && t.id !== take.id).sort(oldestFirst).map((t) => grow(t, depth + 1)),
  });
  return grow(original, 0);
}

/** A row's title: RoleCall's "Main Timeline", else the take's name. */
export const takeLabel = (take: TakeSummary): string => (take.parentBranchId === null ? "Main Timeline" : take.name);

/** A row's second line: "7 messages", then where a take forked when the store knows. */
export const takeMeta = (take: TakeSummary): string =>
  `${plural(take.messageCount, "message")}${take.forkPosition ? ` · Branched at msg ${take.forkPosition}` : ""}`;

export interface MenuView {
  original: TakeSummary | undefined;
  /** The take you are on forked from this one, when it is not the original. */
  parent: TakeSummary | null;
  /** On the original: its takes. On a take: its siblings, itself among them. */
  alternates: TakeSummary[];
  /** The takes forked from the one you are on. */
  subs: TakeSummary[];
}

export function menuView(takes: readonly TakeSummary[], activeId: string): MenuView {
  const original = takes.find((t) => t.parentBranchId === null);
  const active = takes.find((t) => t.id === activeId);
  const childrenOf = (id: string): TakeSummary[] => takes.filter((t) => t.parentBranchId === id).sort(oldestFirst);
  if (!active || !original || active.id === original.id) return { original, parent: null, alternates: original ? childrenOf(original.id) : [], subs: [] };
  const parent = takes.find((t) => t.id === active.parentBranchId);
  return {
    original,
    parent: parent && parent.id !== original.id ? parent : null,
    alternates: childrenOf(active.parentBranchId ?? original.id),
    subs: childrenOf(active.id),
  };
}

/** The pill's title and label (RoleCall BranchIndicator.tsx:264-269): where you are, then how many takes there are to switch to. */
export function affordance(isOriginal: boolean, others: number, name = ""): string {
  const summary = isOriginal ? "You are on the Director's Cut, the main take" : `You are on ${name}, an alternate take`;
  return others > 0 ? `${summary}. ${plural(others, "other take")} to switch to.` : `${summary}. Branch from any message to make another one.`;
}
