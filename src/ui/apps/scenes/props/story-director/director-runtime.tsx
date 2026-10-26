/**
 * The Director's runtime numbers, drawn once for the Props wing's settings block and the Control Booth's Narrator section so they are one control: DM Temperature and "Auto-retry invalid tool
 * responses". The automatic tracker update controls (plan 17) are in auto-update.tsx.
 * A number is held as text until it loses focus, then clamped and saved.
 */
import { useState, type JSX } from "react";
import { DIRECTOR_TEMPERATURE_MAX, type DirectorSettingsPatch } from "../../../../../stage/contracts/director-types";
import type { DirectorPanel } from "../../../../../studio/scene-director-edit";
import { Ic, type IconName } from "../../../../_shared/ic";
import { Toggle } from "../../../../components/button";

type Save = (patch: DirectorSettingsPatch) => Promise<string | null>;

/** A number the person types: held as text until it loses focus, then clamped to its range and saved. */
function NumberRow({ label, icon, title, value, min, max, step, unit, part, onCommit }: { label: string; icon: IconName; title: string; value: number; min: number; max: number; step: number; unit?: string; part?: string; onCommit(n: number): void }): JSX.Element {
  const [text, setText] = useState<string | null>(null);
  const commit = (): void => {
    const n = Number.parseFloat(text ?? "");
    setText(null);
    if (!Number.isNaN(n)) onCommit(Math.min(max, Math.max(min, step < 1 ? n : Math.round(n))));
  };
  return (
    <label className="ds-row" title={title} {...(part ? { "data-part": part } : {})}>
      <span><Ic name={icon} size={12} />{label}</span>
      <span><input type="number" aria-label={label} min={min} max={max} step={step} value={text ?? String(value)} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); }} />{unit && <small className="unit">{unit}</small>}</span>
    </label>
  );
}

export function RuntimeNumbers({ panel, save }: { panel: DirectorPanel; save: Save }): JSX.Element {
  const s = panel.settings;
  return (
    <>
      <div className="ds-pair">
        <NumberRow label="DM Temperature" icon="lucide:thermometer" title="Controls randomness for Story Director reasoning and tool decisions." value={s.temperature} min={0} max={DIRECTOR_TEMPERATURE_MAX} step={0.05} onCommit={(temperature) => void save({ temperature })} />
      </div>
    </>
  );
}

export function AutoRetryRow({ panel, save }: { panel: DirectorPanel; save: Save }): JSX.Element {
  const on = panel.settings.autoRetry;
  return (
    <div className="ds-row" title="Retries once when the model returns malformed tool data for Story Director. May add one extra model call.">
      <span><Ic name="lucide:refresh-cw" size={12} />Auto-retry invalid tool responses</span>
      <Toggle size="sm" on={on} aria-label={`${on ? "Disable" : "Enable"} auto-retry invalid tool responses`} onChange={(autoRetry) => void save({ autoRetry })} />
    </div>
  );
}
