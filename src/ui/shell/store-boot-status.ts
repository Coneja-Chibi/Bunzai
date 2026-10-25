/**
 * The boot-status slice of the shell store (store.ts, CONTRACT V2): whether the studio's piece list
 * has confirmed a restored bench yet (`restoringWorkspace`), its final un-retryable failure if any
 * (`bootListFailed`), and studioCount's own latest-wins guard against use-boot.ts's finishBoot and
 * StatusBar.tsx's studio-changes reload racing on listEntities(). Split out of store.ts, which sits
 * at its 500-line cap, into a zustand slice store.ts composes with a spread - one store, still.
 */
import type { StateCreator } from "zustand";
import { createLatestGuard } from "./store-core";

const studioCountGuard = createLatestGuard();
/** Call BEFORE starting a listEntities() request, then pass the token to setStudioCount. */
export const nextStudioCountRequest = studioCountGuard.next;

export interface BootStatusSlice {
  /** The piece list's final, un-retryable failure (use-boot.ts); shown with priority over statusNote
   * (StatusBar.tsx) so no routine status write can bury it, and cleared only by a fresh boot. */
  bootListFailed: string | null;
  studioCount: number | null; // null = not asked yet; never a guessed 0
  /** True from boot until the piece list confirms a saved bench (or there was none to restore), or
   * fails for good. Read via ctx.workbench.restoring() so a restoring bench is never shown as empty. */
  restoringWorkspace: boolean;
  /** Sticky, never overwritten by setStatus; cleared only by a fresh boot. */
  setBootListFailed(text: string | null): void;
  /** `token`: `nextStudioCountRequest()`, called BEFORE the request it belongs to (latest wins). */
  setStudioCount(n: number, token: number): void;
  setRestoringWorkspace(v: boolean): void;
}

export const createBootStatusSlice: StateCreator<BootStatusSlice> = (set, get) => ({
  bootListFailed: null,
  studioCount: null,
  restoringWorkspace: true,

  setBootListFailed(text) {
    if (get().bootListFailed === text) return;
    set({ bootListFailed: text });
  },

  setStudioCount(n, token) {
    if (!studioCountGuard.isLatest(token)) return; // an older request resolved after a newer one started
    if (get().studioCount === n) return; // idempotent (same loop-killing rule as setStatus)
    set({ studioCount: n });
  },

  setRestoringWorkspace(v) {
    if (get().restoringWorkspace === v) return;
    set({ restoringWorkspace: v });
  },
});
