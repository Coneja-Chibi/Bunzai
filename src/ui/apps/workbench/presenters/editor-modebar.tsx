/**
 * EditorModeBar - the header's view toggles, lifted from Editor.tsx: the field-layout switch (Bento |
 * Playbill), the field-mode switch (Grid | Steps), and the Fields | Workshop switch that opens the
 * behavior workspace beside the fields. Layout + mode are onboarding-taught preferences that retire to
 * Settings once the tour is done; the Fields | Workshop pair shows whenever the card carries behavior.
 * Pure toggles over injected state.
 */
import { Segmented } from "../../../components/button";
import type { JSX } from "react";

type Styles = Readonly<Record<string, string>>;

export interface EditorModeBarProps {
  mode: "grid" | "interview";
  setMode(m: "grid" | "interview"): void;
  editorLayout: "bento" | "playbill";
  setEditorLayout(l: "bento" | "playbill"): void;
  /** the theme's editor.frame sets the arrangement: the pair stays visible but disabled */
  layoutLocked?: boolean;
  /** the card carries scripts, so the workspace is offered */
  hasBehavior: boolean;
  workshop: boolean;
  setWorkshop(on: boolean): void;
  styles: Styles;
}

export function EditorModeBar(props: EditorModeBarProps): JSX.Element {
  const { mode, setMode, editorLayout, setEditorLayout, layoutLocked = false, hasBehavior, workshop, setWorkshop, styles } = props;
  return (
    <>
      {/* ALWAYS rendered: these are the controls the tour points at, and gating them on the
          tour-seen flag made every REPLAYED tour highlight nothing (the proven first-user report).
          The context menu keeps its duplicate for people who prefer it. */}
      {mode === "grid" && (
        <span data-tour="layout" title={layoutLocked ? "This theme sets how the editor is arranged" : undefined}>
          <Segmented
            label="Editor layout"
            size="sm"
            items={[
              { value: "bento", label: "Bento", disabled: layoutLocked, title: layoutLocked ? "This theme sets how the editor is arranged" : undefined },
              { value: "playbill", label: "Playbill", disabled: layoutLocked, title: layoutLocked ? "This theme sets how the editor is arranged" : undefined },
            ]}
            value={editorLayout}
            onChange={setEditorLayout}
          />
        </span>
      )}
      <span data-tour="mode">
        <Segmented
          label="Editor mode"
          size="sm"
          items={[
            { value: "grid", label: "Grid" },
            { value: "interview", label: "Steps" },
          ]}
          value={mode}
          onChange={setMode}
        />
      </span>
      {hasBehavior && (
        <Segmented
          label="Editor surface"
          size="sm"
          items={[
            { value: "fields", label: "Fields" },
            { value: "workshop", label: "Workshop" },
          ]}
          value={workshop ? "workshop" : "fields"}
          onChange={(v) => setWorkshop(v === "workshop")}
        />
      )}
    </>
  );
}
