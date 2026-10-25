/**
 * The Message act (RoleCall's "The Message", StageSettingsPanel.tsx:1800-1940): bubble opacity, message spacing, avatars and timestamps.
 * RoleCall's Bubble Style, Layout, Header Size and Grouped Alignment are the theme's here (scene.message and scene.layout variants;
 * Grouped Alignment is dead in RoleCall, F3), so the act's status names the variants the theme picked.
 */
import type { JSX } from "react";
import { SHOW_TIMESTAMPS_KEY, showTimestamps } from "./scene-meta-core";
import { LIMITS, LOOK_DEFAULTS } from "./stage-look-core";
import { SliderField, SwitchRow, type LookProps } from "./stage-controls";

export interface StageActProps extends LookProps { prefs: { get(key: string): unknown }; onSet(key: string, value: unknown): void }

export function MessageAct({ look, set, prefs, onSet }: StageActProps): JSX.Element {
  const d = LOOK_DEFAULTS;
  return (
    <>
      <SliderField icon="mdi:opacity" label="Message Bubble Opacity" caption="Opacity" value={look.opacity} limits={LIMITS.opacity} format={(v) => `${Math.round(v * 100)}%`}
        help="Controls how see-through message bubbles and borders are (100% = default)" changed={look.opacity !== d.opacity} onChange={(v) => set("opacity", v)} onReset={() => set("opacity", null)} />
      <SliderField icon="lucide:space" label="Message Spacing" caption="Gap" value={look.gap} limits={LIMITS.gap} format={(v) => `${v}px`}
        help="Extra vertical space between messages (0 = default spacing)" changed={look.gap !== d.gap} onChange={(v) => set("gap", v)} onReset={() => set("gap", null)} />
      <div className="sa-sws">
        <SwitchRow icon="mdi:account-circle" name="Show Avatars" tone="var(--stage-ok)" on={look.avatars} onChange={(on) => set("avatars", on)} />
        <SwitchRow icon="mdi:clock-outline" name="Show Timestamps" tone="var(--stage-ok)" on={showTimestamps(prefs.get(SHOW_TIMESTAMPS_KEY))} onChange={(on) => onSet(SHOW_TIMESTAMPS_KEY, on)} />
      </div>
    </>
  );
}
