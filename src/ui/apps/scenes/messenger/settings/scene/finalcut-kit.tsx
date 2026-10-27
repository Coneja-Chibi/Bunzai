/**
 * What every Final Cut pass page of the scene scope shares (finalcut-*.tsx): one `useFinalCut` for the page (the writer the Full Chat Final Cut tab uses, so a drag or a keystroke is one save), the pass as the page reads it,
 * and the rows every model pass has: its model, temperature, cross-message context, what happens to thinking and regex on its input, how it answers and what a failure does. Copy and ranges are Full Chat's (fc-pass-chrome.tsx).
 */
import type { JSX, ReactNode } from "react";
import { MAX_CONTEXT_MESSAGES, MAX_TEMPERATURE, contextMessagesOf, defaultTemperature, temperatureOf, type FinalCutPass, type OutputMode, type PassType } from "../../../../../../core/final-cut/pass";
import { onPass } from "../../../final-cut/fc-core";
import { CONTEXT_FOOTER, FAILURES, MODEL_FRAMING, TYPE_WORD } from "../../../final-cut/fc-pass-chrome";
import { useFinalCut, type FinalCutState } from "../../../final-cut/use-final-cut";
import { keyOf, modelChoices, useSceneModels, type SceneModels } from "../../../use-scene-models";
import { SegmentedRow, SelectRow, SliderRow, ToggleRow, type ChoiceOption } from "../../frames/settings-rows";
import { chatOf, takeChat, type SceneEnv } from "./env";

export const NOTE = "msn-st-secd";

export type PassChange = (patch: Partial<FinalCutPass>) => void;

export interface PassPage { fc: FinalCutState; models: SceneModels; pass: FinalCutPass; change: PassChange }

/** A table of `{ label }` entries (Full Chat's option tables) as select choices. */
export const choicesOf = (table: Readonly<Record<string, { label: string }>>): ChoiceOption[] => Object.entries(table).map(([value, o]) => ({ value, label: o.label }));

/** The Final Cut writer and the model list of the open scene, once for a page. */
export function useFinalCutPage(env: SceneEnv): { fc: FinalCutState; models: SceneModels } {
  const fc = useFinalCut(env.a.ctx, chatOf(env), takeChat(env));
  const models = useSceneModels(env.a.ctx, chatOf(env), takeChat(env));
  return { fc, models };
}

/** One pass's page: its switch, then (while it is on, as in Full Chat) the rows `children` draws for the stored pass. */
export function PassBody({ env, type, label, description, part, children }: { env: SceneEnv; type: PassType; label: string; description: string; part: string; children(page: PassPage): ReactNode }): JSX.Element {
  const { fc, models } = useFinalCutPage(env);
  const stored = fc.settings.passes?.find((p) => p.type === type);
  const live = onPass(fc.settings.passes, type) !== undefined;
  return (
    <div data-part="scene.messenger.settings.finalcut.pass" data-pass={part}>
      <ToggleRow label={label} description={description} on={live} onChange={() => fc.toggle(type)} />
      {fc.error && <p className={NOTE} role="alert">{fc.error}</p>}
      {live && stored ? children({ fc, models, pass: stored, change: (patch) => fc.patch(type, patch) }) : <p className={NOTE}>Switch this pass on to set it up. Your settings for it are kept while it is off.</p>}
    </div>
  );
}

const MODES: readonly ChoiceOption<OutputMode>[] = [{ value: "tool-call", label: "Tool call", description: "The model calls a structured function with the refined text and a changelog. The most reliable mode." }, { value: "tagged", label: "Tagged", description: "Plain text with changelog and refined sections that are parsed. Use only if the provider ignores tool calls." }];

export function OutputModeRow({ value, onChange }: { value: OutputMode | undefined; onChange(next: OutputMode): void }): JSX.Element {
  return <SegmentedRow label="Output mode" description="If the model cannot comply with the chosen mode, the pass follows its failure setting. A connection that takes no tool calls runs tagged." value={value ?? "tool-call"} options={MODES} onChange={onChange} />;
}

export const FAILURE_CHOICES = choicesOf(FAILURES) as ChoiceOption<FinalCutPass["failureMode"]>[];

export function FailureRow({ value, onChange }: { value: FinalCutPass["failureMode"]; onChange(next: FinalCutPass["failureMode"]): void }): JSX.Element {
  return <SelectRow label="If this pass fails" value={value} options={FAILURE_CHOICES} onChange={onChange} />;
}

/** A model of the scene's connections, or "the scene's model" (nothing set). The select twin of Full Chat's model picker; the pick is the same `connection` field. */
export function ModelRow({ label, description, current, models, onPick }: { label: string; description: string; current: FinalCutPass["connection"]; models: SceneModels; onPick(connection: FinalCutPass["connection"]): void }): JSX.Element {
  const choices = modelChoices(models);
  const key = current ? keyOf(current) : "";
  const known = choices.some((c) => c.value === key);
  const options = [{ value: "", label: "Use the scene's model" }, ...(key && !known ? [{ value: key, label: key.replace("|", ": ") }] : []), ...choices.map((c) => ({ value: c.value, label: c.label }))];
  return <SelectRow label={label} description={description} value={key} options={options} onChange={(next) => { if (!next) onPick(undefined); else { const hit = choices.find((c) => c.value === next); if (hit) onPick(hit.conn); } }} />;
}

/** The rows of Full Chat's PassChrome: model, temperature, cross-message context, then the two input switches (`strip` false for the Anti-Slop pass, which has no thinking to cut). */
export function PassChromeRows({ page, type, strip = true }: { page: PassPage; type: PassType; strip?: boolean }): JSX.Element {
  const { pass, models, change } = page;
  const framing = MODEL_FRAMING[type] ?? MODEL_FRAMING["editor"]!;
  const fallback = defaultTemperature(type);
  const temperature = temperatureOf(pass.temperature, type);
  const context = contextMessagesOf(pass.contextMessages);
  return (
    <>
      <ModelRow label={framing.label} description={framing.description} current={pass.connection} models={models} onPick={(connection) => change({ connection })} />
      <SliderRow label="Temperature" description={pass.temperature !== undefined && Math.abs(pass.temperature - fallback) > 1e-6 ? `Override (default ${fallback.toFixed(2)}).` : `Default for the ${TYPE_WORD[type] ?? type} pass.`}
        value={temperature} min={0} max={MAX_TEMPERATURE} step={0.05} onChange={(n) => change({ temperature: Number(n.toFixed(2)) })} />
      <SliderRow label="Cross-message context" description={`${CONTEXT_FOOTER[context] ?? `${context} messages`}. How many recent messages the pass sees.`} value={context} min={1} max={MAX_CONTEXT_MESSAGES} step={1}
        onChange={(n) => change({ contextMessages: Math.round(n) })} />
      {strip && <ToggleRow label="Strip thinking blocks from input" on={pass.stripThinkingFromInput !== false} onChange={(stripThinkingFromInput) => change({ stripThinkingFromInput })} />}
      <ToggleRow label="Apply your AI-output regex scripts to input" on={pass.applyRegexToInput !== false} onChange={(applyRegexToInput) => change({ applyRegexToInput })} />
    </>
  );
}
