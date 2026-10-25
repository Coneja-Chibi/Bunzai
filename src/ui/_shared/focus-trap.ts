/**
 * The one focus-trap core: which elements inside a sheet a Tab press may land on, and how modal
 * shells keep that press within the top sheet. Earlier copies had already drifted: tokens-sheet's
 * filter only skipped `[hidden]`, so an `inert` or
 * `aria-hidden="true"` ancestor, a closed `<details>`, or a `display:none`/`visibility:hidden`
 * ancestor could still steal a Tab cycle there while bottom-sheet correctly excluded all four
 * (dup-audit/ui.md item 3, bug B15).
 */
import { useEffect, type RefObject } from "react";
import { isTopDialog } from "./use-escape-key";

interface DialogFocusState {
  dialogs: Set<HTMLElement>;
  owned: Set<HTMLElement>;
  origins: Map<HTMLElement, HTMLElement | null>;
  opener: HTMLElement | null;
}

const focusStates = new WeakMap<Document, DialogFocusState>();

/** Everything a Tab press may land on, in document order. The union of every prior copy's list:
 * bottom-sheet's `summary` (for a closed `<details>`'s own disclosure control) and expand's
 * `:not([type="hidden"])` on `input` (a hidden-type input is never a real Tab stop). */
export const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "summary",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Whether a focusable element is actually reachable: not inside a `[hidden]`/`inert`/
 * `aria-hidden="true"` ancestor, not inside a closed `<details>` (unless it IS that details'
 * own `<summary>`), and not under a `display:none`/`visibility:hidden` ancestor within the trap
 * root. `root` bounds the ancestor walk so a trap never reads layout outside the sheet it owns.
 */
export function visibleIn(element: HTMLElement, root: HTMLElement): boolean {
  if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  const closedDetails = element.closest("details:not([open])");
  if (closedDetails && !closedDetails.querySelector(":scope > summary")?.contains(element)) return false;
  const view = element.ownerDocument.defaultView;
  for (let node: HTMLElement | null = element; node && root.contains(node); node = node.parentElement) {
    const style = view?.getComputedStyle(node);
    if (style && (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse")) return false;
  }
  return true;
}

/** Every real Tab stop inside `root`, in document order, with `visibleIn`'s filter applied. */
export function focusablesIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => visibleIn(element, root));
}

/**
 * A full modal focus trap for a sheet that owns the keyboard while it is open: focuses itself on
 * mount, cycles Tab/Shift+Tab across `focusablesIn(sheet)`, and returns focus to
 * whatever had it before on unmount - the shape bottom-sheet and tokens-sheet each hand-rolled
 * (dup-audit/ui.md item 3). Tab alone uses capture phase; Escape is owned by DialogCore at document
 * bubble, after editor-local handlers have had a chance to preserve their own Escape behavior.
 *
 * ExpandBox keeps its caret-carrying textarea swap in its own effect; its modal wrapper uses this
 * same trap through DialogCore, so the shared shell never needs to know about editor state.
 */
export function useFocusTrap(sheetRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const doc = sheet.ownerDocument;
    const previous = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
    let state = focusStates.get(doc);
    if (!state) {
      state = {
        dialogs: new Set(),
        owned: new Set(),
        origins: new Map(),
        opener: previous,
      };
      focusStates.set(doc, state);
    }
    state.dialogs.add(sheet);
    state.owned.add(sheet);
    state.origins.set(sheet, previous);
    if (isTopDialog(sheet)) sheet.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Tab" || !sheet || !isTopDialog(sheet)) return;
      const focusable = focusablesIn(sheet);
      const first = focusable[0];
      const last = focusable.at(-1);
      const active = doc.activeElement;
      // The sheet container itself (tabIndex=-1, focused above and whenever focus escapes it) is a
      // valid Tab position too, not just the elements inside it - treated as "before the first" for
      // a forward Tab and "after the last" for Shift+Tab, same as bottom-sheet's own algorithm.
      if (!first || !last) {
        event.preventDefault();
        sheet.focus();
      } else if (event.shiftKey && (active === first || active === sheet)) {
        event.preventDefault();
        last.focus();
      } else if (event.shiftKey && !sheet.contains(active)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || active === sheet || !sheet.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    doc.addEventListener("keydown", onKeyDown, true);
    return () => {
      doc.removeEventListener("keydown", onKeyDown, true);
      state?.dialogs.delete(sheet);
      const origin = state?.origins.get(sheet) ?? null;
      state?.origins.delete(sheet);
      const remainingTop = [...(state?.dialogs ?? [])].find((dialog) => dialog.isConnected && isTopDialog(dialog));
      const retiredDialog = Boolean(origin && state?.owned.has(origin) && !state.dialogs.has(origin));
      const restore = origin?.isConnected && !retiredDialog && (!remainingTop || remainingTop.contains(origin))
        ? origin
        : remainingTop ?? (state?.dialogs.size === 0 ? state.opener : null);
      if (state?.dialogs.size === 0) focusStates.delete(doc);
      if (!restore?.isConnected) return;
      restore.focus();
      queueMicrotask(() => {
        if (restore.isConnected) restore.focus();
      });
    };
    // sheetRef is stable; the callback is not retained by this effect, so it never re-attaches
    // merely because a parent renders again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
