/**
 * On-demand editing tools (RoleCall's FinalCutToolsCard.tsx): a model, a temperature and a reply limit for each of the Correction Tools'
 * Rewrite, Expand, Reduce and Correction, saved with the scene. A tool with nothing set uses the scene's model; "Reset to scene defaults"
 * clears it. RoleCall also lists Custom, the inline free-form rewrite of the message editor, which Bunraku has not built, so it is not
 * listed (a row with nothing behind it would be a dead control).
 */
import type { JSX } from "react";
import { Button } from "../../../components/button";
import { TOOL_IDS, TOOL_LABELS, TOOL_MAX_TOKENS, type FinalCutTools, type ToolConfig, type ToolId } from "../../../../core/final-cut/pass";
import { Slider } from "../../../components/slider";
import { BoothModelPicker } from "../booth-model-picker";
import type { SceneModels } from "../use-scene-models";
import { Check } from "./fc-controls";

const HINTS: Readonly<Record<ToolId, string>> = {
  rewrite: "Line-edit the highlighted passage for flow and prose quality.",
  expand: "Add implied detail or rhythm the highlight already gestures at.",
  reduce: "Tighten the highlight into leaner prose.",
  custom: "Apply your own free-form instruction to the highlight.",
  correct: "Run a correction guide over the whole message.",
};

/** The tools with the one tool changed; a tool left with nothing set leaves the object. */
export function patchTool(tools: FinalCutTools | undefined, id: ToolId, patch: Partial<ToolConfig> | null): FinalCutTools {
  const next: FinalCutTools = { ...tools };
  if (patch === null) delete next[id];
  else {
    const merged = { ...next[id], ...patch };
    const kept: ToolConfig = {};
    if (merged.connection) kept.connection = merged.connection;
    if (typeof merged.temperature === "number") kept.temperature = merged.temperature;
    if (typeof merged.maxTokens === "number") kept.maxTokens = merged.maxTokens;
    if (Object.keys(kept).length === 0) delete next[id];
    else next[id] = kept;
  }
  return next;
}

export function ToolsCard({ tools, models, onChange }: { tools: FinalCutTools | undefined; models: SceneModels; onChange(next: FinalCutTools): void }): JSX.Element {
  return (
    <section className="fc-card fc-tools" style={{ "--p": "var(--stage-warn)" } as React.CSSProperties} data-part="scene.finalcut.tools">
      <header>
        <div>
          <div className="kick">On-demand editing tools</div>
          <h3>Per-tool model &amp; parameters</h3>
          <p>Rewrite, Expand, Reduce, and Correction run on your scene model by default. Point any of them at a different model or temperature. Left empty, a tool inherits the scene model.</p>
        </div>
      </header>
      <div className="fc-controls">
        {TOOL_IDS.map((id) => {
          const cfg = tools?.[id];
          const hasTemp = typeof cfg?.temperature === "number";
          const hasMax = typeof cfg?.maxTokens === "number";
          return (
            <details key={id} className="fc-fold">
              <summary><span>{TOOL_LABELS[id]}</span><small>{cfg?.connection ? "custom model" : "scene model"}{hasTemp ? ` · temp ${cfg.temperature}` : ""}{hasMax ? ` · max ${cfg.maxTokens}` : ""}</small></summary>
              <div className="fc-fold-body">
                <p className="fc-hint">{HINTS[id]}</p>
                <div className="fc-model">
                  <div className="fc-sub"><b>{TOOL_LABELS[id]} model</b><small>Falls back to your scene model when unset.</small></div>
                  <BoothModelPicker current={cfg?.connection} models={models} onPick={(connection) => onChange(patchTool(tools, id, { connection }))} />
                </div>
                <div className="fc-grid">
                  <div>
                    <Check label={`Override temperature ${hasTemp ? `(${cfg.temperature!.toFixed(2)})` : "(inherits default)"}`} checked={hasTemp} onChange={(on) => onChange(patchTool(tools, id, { temperature: on ? 0.4 : undefined }))} />
                    {hasTemp && <Slider readout={false} aria-label={`${TOOL_LABELS[id]} temperature`} min={0} max={2} step={0.05} value={cfg.temperature!} onChange={(t) => onChange(patchTool(tools, id, { temperature: Math.min(Math.max(t, 0), 2) }))} />}
                  </div>
                  <label className="fc-label">Max tokens {hasMax ? "" : "(inherits default)"}
                    <input className="fc-field" type="number" min={1} max={TOOL_MAX_TOKENS} placeholder="auto" value={hasMax ? cfg.maxTokens : ""} onChange={(e) => {
                      const raw = e.target.value.trim();
                      const n = Math.round(parseFloat(raw));
                      onChange(patchTool(tools, id, { maxTokens: raw === "" || !Number.isFinite(n) || n < 1 ? undefined : Math.min(n, TOOL_MAX_TOKENS) }));
                    }} />
                  </label>
                </div>
                {(cfg?.connection || hasTemp || hasMax) && <Button variant="danger" size="sm" onClick={() => onChange(patchTool(tools, id, null))}>Reset to scene defaults</Button>}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
