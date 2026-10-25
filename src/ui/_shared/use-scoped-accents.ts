/**
 * The scoped accent properties for a container, from the piece colors it was given and the theme painted on the
 * root. The floors are read from the root's --bk-* values (the one palette every bundled app can see, as with
 * useSurfaceVariant), so a theme switch re-derives and a piece with no color paints nothing.
 */
import { useMemo, useSyncExternalStore, type CSSProperties } from "react";
import { accentRole, scopedAccentProps, type AccentFloors, type AccentScope } from "./accent-role";
import { accentVars } from "./decks";
import { floorsFromStyle } from "../shell/theme-tokens";

const listeners = new Set<() => void>();
let watcher: MutationObserver | null = null;
let cached: string | null = null;
let cachedRoot: Element | null = null; // a different document (a test swapping windows) must not read the last one's floors
const drop = (): void => { cached = null; for (const listener of listeners) listener(); };

function subscribe(notify: () => void): () => void {
  if (typeof MutationObserver === "undefined") return () => undefined;
  listeners.add(notify);
  watcher ??= new MutationObserver(drop);
  watcher.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "data-theme"] });
  return () => {
    listeners.delete(notify);
    if (listeners.size === 0) { watcher?.disconnect(); watcher = null; cached = null; }
  };
}
/** One string of the painted floors, "" when the root has none readable; cached until the root's style changes. */
function snapshot(): string {
  if (typeof document === "undefined") return "";
  if (cached !== null && cachedRoot === document.documentElement) return cached;
  cachedRoot = document.documentElement;
  const f = floorsFromStyle(getComputedStyle(cachedRoot));
  return (cached = f ? [...f.surfaces, f.track, f.text, f.onTint, f.onDeep].join(",") : "");
}
/** The palette fields an accent is held to, back from a snapshot string. */
export function floorsFromSnapshot(key: string): AccentFloors | null {
  if (!key) return null;
  const v = key.split(",");
  return { surfaces: v.slice(0, 6), track: v[6]!, text: v[7]!, onTint: v[8]!, onDeep: v[9]! };
}

/** Style for a container: the character's, persona's and scene's scoped properties; undefined when none has a color. */
export function useScopedAccents(colors: Partial<Record<AccentScope, string | undefined>>): CSSProperties | undefined {
  const key = useSyncExternalStore(subscribe, snapshot, () => "");
  const { character, persona, scene } = colors;
  return useMemo(() => {
    const floors = floorsFromSnapshot(key);
    if (!floors) return undefined;
    const props = { ...scopedAccentProps("character", character, floors), ...scopedAccentProps("persona", persona, floors), ...scopedAccentProps("scene", scene, floors) };
    return Object.keys(props).length ? (props as CSSProperties) : undefined;
  }, [key, character, persona, scene]);
}

/** accentVars bound to the painted theme's floors: call it from a component body, and a theme switch re-derives. */
export function useAccentVars(): (accent: string | undefined) => Record<string, string> | undefined {
  const key = useSyncExternalStore(subscribe, snapshot, () => "");
  return useMemo(() => {
    const floors = floorsFromSnapshot(key);
    return (accent) => accentVars(accent, floors);
  }, [key]);
}

/** A colour held to the painted theme's text floor (accentRole's text), for text a person's own colour is drawn in; the colour itself when no floors are readable. */
export function useAccentText(): (hex: string) => string {
  const key = useSyncExternalStore(subscribe, snapshot, () => "");
  return useMemo(() => {
    const floors = floorsFromSnapshot(key);
    return (hex) => (floors ? accentRole(hex, floors)?.text ?? hex : hex);
  }, [key]);
}
