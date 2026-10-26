/**
 * What every model pass shares (RoleCall's PassCommonChrome, OutputModeToggle, FailureMode and the sliders,
 * PostProductionPanel.tsx:1578-1750, 2377-2440): its model (a Kit connection and model, or the scene's), temperature, the cross-message
 * context, whether thinking is cut from its input, how it answers, and what a failure does. RoleCall's "apply your AI-output regex scripts
 * to input" is not here: Bunraku's regex has no such placement, so there is nothing for it to do.
 */
import type { JSX } from "react";
import { Button, Card } from "../../../components/button";
import { defaultTemperature, type FailureMode, type FinalCutPass, type OutputMode } from "../../../../core/final-cut/pass";
import { contextMessagesOf, temperatureOf } from "../../../../core/final-cut/pass";
import { BoothModelPicker } from "../booth-model-picker";
import type { SceneModels } from "../use-scene-models";
import { Check, Range, Sel } from "./fc-controls";

export type Change = (patch: Partial<FinalCutPass>) => void;

const MODEL_FRAMING: Readonly<Record<string, { label: string; description: string }>> = {
  editor: { label: "Editor model", description: "Structural rewrites: POV, tense, voice. A capable mid-tier model handles this well. Falls back to your scene model when unset." },
  translator: { label: "Translator model", description: "Translation pass: terminology stability and natural phrasing. A capable model with strong target-language fluency. Falls back to your scene model when unset." },
  "custom-agent": { label: "Custom Agent model", description: "Whatever your prompt asks. Falls back to your scene model when unset." },
  "anti-slop": { label: "Anti-Slop model", description: "Pattern substitution, not creative rewriting, so a small, cheap model is usually fine. Falls back to your scene model when unset." },
};

const TYPE_WORD: Readonly<Record<string, string>> = { editor: "editor", "anti-slop": "anti-slop", translator: "translator", "custom-agent": "custom agent" };

const CONTEXT_FOOTER: Readonly<Record<number, string>> = { 1: "current draft only", 2: "current + last reply", 3: "short continuity (default)", 5: "pattern detection sweet spot", 10: "max: heavy context" };

export function ModelPick({ pass, models, onChange }: { pass: FinalCutPass; models: SceneModels; onChange: Change }): JSX.Element {
  const framing = MODEL_FRAMING[pass.type] ?? MODEL_FRAMING["editor"]!;
  return (
    <div className="fc-model" data-part="scene.finalcut.model">
      <div className="fc-sub"><b>{framing.label}</b><small>{framing.description}</small></div>
      <BoothModelPicker current={pass.connection} models={models} onPick={(connection) => onChange({ connection })} />
      {pass.connection && <Button variant="quiet" size="sm" onClick={() => onChange({ connection: undefined })}>Use the scene's model</Button>}
    </div>
  );
}

export function PassChrome({ pass, models, onChange, strip = true }: { pass: FinalCutPass; models: SceneModels; onChange: Change; strip?: boolean }): JSX.Element {
  const fallback = defaultTemperature(pass.type);
  const temperature = temperatureOf(pass.temperature, pass.type);
  const context = contextMessagesOf(pass.contextMessages);
  return (
    <>
      <ModelPick pass={pass} models={models} onChange={onChange} />
      <Range label="Temperature" value={temperature} min={0} max={1.5} step={0.05} display={temperature.toFixed(2)}
        footer={pass.temperature !== undefined && Math.abs(pass.temperature - fallback) > 1e-6 ? `override (default ${fallback.toFixed(2)})` : `default for ${TYPE_WORD[pass.type] ?? pass.type}`}
        onChange={(n) => onChange({ temperature: Number(n.toFixed(2)) })} />
      <Range label="Cross-message context" value={context} min={1} max={10} step={1} display={`${context} msg${context === 1 ? "" : "s"}`}
        footer={CONTEXT_FOOTER[context] ?? `${context} messages`} onChange={(n) => onChange({ contextMessages: Math.round(n) })} />
      {strip && <Check label="Strip thinking blocks from input" checked={pass.stripThinkingFromInput !== false} onChange={(stripThinkingFromInput) => onChange({ stripThinkingFromInput })} />}
      <Check label="Apply your AI-output regex scripts to input" checked={pass.applyRegexToInput !== false} onChange={(applyRegexToInput) => onChange({ applyRegexToInput })} />
    </>
  );
}

export function OutputModeToggle({ value, onChange }: { value: OutputMode | undefined; onChange(next: OutputMode): void }): JSX.Element {
  const active: OutputMode = value ?? "tool-call";
  return (
    <div className="fc-mode" data-part="scene.finalcut.mode">
      <span className="fc-sub"><b>Output mode</b></span>
      <div className="pg-opts">
        <Card kind="choice" selected={active === "tool-call"} aria-pressed={active === "tool-call"} onClick={() => onChange("tool-call")} heading="Tool call (default)"
          subtitle="Model is required to call a structured function with the refined body and a typed changelog as separate fields. Output shape is enforced by the API's tool-call layer. Every modern provider supports this; it's the most reliable mode." />
        <Card kind="choice" selected={active === "tagged"} aria-pressed={active === "tagged"} onClick={() => onChange("tagged")} heading="Tagged (legacy)"
          subtitle={<>Model returns a plain-text reply containing <code>[CHANGELOG]</code> and <code>[REFINED]</code> sections that we parse. Use only if your provider doesn't honor tool calls: markers can drift and the parser can lose output.</>} />
      </div>
      <small className="fc-hint">If the model can't comply with the chosen mode (no tool call returned, or empty/malformed body), the pass routes through its failure-mode setting above. A connection that takes no tool calls runs in tagged mode and says so.</small>
    </div>
  );
}

const FAILURES = { fallback: { label: "Save original reply" }, skip: { label: "Skip failed pass" }, block: { label: "Block generation" } } as const;

export function FailureModeSelect({ value, onChange }: { value: FailureMode; onChange(next: FailureMode): void }): JSX.Element {
  return <Sel label="If this pass fails" value={value} options={FAILURES} onChange={(v) => onChange(v as FailureMode)} />;
}
