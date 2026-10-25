/**
 * The State inspector's helpers (RoleCall `packages/macros/src/inspector.ts`, ported for the Context wing's State tab): a stored variable key read back as the scope
 * its author wrote, and a value as text. Chat-local keys carry the namespace prefixes scopes.ts writes (`_char_<ns>_`, `_arc_`, `_scene_`); `__` marks the engine's own
 * bookkeeping; everything else is session state. Library globals come from their own document and are classified by the caller. Pure.
 */
import { ARC_KEY_PREFIX, SCENE_KEY_PREFIX } from "./scopes";

export type InspectorScope = "session" | "character" | "arc" | "scene" | "global" | "internal";

export interface ClassifiedKey {
  scope: InspectorScope;
  /** The author-facing key, with the namespace prefix stripped. */
  displayKey: string;
  /** The character namespace (an id or a name) when the scope is "character". */
  characterNs?: string;
}

const CHAR_KEY = /^_char_(.+?)_(.+)$/;

/** A chat-local storage key's display scope. */
export function classifyStorageKey(storageKey: string): ClassifiedKey {
  if (storageKey.startsWith("__")) return { scope: "internal", displayKey: storageKey };
  const char = CHAR_KEY.exec(storageKey);
  if (char) return { scope: "character", displayKey: char[2]!, characterNs: char[1]! };
  if (storageKey.startsWith(ARC_KEY_PREFIX)) return { scope: "arc", displayKey: storageKey.slice(ARC_KEY_PREFIX.length) };
  if (storageKey.startsWith(SCENE_KEY_PREFIX)) return { scope: "scene", displayKey: storageKey.slice(SCENE_KEY_PREFIX.length) };
  return { scope: "session", displayKey: storageKey };
}

/** A value pretty-printed for the detail view. */
export function formatInspectorValue(value: unknown): string {
  if (value === null || value === undefined) return "(null)";
  return typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
}

/** A one-line preview for a list row, cut at `maxLength` with an ellipsis. */
export function previewInspectorValue(value: unknown, maxLength = 60): string {
  const full = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "");
  return full.length > maxLength ? `${full.slice(0, maxLength)}…` : full;
}
