/**
 * The lorebook and regex-set tools in the card's own menu (right-click, or its "..." button).
 *
 * WHY. A card small enough to be a tile has no room for Split and Copy buttons; they fold away there
 * (rc-styles.ts), and this is where they stay reachable, at every size. Copy is the shell's own
 * Duplicate (delete-flow.tsx) already; this adds what only a set has: switching it on or off, and
 * splitting it. The actions are the shelves' own (lore-shelf-ops.ts, regex-shelf-ops.ts), so the
 * menu and the card's buttons can never disagree.
 */
import { useEffect, useRef } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import type { DeckViewContext } from "./view-contract";

type SetShelf = NonNullable<DeckViewContext["loreShelf"]> | NonNullable<DeckViewContext["regexShelf"]>;

/** The menu items a set's card adds; none for any other kind (deny by absence). */
export function setMenuItems(
  e: StudioEntitySummary,
  shelves: { lore?: SetShelf; regex?: SetShelf },
): { label: string; onPick(): void }[] {
  const shelf = e.kind === "lorebook" ? shelves.lore : e.kind === "regex" ? shelves.regex : undefined;
  if (!shelf) return [];
  const on = shelf.enabledOf(e);
  return [
    { label: on ? "Switch off (skip on export)" : "Switch on", onPick: () => shelf.onToggleEnabled(e, !on) },
    { label: "Split into two", onPick: () => shelf.onSplit(e) },
  ];
}

/** Register the set tools on the entity menu for as long as the room is up. */
export function useSetMenu(ctx: AppContext, lore: SetShelf, regex: SetShelf, designCover?: (e: StudioEntitySummary) => void): void {
  // Held, not depended on: the shelves are rebuilt every render, the registration is once per ctx.
  const latest = useRef({ lore, regex, designCover });
  latest.current = { lore, regex, designCover };
  useEffect(
    () => ctx.menus.register("entity", (t) => {
      const e = t.data as StudioEntitySummary;
      const items = setMenuItems(e, latest.current);
      if (e.kind === "lorebook" && latest.current.designCover) items.push({ label: "Design book cover", onPick: () => latest.current.designCover?.(e) });
      return items;
    }),
    [ctx],
  );
}
