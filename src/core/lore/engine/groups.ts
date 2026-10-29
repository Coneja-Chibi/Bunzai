/**
 * Inclusion groups: when several triggered entries share a `groupName`, only one injects, picked
 * by weighted random draw (`groupWeight`). Ported from RoleCall's selection/groups.ts: the system's ambient random source is replaced by the injected rng (Bunzai change
 * 2). Groups are compared by
 * the literal `groupName` string across every book, same as RoleCall - not scoped per book.
 */
import { groupBy } from "../../list-ops";
import { entryKey, type EntryRef } from "./types";

export interface GroupCandidate {
  ref: EntryRef;
}

export function groupByGroupName<T extends GroupCandidate>(candidates: readonly T[]): Map<string, T[]> {
  return groupBy(
    candidates.filter((c) => c.ref.entry.groupName),
    (c) => c.ref.entry.groupName as string,
  );
}

/** One winning entryKey per group name. */
export function resolveInclusionGroups<T extends GroupCandidate>(
  groups: Map<string, T[]>,
  rng: () => number,
): Map<string, string> {
  const winners = new Map<string, string>();

  groups.forEach((members, groupName) => {
    if (members.length === 0) return;
    if (members.length === 1) {
      winners.set(groupName, memberKey(members[0] as T));
      return;
    }

    const totalWeight = members.reduce((sum, m) => sum + m.ref.entry.groupWeight, 0);
    if (totalWeight <= 0) {
      winners.set(groupName, memberKey(members[0] as T));
      return;
    }

    let roll = rng() * totalWeight;
    for (const m of members) {
      roll -= m.ref.entry.groupWeight;
      if (roll <= 0) {
        winners.set(groupName, memberKey(m));
        return;
      }
    }
    winners.set(groupName, memberKey(members[0] as T));
  });

  return winners;
}

function memberKey(m: GroupCandidate): string {
  return entryKey(m.ref.book.id, m.ref.entry.id);
}

/** Entries with no group always pass; grouped entries pass only as their group's winner. */
export function filterByGroupWinners<T extends GroupCandidate>(
  candidates: readonly T[],
  winners: Map<string, string>,
): T[] {
  return candidates.filter((c) => {
    const name = c.ref.entry.groupName;
    if (!name) return true;
    return winners.get(name) === entryKey(c.ref.book.id, c.ref.entry.id);
  });
}
