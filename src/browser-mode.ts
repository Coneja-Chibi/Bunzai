/** Detect the static, memory-only browser Studio and announce committed receipt changes. */
import type { PieceChangeEvent } from "./stage/contracts/piece-change-contract";
export function isBrowserStudio(
  doc: Pick<Document, "querySelector"> | undefined = typeof document === "undefined" ? undefined : document,
): boolean {
  return doc?.querySelector('meta[name="bunzai-runtime"]')?.getAttribute("content") === "browser";
}

export const BROWSER_STUDIO_CHANGE_EVENT = "bunzai:studio-change";
export const BROWSER_THEME_REVISION_EVENT = "bunzai:theme-revision";

/** Notify the shell to reload the effective appearance after a committed lifecycle change. */
export function announceBrowserThemeRevision(revision: number): void {
  if (!Number.isSafeInteger(revision) || revision < 0 || !isBrowserStudio() || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BROWSER_THEME_REVISION_EVENT, { detail: { revision } }));
}

export function announceBrowserStudioChange(changes: readonly PieceChangeEvent[]): void {
  if (!isBrowserStudio() || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BROWSER_STUDIO_CHANGE_EVENT, { detail: { changes } }));
}

/** A journal gap requests one fenced summary resync, not synthesized change identities. */
export function announceBrowserStudioResync(sequence: number): void {
  if (!isBrowserStudio() || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BROWSER_STUDIO_CHANGE_EVENT, { detail: { resync: sequence } }));
}
