/**
 * The Characters and My Persona programs as the wide inspector (approved wireframe messenger-discord/panels.html 2c): the wing's own editor body, unchanged, under the wireframe's two tabs,
 * Character and My persona. The editor is the Full Chat Cast wing's (Save Draft, versions, Casting Call and every field stay as they are); a tab opens the other program, so each editor keeps
 * its draft while the other is shown. The wireframe's "Saved as you type" footer and Revert have no autosave behind them and are not drawn.
 */
import type { JSX, ReactNode } from "react";
import { Tabs } from "../../../../../components/button";

type EditorId = "characters" | "persona";
const TABS = [{ value: "characters", label: "Character", "data-part": "scene.messenger.cast.tab.character" }, { value: "persona", label: "My persona", "data-part": "scene.messenger.cast.tab.persona" }] as const;

export const isEditorProgram = (id: string): id is EditorId => id === "characters" || id === "persona";

export function CastInspector({ program, onOpenProgram, children }: { program: EditorId; onOpenProgram(id: string): void; children: ReactNode }): JSX.Element {
  return (
    <div className="msn-ci" data-part="scene.messenger.cast.inspector">
      <Tabs<EditorId> label="Cast editors" items={TABS} value={program} onChange={(id) => { if (id !== program) onOpenProgram(id); }} />
      <div className="msn-ci-b">{children}</div>
    </div>
  );
}
