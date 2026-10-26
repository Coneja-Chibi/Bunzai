/**
 * The Chrome & Device act (RoleCall's "Chrome & Device", StageSettingsPanel.tsx:2400-2600): compact mode, collapsed wing panels with
 * their edge indicator, and wing labels on hover. Chat Input Resize belongs to the composer, Phone Controls to the container
 * queries (narrow layout is the pane's, not a scale), and Composer Debug Tools has no reader in RoleCall (F4), so none is drawn.
 */
import type { JSX } from "react";
import { SwitchRow } from "./stage-controls";
import type { EdgeStyle } from "./stage-look-core";
import type { StageActProps } from "./stage-message-act";
import { Card } from "../../components/button";

const EDGES: readonly { id: EdgeStyle; label: string; hint: string }[] = [
  { id: "single", label: "Single", hint: "Clean glow line" },
  { id: "segmented", label: "Segmented", hint: "Each panel has its own color segment" },
];

export function ChromeAct({ look, set }: StageActProps): JSX.Element {
  return (
    <div className="sa-sws">
      <SwitchRow icon="mdi:view-compact" name="Compact Mode" tone="var(--stage-var)" on={look.compact} onChange={(on) => set("compact", on)} />
      <SwitchRow icon="mdi:dock-left" name="Collapse Wing Panels" tone="var(--stage-macro)" on={look.collapse} onChange={(on) => set("collapse", on)} />
      {look.collapse && (
        <div className="sa-edge" role="group" aria-label="Edge Indicator Style">
          <span className="sa-cap">Edge Indicator Style</span>
          <div className="sa-tiles">
            {EDGES.map((e) => (
              <Card key={e.id} data-part="scene.stage.edge" kind="choice" selected={look.collapseStyle === e.id} aria-pressed={look.collapseStyle === e.id} onClick={() => set("collapseStyle", e.id)}
                heading={e.label} subtitle={e.hint}>
                <span className={`sa-edgeprev ${e.id}`} aria-hidden="true" />
              </Card>
            ))}
          </div>
        </div>
      )}
      <SwitchRow icon="mdi:tag-text-outline" name="Show Wing Labels on Hover" tone="var(--stage-var)" on={look.labels} onChange={(on) => set("labels", on)} />
    </div>
  );
}
