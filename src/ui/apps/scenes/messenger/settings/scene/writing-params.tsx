/**
 * The parameter catalogue of the Samplers section (the Generation tab's Nucleus Sampling, Repetition Penalties, Output Constraints and Advanced groups, and Custom Request Parameters), as rows: a switch per parameter,
 * and its value row while it is on. Every change goes through the section's one scene preset writer with the Generation tab's own rules (generation-params-core.ts), and a value is saved only when the store's own
 * check (`sceneParamsProblem`) accepts it. The Logit Bias word list is a tool of its own and stays in the Samplers program.
 */
import type { JSX } from "react";
import type { PresetSamplers } from "../../../../../../entities/preset/schema";
import { isRecord } from "../../../../../../core/guards";
import { PARAMS, paramsIn, type ParamDef, type ParamValue } from "../../../../../../stage/params";
import { customProblem } from "../../../../../../stage/params/custom";
import { sceneParamsProblem } from "../../../../../../stage/params/scene";
import { cardState, parentOn, setCard, withCustom, type CardState } from "../../../generation-params-core";
import type { ProviderInfo } from "../../../generation-params-card";
import { FIELDS } from "../../../generation-params-custom";
import { GROUPS } from "../../../generation-params-groups";
import type { ScenePresetOwn } from "../../../use-scene-preset-own";
import { DrillRow, SliderRow, ToggleRow } from "../../frames/settings-rows";
import { CheckedText } from "./drafts";
import type { SceneEnv } from "./env";
import { SavedNumber } from "./saved";

/** The first sentence of a registry description: a row carries one line, the whole text stays in the Generation tab. */
export const firstSentence = (text: string): string => (/^.*?[.!?](?=\s|$)/.exec(text)?.[0] ?? text);

const lines = (text: string): string[] => text.split("\n").map((l) => l.trim()).filter(Boolean);

type Change = (def: ParamDef, change: { on?: boolean; value?: ParamValue }) => void;

/** How the text of a text, list or JSON parameter becomes its value, or why it cannot (nothing is saved then). */
function parsed(def: ParamDef, text: string): { value: ParamValue } | string {
  if (def.kind === "array") return { value: lines(text) };
  if (def.kind === "string") return { value: text };
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? { value: value as ParamValue } : "Use a JSON object: { \"key\": value }.";
  } catch {
    return text.trim() ? "That is not valid JSON yet; nothing is sent until it is." : "Enter a JSON object, or switch this off.";
  }
}

function TextValue({ def, value, open, onChange }: { def: ParamDef; value: ParamValue | null; open: SceneEnv["open"]; onChange(value: ParamValue): void }): JSX.Element {
  if (def.id === "logit_bias") {
    const entries = isRecord(value) && Array.isArray(value["entries"]) ? value["entries"].length : 0;
    return <DrillRow label="Logit bias words" description="Type the words and their weights in the sampler tool." value={`${entries} ${entries === 1 ? "entry" : "entries"}`} onOpen={() => open("sampler")} />;
  }
  const saved = def.kind === "array" ? (Array.isArray(value) ? value.join("\n") : "") : def.kind === "string" ? (typeof value === "string" ? value : "") : (isRecord(value) ? JSON.stringify(value, null, 2) : "");
  const check = (text: string): string | null => {
    const made = parsed(def, text);
    if (typeof made === "string") return made;
    const why = sceneParamsProblem({ [def.id]: { on: true, value: made.value } });
    return why ? why.replace(/^params \S+ value /, "The value ") : null;
  };
  return (
    <CheckedText label={`${def.label} value`} saved={saved} rows={def.multiline ? 6 : 3} check={check}
      write={(text) => { const made = parsed(def, text); if (typeof made !== "string") onChange(made.value); }} />
  );
}

function ParamValueRow({ def, state, open, onChange }: { def: ParamDef; state: CardState; open: SceneEnv["open"]; onChange(value: ParamValue): void }): JSX.Element | null {
  const v = state.value;
  const num = typeof v === "number" ? v : typeof def.default === "number" ? def.default : 0;
  switch (def.kind) {
    case "range": return <SliderRow label={`${def.label} value`} value={num} min={def.min!} max={def.max!} step={def.step!} {...(def.unit ? { unit: ` ${def.unit}` } : {})} onChange={onChange} />;
    case "integer": return <SavedNumber label={`${def.label} value`} saved={num} min={def.min ?? Number.MIN_SAFE_INTEGER} max={def.max ?? Number.MAX_SAFE_INTEGER} step={def.step ?? 1} write={onChange} />;
    case "boolean": return <ToggleRow label={`${def.label} is sent as`} description={v ? "true" : "false"} on={v === true} onChange={onChange} />;
    case "array": case "string": case "object": return <TextValue def={def} value={v} open={open} onChange={onChange} />;
    case "select": return null;
  }
}

function ParamPair({ def, state, greyed, provider, open, onChange }: { def: ParamDef; state: CardState; greyed: boolean; provider: ProviderInfo | null; open: SceneEnv["open"]; onChange: Change }): JSX.Element {
  const refused = provider !== null && !provider.accepts.has(def.id);
  const description = [firstSentence(def.description), refused ? `Not sent to ${provider.label}.` : "", greyed ? "Waits for the parameter it hangs from." : ""].filter(Boolean).join(" ");
  return (
    <>
      <ToggleRow label={def.label} description={description} on={state.on} onChange={(on) => onChange(def, { on })} />
      {state.on && <ParamValueRow def={def} state={state} open={open} onChange={(value) => onChange(def, { value })} />}
    </>
  );
}

export function ParamRows({ env, own, presetSamplers, provider, thinking }: { env: SceneEnv; own: ScenePresetOwn; presetSamplers: PresetSamplers | undefined; provider: ProviderInfo | null; thinking: boolean }): JSX.Element | null {
  const scene = own.own;
  if (!scene) return null;
  const typed: PresetSamplers = { ...presetSamplers, ...scene.samplers };
  // Enable Thinking, which Clear Thinking hangs from, is on while Reasoning Effort is a level (the Generation tab's own rule).
  const params = { ...scene.samplers.params, enable_thinking: { on: thinking } };
  const change: Change = (def, c) => own.edit((p) => ({ ...p, samplers: { ...p.samplers, params: setCard(def, p.samplers.params, typed, c) } }));
  return (
    <div data-part="scene.messenger.settings.writing.params">
      {GROUPS.map((g) => (
        <div key={g.group} data-part={`scene.messenger.settings.writing.params.${g.group}`}>
          <div className="msn-st-t"><b>{g.title}</b><span>{g.purpose}</span></div>
          {paramsIn(g.group).map(/* bounded-ok: fixed registry of panels / settings / props / platforms */ (def) => <ParamPair key={def.id} def={def} state={cardState(def, params, typed)} greyed={!parentOn(def, params, typed, PARAMS)} provider={provider} open={env.open} onChange={change} />)}
        </div>
      ))}
      <div data-part="scene.messenger.settings.writing.params.custom">
        <div className="msn-st-t"><b>Custom request parameters</b><span>Headers and body fields added to each request, as JSON. The request&apos;s own fields cannot be set or removed.</span></div>
        {FIELDS.map((f) => (
          <CheckedText key={f.key} label={f.label} saved={scene.samplers[f.key] ?? ""} rows={f.rows} check={(text) => customProblem(f.kind, text)}
            write={(text) => own.edit((p) => ({ ...p, samplers: withCustom(p.samplers, f.key, text) }))} />
        ))}
      </div>
    </div>
  );
}
