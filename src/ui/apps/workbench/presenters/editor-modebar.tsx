/** Controlled editor preferences: the always-visible mode switch and the secondary arrangement choices. */
import { Segmented } from "../../../components/button";
import type { JSX } from "react";

interface ModeProps {
  mode: "grid" | "interview";
  setMode(mode: "grid" | "interview"): void;
}

export function EditorModeSwitch({ mode, setMode }: ModeProps): JSX.Element {
  return <span data-tour="mode"><Segmented label="Editor mode" size="sm" value={mode} onChange={setMode} items={[{ value: "grid", label: "Grid" }, { value: "interview", label: "Steps" }]} /></span>;
}

export function EditorArrangement(p: {
  mode: ModeProps["mode"];
  editorLayout: "bento" | "playbill";
  setEditorLayout(layout: "bento" | "playbill"): void;
  layoutLocked: boolean;
  hasBehavior: boolean;
  workshop: boolean;
  setWorkshop(on: boolean): void;
}): JSX.Element {
  return (
    <>
      {p.mode === "grid" && <div>
        <Segmented label="Editor layout" size="sm" value={p.editorLayout} onChange={p.setEditorLayout} items={[
          { value: "bento", label: "Bento", disabled: p.layoutLocked },
          { value: "playbill", label: "Playbill", disabled: p.layoutLocked },
        ]} />
        {p.layoutLocked && <p>This theme sets how the editor is arranged.</p>}
      </div>}
      {p.hasBehavior && <Segmented label="Editor surface" size="sm" value={p.workshop ? "workshop" : "fields"} onChange={(value) => p.setWorkshop(value === "workshop")} items={[{ value: "fields", label: "Fields" }, { value: "workshop", label: "Workshop" }]} />}
    </>
  );
}
