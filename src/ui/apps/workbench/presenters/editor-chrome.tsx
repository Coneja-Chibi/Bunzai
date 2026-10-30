/** Studio Strip: character identity and actions above compact platform, view and progress controls. */
import { useState, type JSX, type ReactNode } from "react";
import type { CoverageInfo } from "../../../app-contract";
import { Button, IconButton } from "../../../components/button";
import { InkDialog } from "../../../components/ink-dialog";
import { PlatformTabs, type OffTarget } from "../../../components/platform-tabs";
import { ProgressChecklist } from "../../../components/progress-checklist";
import { EditorArrangement, EditorModeSwitch } from "./editor-modebar";

export interface EditorChromeProps {
  name: string;
  version: string;
  onClose(): void;
  coverage: CoverageInfo[];
  targets: string[];
  platformLabel(id: string): string;
  toggleTarget(id: string): void;
  clearTargets(): void;
  offTarget: OffTarget;
  pickOffTarget(mode: OffTarget): void;
  lensActive: boolean;
  lensVisibleCount: number;
  lensTotalCount: number;
  chips: ReadonlyArray<readonly [string, boolean]>;
  editorScale: number;
  stepScale(dir: -1 | 1): void;
  setEditorScale(scale: number): void;
  scaleMin: number;
  scaleMax: number;
  mode: "grid" | "interview";
  setMode(mode: "grid" | "interview"): void;
  editorLayout: "bento" | "playbill";
  setEditorLayout(layout: "bento" | "playbill"): void;
  layoutLocked: boolean;
  hasBehavior: boolean;
  workshop: boolean;
  setWorkshop(on: boolean): void;
  saving: boolean;
  dirty: boolean;
  doSave(): void;
  openExport(): void;
  topRight?: ReactNode;
  styles: Readonly<Record<string, string>>;
}

export function EditorChrome(p: EditorChromeProps): JSX.Element {
  const [panel, setPanel] = useState<"platforms" | "view" | null>(null);
  const platforms = p.coverage.filter((c) => c.lens !== false).map((c) => ({ id: c.id, label: p.platformLabel(c.id) }));
  const target = p.targets.length === 0 ? "Full card" : p.targets.map(p.platformLabel).join(", ");
  const status = p.saving ? "Saving…" : p.dirty ? "Unsaved changes" : "Saved locally";
  return (
    <section className={p.styles.studioChrome} aria-label="Character editor controls">
      <div className={p.styles.studioHead} data-editor="head">
        <IconButton label="Close" variant="quiet" size="sm" icon="lucide:arrow-left" onClick={p.onClose} />
        <div className={p.styles.studioIdentity}>
          <b>{p.name}</b>
          <span>Character{p.version !== "" && p.version.length <= 16 ? ` · ${p.version}` : ""} · <span role="status">{status}</span></span>
        </div>
        <div className={p.styles.studioActions}>
          <Button variant={p.dirty ? "primary" : "quiet"} size="sm" data-tour="save" disabled={p.saving || !p.dirty} onClick={() => void p.doSave()} title="Save · ctrl+s">Save</Button>
          <Button variant={p.dirty ? "secondary" : "primary"} size="sm" onClick={p.openExport}>Export</Button>
        </div>
      </div>
      <div className={p.styles.studioTools} data-editor="tabs">
        <span className={p.styles.studioTarget} data-tour="lens">
          <Button variant="quiet" size="sm" menu aria-haspopup="dialog" aria-expanded={panel === "platforms"} onClick={() => setPanel("platforms")} title={`Writing for: ${target}`}>
            <span className={p.styles.studioTargetLabel}>{`Writing for: ${target}`}</span>
          </Button>
        </span>
        <EditorModeSwitch mode={p.mode} setMode={p.setMode} />
        <span data-tour="layout">
          <Button variant="quiet" size="sm" menu aria-haspopup="dialog" aria-expanded={panel === "view"} onClick={() => setPanel("view")}>View options</Button>
        </span>
        {p.topRight}
        <div className={p.styles.studioProgress}>
          <ProgressChecklist compact items={p.chips} extraStat={p.lensActive ? `Lens ${p.lensVisibleCount}/${p.lensTotalCount}` : undefined} />
        </div>
      </div>
      {panel !== null && (
        <InkDialog ariaLabel={panel === "platforms" ? "Writing for platform" : "View options"} onDismiss={() => setPanel(null)}>
          <div className={p.styles.studioDialog}>
            <div className={p.styles.studioDialogHead}>
              <h2>{panel === "platforms" ? "Writing for platform" : "View options"}</h2>
              <IconButton variant="quiet" size="sm" label="Close options" icon="lucide:x" onClick={() => setPanel(null)} />
            </div>
            {panel === "platforms" ? (
              <PlatformTabs platforms={platforms} selected={p.targets} onToggle={p.toggleTarget} onClear={p.clearTargets} offTarget={p.offTarget} onOffTarget={p.pickOffTarget} />
            ) : (
              <>
                <EditorArrangement mode={p.mode} editorLayout={p.editorLayout} setEditorLayout={p.setEditorLayout} layoutLocked={p.layoutLocked} hasBehavior={p.hasBehavior} workshop={p.workshop} setWorkshop={p.setWorkshop} />
                <div className={p.styles.studioScale} role="group" aria-label="Editor scale">
                  <span>Text size</span>
                  <IconButton variant="quiet" label="Scale editor down" size="sm" icon="lucide:minus" onClick={() => p.stepScale(-1)} disabled={p.editorScale <= p.scaleMin} />
                  <Button variant="quiet" size="sm" onClick={() => p.setEditorScale(1)} title="Reset to 100%">{`${Math.round(p.editorScale * 100)}%`}</Button>
                  <IconButton variant="quiet" label="Scale editor up" size="sm" icon="lucide:plus" onClick={() => p.stepScale(1)} disabled={p.editorScale >= p.scaleMax} />
                </div>
              </>
            )}
            <Button size="sm" onClick={() => setPanel(null)}>Done</Button>
          </div>
        </InkDialog>
      )}
    </section>
  );
}
