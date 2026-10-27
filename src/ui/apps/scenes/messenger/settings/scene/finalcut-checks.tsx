/**
 * The Output safety check's page and the on-demand editing tools' page of the Final Cut section (Full Chat's SafetyCard, fc-anti-slop.tsx, and ToolsCard, fc-tools-card.tsx). The safety check has its failure mode and the switch for
 * also checking your own message; each editing tool (Rewrite, Expand, Reduce, Custom, Correction) has its own model, temperature override and reply limit, written through `useFinalCut.setTools` with the card's own `patchTool`.
 */
import type { JSX } from "react";
import { TOOL_IDS, TOOL_LABELS, TOOL_MAX_TOKENS, type ToolId } from "../../../../../../core/final-cut/pass";
import { QUALITY_CHECKS } from "../../../../../../core/final-cut/validate";
import { HINTS, patchTool } from "../../../final-cut/fc-tools-card";
import type { FinalCutState } from "../../../final-cut/use-final-cut";
import type { SceneModels } from "../../../use-scene-models";
import { ActionRow, NumberRow, SliderRow, ToggleRow } from "../../frames/settings-rows";
import type { SceneEnv } from "./env";
import { FailureRow, ModelRow, NOTE, PassBody, useFinalCutPage } from "./finalcut-kit";

export function SafetyPage({ env }: { env: SceneEnv }): JSX.Element {
  return (
    <PassBody env={env} type="validator" part="safety" label="Output safety check" description="Checks the finished reply for empty output, leaked syntax and unbalanced markup. No model call.">
      {({ pass, change }) => (
        <>
          <FailureRow value={pass.failureMode} onChange={(failureMode) => change({ failureMode })} />
          <ToggleRow label="Also check my messages before send" on={pass.applyToUserMessages === true} onChange={(applyToUserMessages) => change({ applyToUserMessages })} />
          <p className={NOTE}>Checks: {QUALITY_CHECKS.join("; ")}.</p>
        </>
      )}
    </PassBody>
  );
}

function ToolRows({ id, fc, models }: { id: ToolId; fc: FinalCutState; models: SceneModels }): JSX.Element {
  const tools = fc.settings.tools;
  const cfg = tools?.[id];
  const hasTemp = typeof cfg?.temperature === "number";
  const hasMax = typeof cfg?.maxTokens === "number";
  return (
    <div data-part={`scene.messenger.settings.finalcut.tools.${id}`}>
      <ModelRow label={`${TOOL_LABELS[id]} model`} description={`${HINTS[id]} Falls back to your scene model when unset.`} current={cfg?.connection} models={models} onPick={(connection) => fc.setTools(patchTool(tools, id, { connection }))} />
      <ToggleRow label={`${TOOL_LABELS[id]}: override temperature`} description={hasTemp ? `Set to ${cfg.temperature!.toFixed(2)}.` : "Inherits the default."} on={hasTemp} onChange={(on) => fc.setTools(patchTool(tools, id, { temperature: on ? 0.4 : undefined }))} />
      {hasTemp && <SliderRow label={`${TOOL_LABELS[id]} temperature`} value={cfg.temperature!} min={0} max={2} step={0.05} onChange={(t) => fc.setTools(patchTool(tools, id, { temperature: Math.min(Math.max(t, 0), 2) }))} />}
      <NumberRow label={`${TOOL_LABELS[id]} max tokens`} description="0 inherits the default." value={hasMax ? cfg.maxTokens! : 0} min={0} max={TOOL_MAX_TOKENS} step={1}
        onChange={(n) => { const r = Math.round(n); fc.setTools(patchTool(tools, id, { maxTokens: r < 1 ? undefined : Math.min(r, TOOL_MAX_TOKENS) })); }} />
      {(cfg?.connection || hasTemp || hasMax) && <ActionRow label={`${TOOL_LABELS[id]}: reset`} description="Back to the scene's model and defaults." action="Reset" variant="danger" onAction={() => fc.setTools(patchTool(tools, id, null))} />}
    </div>
  );
}

/** One page for the five tools: the rows of each tool under its own name, all on the page's one Final Cut writer. */
export function ToolsPage({ env }: { env: SceneEnv }): JSX.Element {
  const { fc, models } = useFinalCutPage(env);
  return (
    <div data-part="scene.messenger.settings.finalcut.tools">
      {fc.error && <p className={NOTE} role="alert">{fc.error}</p>}
      {/* bounded-ok: the five editing tools, a fixed registry */}
      {TOOL_IDS.map((id) => <ToolRows key={id} id={id} fc={fc} models={models} />)}
    </div>
  );
}
