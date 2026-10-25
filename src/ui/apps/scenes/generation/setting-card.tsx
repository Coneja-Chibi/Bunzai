/**
 * One Core, Reasoning or thinking-switch card (RoleCall's SamplerRow, SamplerPanel.tsx:101-392): the label with its info
 * button, the aliases line, an enable switch (Core and Reasoning have none), and the value control for its
 * kind: a slider with its range, a number, a true/false switch or a select (the catalogue groups' cards are generation-params-card.tsx).
 * The value shows only while the card is on, as in RoleCall. Pure view: the section owns the value.
 */
import { useState, type JSX } from "react";
import type { ParamDef, ParamValue } from "../../../../stage/params";
import { Ic } from "../../../_shared/ic";
import { Slider } from "../../../components/slider";
import { ToggleSwitch } from "../../../components/toggle-switch";

export interface SettingCardProps {
  def: ParamDef;
  enabled: boolean;
  /** undefined: nothing is set, a provider decides. */
  value: ParamValue | null | undefined;
  /** False for Core and Reasoning, which are always on. */
  toggle?: boolean;
  options?: readonly { value: string; label: string }[];
  /** A sub-toggle: indented, greyed while its parent is off. */
  indent?: boolean;
  parentOn?: boolean;
  onToggle?(on: boolean): void;
  onChange(value: ParamValue | null): void;
}

const shown = (def: ParamDef, v: ParamValue | null | undefined): string =>
  typeof v !== "number" ? "Provider default" : v.toFixed((def.step ?? 1) < 0.01 ? 4 : Number.isInteger(def.step ?? 1) ? 0 : 2);

const text = (value: ParamValue | null | undefined): string => (typeof value === "string" ? value : "");

function Control({ def, value, options, onChange }: Pick<SettingCardProps, "def" | "value" | "options" | "onChange">): JSX.Element | null {
  const num = typeof value === "number" ? value : typeof def.default === "number" ? def.default : 0;
  switch (def.kind) {
    case "range": {
      return (
        <div className="gn-range">
          <div className="gn-rv"><span>{def.min}{def.unit ? ` ${def.unit}` : ""}</span><b>{shown(def, value)}</b><span>{def.max}{def.unit ? ` ${def.unit}` : ""}</span></div>
          <Slider readout={false} aria-label={`${def.label} slider`} min={def.min!} max={def.max!} step={def.step!} value={num} color="var(--w)" onChange={onChange} />
        </div>
      );
    }
    case "integer":
      return <input type="number" className="gn-in" aria-label={def.label} min={def.min} max={def.max} step={def.step ?? 1} value={typeof value === "number" ? value : ""} placeholder="Provider default" onChange={(e) => { const n = parseInt(e.target.value, 10); if (Number.isFinite(n)) onChange(n); }} />;
    case "boolean":
      return (
        <div className="gn-bool"><span>Send as: <b className={value ? "ok" : "no"}>{value ? "true" : "false"}</b></span>
          <ToggleSwitch on={!!value} size="sm" aria-label={`${def.label} value`} onChange={onChange} /></div>
      );
    case "select":
      return (
        <select className="gn-in gn-sel" aria-label={def.label} value={text(value) || String(def.default ?? "")} onChange={(e) => onChange(e.target.value)}>
          {(options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    default:
      return null;
  }
}

export function SettingCard({ def, enabled, value, toggle = true, options, indent, parentOn = true, onToggle, onChange }: SettingCardProps): JSX.Element {
  const [info, setInfo] = useState(false);
  return (
    <div className={`gn-card${enabled && parentOn ? " on" : ""}${indent ? " sub" : ""}${indent && !parentOn ? " dim" : ""}`} data-param={def.id}>
      <div className="gn-hd">
        <div>
          <div className="gn-name"><b>{def.label}</b>
            <button type="button" className="gn-i" aria-label={`About ${def.label}`} aria-expanded={info} onMouseEnter={() => setInfo(true)} onMouseLeave={() => setInfo(false)} onClick={() => setInfo(!info)}><Ic name="mdi:information-outline" size={14} /></button></div>
          {def.aliases && def.aliases.length > 0 && <div className="gn-key">{def.aliases.join(" · ")}</div>}
        </div>
        {toggle && <ToggleSwitch on={enabled} size="sm" aria-label={`Send ${def.label}`} onChange={(on) => onToggle?.(on)} />}
      </div>
      {info && <div className="gn-tip">{def.description}{def.notes && <div className="gn-note"><Ic name="mdi:lightbulb-outline" size={12} /> {def.notes}</div>}</div>}
      {enabled && <Control def={def} value={value} options={options} onChange={onChange} />}
    </div>
  );
}
