/**
 * The Context Pressure meter (RoleCall `DebugWingPanelV2.tsx` ContextPressureMeter): "Context Pressure" and its percent, a four-segment bar with a mark at each threshold, the
 * "~estimate -> actual / limit" line and "N remaining", the note for a window the connection did not state, and a gear that opens the Warning / Danger / Critical sliders and
 * the Context Target box. Every figure is pressure-core.ts's, from the request the assembler counted; the marks and the target are per-viewer prefs. RoleCall's glow and
 * shimmer are dropped, the fill is one flat level colour.
 */
import { useState, type CSSProperties, type JSX } from "react";
import { Ic } from "../../../_shared/ic";
import { Button, IconButton } from "../../../components/button";
import { Slider } from "../../../components/slider";
import { THRESHOLD_RANGES, TARGET_RANGE, parseTarget, type Level, type Meter, type Thresholds } from "./pressure-core";

const TONE: Record<Level, string> = { healthy: "var(--stage-ok)", warning: "var(--stage-warn)", danger: "var(--stage-danger-text)", critical: "var(--stage-danger-hot)" };
const SLIDERS: { id: keyof Thresholds; label: string }[] = [{ id: "warning", label: "Warning" }, { id: "danger", label: "Danger" }, { id: "critical", label: "Critical" }];

export function Pressure({ meter, thresholds, target, onThresholds, onTarget }: {
  meter: Meter; thresholds: Thresholds; target: number | null; onThresholds(t: Thresholds): void; onTarget(n: number | null): void;
}): JSX.Element {
  const [gear, setGear] = useState(false);
  // The box keeps what is typed; only a whole number inside the range is saved, so typing 16384 does not lose its first digit.
  const [draft, setDraft] = useState(target === null ? "" : String(target));
  const type = (text: string): void => { setDraft(text); const n = parseTarget(Number(text)); if (text === "") onTarget(null); else if (n !== null) onTarget(n); };
  const tone = { "--lv": TONE[meter.level] } as CSSProperties;
  return (
    <div className={`ps ${meter.level}`} style={tone} data-part="scene.context.pressure">
      <div className="ps-top">
        <span>Context Pressure{meter.level !== "healthy" && <Ic name="lucide:triangle-alert" size={12} />}</span>
        <span className="ps-pct">{meter.percent}%
          <IconButton variant="quiet" size="sm" label="Thresholds" icon="lucide:settings" aria-expanded={gear} onClick={() => setGear(!gear)} />
        </span>
      </div>
      <div className="ps-bar" role="meter" aria-valuenow={meter.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Context pressure">
        <i style={{ width: `${Math.min(meter.percent, 100)}%` }} />
        {SLIDERS.map((s) => <b key={s.id} className={s.id} style={{ left: `${thresholds[s.id]}%` }} />)}
      </div>
      <div className="ps-stats">
        <span>{meter.actual !== undefined ? <>~{meter.estimate.toLocaleString()} → <em>{meter.actual.toLocaleString()}</em></> : <>~{meter.estimate.toLocaleString()}</>} / {meter.limit.toLocaleString()}</span>
        <span className={meter.remaining < 500 ? "low" : meter.remaining < 1000 ? "mid" : undefined} title={meter.target ? undefined : "after the reply's reserve"}>{meter.remaining.toLocaleString()} remaining</span>
      </div>
      {!meter.windowStated && !meter.target && <p className="ps-note">Context limit not stated by this model: using the default window. Set it in the preset's Context tokens.</p>}
      {gear && (
        <div className="ps-gear">
          <small>Thresholds</small>
          {SLIDERS.map((s) => (
            <label key={s.id} className={s.id}>
              <span>{s.label}</span>
              <Slider readout={false} min={THRESHOLD_RANGES[s.id][0]} max={THRESHOLD_RANGES[s.id][1]} value={thresholds[s.id]} aria-label={`${s.label} threshold`} color="currentColor" onChange={(n) => onThresholds({ ...thresholds, [s.id]: n })} />
              <output>{thresholds[s.id]}%</output>
            </label>
          ))}
          <small>Context Target</small>
          <div className="ps-target">
            <input type="number" min={TARGET_RANGE[0]} max={TARGET_RANGE[1]} step={1024} aria-label="Context Target" placeholder="Auto (this model's window)" value={draft} onChange={(e) => type(e.target.value)} />
            {target !== null && <Button variant="quiet" size="sm" onClick={() => type("")}>Reset</Button>}
          </div>
          {target !== null && <p className="ps-watch">Watching {target.toLocaleString()} tokens instead of this model's window</p>}
        </div>
      )}
    </div>
  );
}
