/**
 * The Prompt Inspector's page-side rules (rc-parity 03 F16). The on/off is one per-user pref, read when a turn
 * starts and written by the composer "+" menu's Debug row (RoleCall: usePromptInspectorPreference, `prompt_inspector_enabled`).
 * The review dialog sends back only the messages the person changed.
 */
export const INSPECTOR_KEY = "scenes.promptInspector";

/** Fail closed to off: only a stored `true` turns the pause on. */
export const readInspector = (raw: unknown): boolean => raw === true;

/** The edits to send: each message whose text differs from the request, by its position in it. */
export function editsOf(original: readonly { content: string }[], drafts: readonly string[]): Record<number, string> {
  const edits: Record<number, string> = {};
  drafts.forEach((text, i) => { if (original[i] && text !== original[i]!.content) edits[i] = text; });
  return edits;
}
