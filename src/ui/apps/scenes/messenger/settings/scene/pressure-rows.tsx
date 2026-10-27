/**
 * The Memory page's Context Pressure rows: the meter's Warning, Danger and Critical marks and its target (prefs `context.thresholds`, `context.target`, as the Lore state view writes them: same ranges, same
 * fail-closed reads). The app preferences are not reactive, so a write draws the rows again. The Prompt Inspector switch is on the Writing page (writing.tsx) beside the Tools menu's own.
 */
import { useReducer, type JSX } from "react";
import { parseTarget, parseThresholds, TARGET_KEY, TARGET_RANGE, THRESHOLD_RANGES, THRESHOLDS_KEY } from "../../../context/pressure-core";
import { SliderRow } from "../../frames/settings-rows";
import type { WingArgs } from "../../wing-props";
import { SavedNumber } from "./saved";

const MARKS = [{ id: "warning", label: "Warning mark" }, { id: "danger", label: "Danger mark" }, { id: "critical", label: "Critical mark" }] as const;

export function PressureRows({ a }: { a: WingArgs }): JSX.Element {
  const { prefs } = a.ctx;
  const [, again] = useReducer((n: number) => n + 1, 0);
  const marks = parseThresholds(prefs.get(THRESHOLDS_KEY));
  const target = parseTarget(prefs.get(TARGET_KEY));
  return (
    <>
      {MARKS.map(/* bounded-ok: three fixed meter marks */ (m) => (
        <SliderRow key={m.id} label={m.label} description="Percent of the context used where the meter changes colour." value={marks[m.id]} min={THRESHOLD_RANGES[m.id][0]} max={THRESHOLD_RANGES[m.id][1]} step={1} unit="%"
          onChange={(n) => { prefs.set(THRESHOLDS_KEY, { ...marks, [m.id]: n }); again(); }} />
      ))}
      <SavedNumber label="Context target" description="Tokens the meter measures against instead of the model's window. 0 follows the model; a smaller number than 1,024 is not saved." saved={target ?? 0} min={0} max={TARGET_RANGE[1]} step={1024}
        write={(n) => { if (n === 0) prefs.set(TARGET_KEY, null); else if (parseTarget(n) !== null) prefs.set(TARGET_KEY, n); again(); }} />
    </>
  );
}
