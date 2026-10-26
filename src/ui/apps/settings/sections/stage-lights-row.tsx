/** Settings > Appearance > Stage lights: Moving, Still or Off for the rays on the title screen and the scene chooser (nowhere else has them). */
import { useState, type JSX } from "react";
import { SETTING_KEYS, stageLightsOf, type StageLights } from "../../../../studio/settings-shape";
import { SegControl, SettingsRow } from "../section-contract";

type Prefs = { get(key: string): unknown; set(key: string, value: unknown): void };

const OPTIONS: { value: StageLights; label: string }[] = [{ value: "moving", label: "Moving" }, { value: "still", label: "Still" }, { value: "off", label: "Off" }];

export function StageLightsRow({ prefs }: { prefs: Prefs }): JSX.Element {
  const [mode, setMode] = useState(() => stageLightsOf(prefs.get(SETTING_KEYS.uiStageLights)));
  return (
    <SettingsRow label="Stage lights" hint="The light rays on the title screen and the scene chooser. Moving animates them, Still draws one frame, Off draws none. Reduce motion turns Moving into Still.">
      <SegControl label="Stage lights" options={OPTIONS} current={mode} onPick={(v) => { prefs.set(SETTING_KEYS.uiStageLights, v); setMode(v); }} />
    </SettingsRow>
  );
}
