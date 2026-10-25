/**
 * One parameter's card (RoleCall's SamplerRow, SamplerPanel.tsx:101-392): the label with its info icon
 * and key line, the switch, and the value control only while it is on. The info text opens on hover,
 * focus or a press. A provider that does not take the parameter says so under the label, because it
 * will not be sent to it. A JSON field keeps what was typed and says what is wrong, where RoleCall
 * threw the text away behind an alert.
 */
import { useState, type JSX } from "react";
import { isRecord } from "../../../core/guards";
import { Ic } from "../../_shared/ic";
import { Slider } from "../../components/slider";
import { ToggleSwitch } from "../../components/toggle-switch";
import type { ParamDef, ParamValue } from "../../../stage/params";
import type { CardState } from "./generation-params-core";
import { LogitBiasManager } from "./generation-params-bias";
import type { BiasEntry } from "../../../core/tokens/bias";

export interface ProviderInfo {
  label: string;
  /** The parameter ids this provider accepts. */
  accepts: ReadonlySet<string>;
}

interface Props {
  def: ParamDef;
  state: CardState;
  provider: ProviderInfo | null;
  /** A sub-toggle whose parent is off. */
  greyed: boolean;
  /** The scene's model: Logit Bias words are tokenized for it. */
  model?: string | undefined;
  onChange(change: { on?: boolean; value?: ParamValue }): void;
}

const shown = (v: ParamValue | null, step: number | undefined): string => (typeof v === "number" ? v.toFixed(step !== undefined && step < 0.01 ? 4 : 2) : String(v ?? ""));

function JsonBox({ def, value, onValue }: { def: ParamDef; value: ParamValue | null; onValue(v: ParamValue): void }): JSX.Element {
  const stored = isRecord(value) ? JSON.stringify(value, null, 2) : "";
  const [text, setText] = useState(stored);
  const [problem, setProblem] = useState<string | null>(null);
  const edit = (next: string): void => {
    setText(next);
    if (!next.trim()) return setProblem("Enter a JSON object, or switch this off.");
    try {
      const parsed: unknown = JSON.parse(next);
      if (!isRecord(parsed)) return setProblem("Use a JSON object: { \"key\": value }.");
      setProblem(null);
      onValue(parsed as ParamValue);
    } catch {
      setProblem("That is not valid JSON yet; nothing is sent until it is.");
    }
  };
  return (
    <div>
      <textarea className="gp-ta mono" rows={def.multiline ? 8 : 4} value={text} placeholder={def.placeholder ?? '{"key": "value"}'} aria-label={def.label} aria-invalid={problem !== null} onChange={(e) => edit(e.target.value)} />
      <div className={problem ? "gp-hint bad" : "gp-hint"} role={problem ? "alert" : undefined}>{problem ?? "Enter valid JSON."}</div>
    </div>
  );
}

function Control({ def, state, model, onChange }: Pick<Props, "def" | "state" | "model" | "onChange">): JSX.Element | null {
  const v = state.value;
  switch (def.kind) {
    case "range": {
      const n = typeof v === "number" ? v : 0;
      const unit = def.unit ? ` ${def.unit}` : "";
      return (
        <>
          <div className="gp-range"><span>{def.min}{unit}</span><b>{shown(v, def.step)}{def.unit && <i>{def.unit}</i>}</b><span>{def.max}{unit}</span></div>
          <Slider readout={false} aria-label={def.label} min={def.min!} max={def.max!} step={def.step!} value={n} color="var(--w)" onChange={(value) => onChange({ value })} />
        </>
      );
    }
    case "integer":
      return <input type="number" className="gp-in mono" aria-label={def.label} min={def.min} max={def.max} step={def.step ?? 1} value={typeof v === "number" ? v : 0} onChange={(e) => { const n = parseInt(e.target.value, 10); if (Number.isFinite(n)) onChange({ value: n }); }} />;
    case "boolean":
      return (
        <div className="gp-send">
          <span>Send as: <b className={v ? "yes" : "no"}>{v ? "true" : "false"}</b></span>
          <ToggleSwitch on={!!v} onChange={(on) => onChange({ value: on })} />
        </div>
      );
    case "array": {
      const list = Array.isArray(v) ? v : [];
      return (
        <div>
          <textarea className="gp-ta mono" rows={def.multiline ? 6 : 3} aria-label={def.label} placeholder={def.placeholder ?? "Enter values, one per line..."} defaultValue={list.join("\n")}
            onChange={(e) => { const lines = e.target.value.split("\n").map((l) => l.trim()).filter(Boolean); onChange({ value: lines }); }} />
          {list.length > 0 && <div className="gp-hint">{list.length} {list.length === 1 ? "entry" : "entries"}</div>}
        </div>
      );
    }
    case "string":
      return <textarea className="gp-ta mono" rows={def.multiline ? 6 : 3} aria-label={def.label} placeholder={def.placeholder ?? "Enter text..."} value={typeof v === "string" ? v : ""} onChange={(e) => onChange({ value: e.target.value })} />;
    case "object":
      if (def.id === "logit_bias") return <LogitBiasManager entries={isRecord(v) && Array.isArray(v["entries"]) ? (v["entries"] as BiasEntry[]) : []} model={model} onChange={(entries) => onChange({ value: { entries } })} />;
      return <JsonBox def={def} value={v} onValue={(next) => onChange({ value: next })} />;
    case "select":
      return null;
  }
}

export function ParamCard({ def, state, provider, greyed, model, onChange }: Props): JSX.Element {
  const [info, setInfo] = useState(false);
  const refused = provider !== null && !provider.accepts.has(def.id);
  return (
    <div className={`gp-card${state.on && !greyed ? " on" : ""}${def.parentId ? " sub" : ""}${greyed ? " greyed" : ""}`} data-param={def.id}>
      <div className="gp-head">
        <div className="gp-id">
          <div className="gp-name">
            <label>{def.label}</label>
            <button type="button" className="gp-info" aria-label={`About ${def.label}`} aria-expanded={info} onMouseEnter={() => setInfo(true)} onMouseLeave={() => setInfo(false)} onFocus={() => setInfo(true)} onBlur={() => setInfo(false)} onClick={() => setInfo(!info)}><Ic name="mdi:information-outline" size={16} /></button>
          </div>
          {def.aliases && def.aliases.length > 0 && <div className="gp-key">{def.aliases.join(" · ")}</div>}
          {refused && <div className="gp-refused" data-part="scene.generation.not-sent">Not sent to {provider.label}</div>}
        </div>
        <ToggleSwitch on={state.on} onChange={(on) => onChange({ on })} />
      </div>
      {info && (
        <div className="gp-tip" role="note">{def.description}
          {def.notes && <div className="gp-note"><Ic name="mdi:lightbulb-outline" size={12} />{def.notes}</div>}
        </div>
      )}
      {state.on && <div className="gp-val"><Control def={def} state={state} model={model} onChange={onChange} /></div>}
    </div>
  );
}
