/**
 * Which variant of a host surface the verified theme selected. The painter (shell/theme.ts) writes each pick
 * as a root attribute (`data-surface-shell-nav="hud-bar"`); a component calls useSurfaceVariant("shell.nav")
 * and renders that variant, or the current rendering when it gets "core" (no pick, or a variant the host has
 * not built). The root attribute is the one source because every app is bundled on its own and holds its own
 * copy of this module, so module state would never reach an app. One observer per bundle serves every hook, so
 * a component that re-renders on every streamed flush never builds another. Variants differ in markup and
 * style only; data handling stays in the surface's own module.
 */
import { useSyncExternalStore } from "react";
import { CORE_VARIANT, isSurfaceVariant, SURFACES, surfaceAttribute, type SurfaceId } from "../../extensions/surface-registry";

type Pick<S extends SurfaceId> = (typeof SURFACES)[S][number] | typeof CORE_VARIANT;

const listeners = new Set<() => void>();
let watcher: MutationObserver | null = null;

/** Stable identity: React keeps one subscription per hook across renders. */
function subscribe(notify: () => void): () => void {
  if (typeof MutationObserver === "undefined") return () => undefined;
  listeners.add(notify);
  watcher ??= new MutationObserver(() => { for (const listener of listeners) listener(); });
  watcher.observe(document.documentElement, { attributes: true, attributeFilter: (Object.keys(SURFACES) as SurfaceId[]).map(surfaceAttribute) });
  return () => {
    listeners.delete(notify);
    if (listeners.size === 0) { watcher?.disconnect(); watcher = null; }
  };
}

export function surfaceVariant<S extends SurfaceId>(id: S): Pick<S> {
  const value = typeof document === "undefined" ? null : document.documentElement.getAttribute(surfaceAttribute(id));
  return value !== null && isSurfaceVariant(id, value) ? (value as Pick<S>) : CORE_VARIANT;
}

export function useSurfaceVariant<S extends SurfaceId>(id: S): Pick<S> {
  return useSyncExternalStore(subscribe, () => surfaceVariant(id), () => CORE_VARIANT);
}
