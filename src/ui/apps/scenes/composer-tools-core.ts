/**
 * The composer "+" menu's gate and the per-scene draft's key. The tool list itself is writing-tools-core.ts's
 * one table (rc-parity 03 F8): the menu offers its built tools, each with the reason it cannot run now.
 */
import { TOOL_SECTIONS, WRITING_TOOLS, type ToolId, type ToolSectionId } from "./writing-tools-core";

export interface ComposerGate { busy: boolean; connected: boolean; continuable: boolean; /** The Prompt Inspector pref. */ inspector: boolean }
/** A menu row: a built writing tool, or the Debug section's Prompt Inspector toggle (RoleCall's DEBUG row). */
export interface ComposerRow { id: ToolId | "inspector"; section: ToolSectionId | "debug"; label: string; sublabel: string; disabled?: string }
export interface ComposerSection { label: string; rows: ComposerRow[] }

/** Every built tool with the reason it cannot run now, then the Inspector toggle, which is never disabled (it only changes the next turn). The re-rolls answer a scene with no reply themselves ("No AI message yet to re-roll."), as RoleCall's do. */
export function composerRows(gate: ComposerGate): ComposerRow[] {
  const why = gate.busy ? "A reply is being written." : !gate.connected ? "Pick a connection first." : undefined;
  const tools = WRITING_TOOLS.filter((t) => t.built).map((t): ComposerRow => {
    const disabled = why ?? (t.id === "continue" && !gate.continuable ? "There is no reply to continue." : undefined);
    return { id: t.id, section: t.section, label: t.label, sublabel: t.sublabel, ...(disabled ? { disabled } : {}) };
  });
  return [...tools, { id: "inspector", section: "debug", label: `Prompt Inspector: ${gate.inspector ? "On" : "Off"}`, sublabel: "" }];
}

/** The rows under their menu headings, in the table's order. */
export const composerSections = (rows: readonly ComposerRow[]): ComposerSection[] =>
  [...TOOL_SECTIONS.map((s) => ({ label: s.menuLabel, id: s.id })), { label: "Debug", id: "debug" as const }]
    .map((s) => ({ label: s.label, rows: rows.filter((r) => r.section === s.id) })).filter((s) => s.rows.length > 0);

export type { ToolId };

/** The unsent draft is kept per scene in the app prefs (RoleCall: useDraftPersistence, per chat). */
export const draftKey = (chatId: string): string => `scenes.draft.${chatId}`;
export const readDraft = (value: unknown): string => (typeof value === "string" ? value : "");
