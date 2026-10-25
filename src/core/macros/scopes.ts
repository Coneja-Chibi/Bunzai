/**
 * Variable scopes: `scope:key` ({{state.set::session:callsign::X}}) resolved onto the two storage
 * maps, as RoleCall resolves them.
 *
 *   session    per chat; a bare key is a session key, stored as written
 *   character  per chat, namespaced by character id (or name)
 *   arc        per chat, `_arc_` namespace
 *   scene      per chat, `_scene_` namespace
 *   global     across chats
 *
 * Only these prefixes are scopes. Any other `foo:` stays part of the variable's name, so existing
 * presets that put colons in names keep working.
 */
import type { MacroContext, MacroVariable } from "./types";

export type VariableScope = "session" | "character" | "arc" | "scene" | "global";

/** A Map, not an object literal: a prefix such as "constructor" must not find an inherited property. */
const SCOPE_PREFIXES = new Map<string, VariableScope>([
  ["session", "session"],
  ["character", "character"],
  ["char", "character"],
  ["arc", "arc"],
  ["scene", "scene"],
  ["global", "global"],
]);

export const ARC_KEY_PREFIX = "_arc_";
export const SCENE_KEY_PREFIX = "_scene_";

export interface ResolvedVariableTarget {
  scope: VariableScope;
  /** The key inside its map, namespace prefix applied. */
  key: string;
  isGlobal: boolean;
}

/** Resolve a key that may carry a scope prefix. Reads only the character identity from the context. */
export function resolveVariableTarget(rawKey: string, context: Pick<MacroContext, "characterId" | "characterName">): ResolvedVariableTarget {
  const colon = rawKey.indexOf(":");
  const scope = colon > 0 ? SCOPE_PREFIXES.get(rawKey.slice(0, colon).trim().toLowerCase()) : undefined;
  if (!scope) return { scope: "session", key: rawKey, isGlobal: false };
  const rest = rawKey.slice(colon + 1).trim();
  switch (scope) {
    case "session":
      return { scope, key: rest, isGlobal: false };
    case "character":
      return { scope, key: `_char_${context.characterId || context.characterName || "unknown"}_${rest}`, isGlobal: false };
    case "arc":
      return { scope, key: `${ARC_KEY_PREFIX}${rest}`, isGlobal: false };
    case "scene":
      return { scope, key: `${SCENE_KEY_PREFIX}${rest}`, isGlobal: false };
    case "global":
      return { scope, key: rest, isGlobal: true };
  }
}

export const mapForTarget = (target: ResolvedVariableTarget, context: MacroContext): Map<string, MacroVariable> =>
  target.isGlobal ? context.globalVariables : context.localVariables;

export function effectTypesForTarget(target: ResolvedVariableTarget): {
  set: "setLocalVar" | "setGlobalVar";
  del: "deleteLocalVar" | "deleteGlobalVar";
} {
  return target.isGlobal ? { set: "setGlobalVar", del: "deleteGlobalVar" } : { set: "setLocalVar", del: "deleteLocalVar" };
}
