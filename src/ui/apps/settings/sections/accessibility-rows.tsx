/**
 * Settings > Appearance > Accessibility: interface text size, reduce motion and high contrast. The same three keys the Messenger You scope
 * writes (shell/accessibility.ts reads them and paints the page, so a change applies at once, in every app).
 */
import { useState, type JSX } from "react";
import { Slider } from "../../../components/slider";
import { SETTING_KEYS } from "../../../../studio/settings-shape";
import { Toggle } from "../../../components/button";
import { UI_TEXT, highContrastOf, reduceMotionOf, uiTextSizeOf } from "../../../_shared/accessibility-prefs";
import { SettingsRow } from "../section-contract";

type Prefs = { get(key: string): unknown; set(key: string, value: unknown): void };

export function AccessibilityRows({ prefs }: { prefs: Prefs }): JSX.Element {
  const [size, setSize] = useState(() => uiTextSizeOf(prefs.get(SETTING_KEYS.uiTextSize)));
  const [still, setStill] = useState(() => reduceMotionOf(prefs.get(SETTING_KEYS.uiReduceMotion)));
  const [contrast, setContrast] = useState(() => highContrastOf(prefs.get(SETTING_KEYS.uiHighContrast)));
  return (
    <>
      <SettingsRow label="Interface text size" hint="Never below 12 px.">
        <Slider aria-label="Interface text size" min={UI_TEXT.min} max={UI_TEXT.max} step={UI_TEXT.step} value={size} format={(v) => `${v} px`}
          onChange={(n) => { const v = uiTextSizeOf(n); prefs.set(SETTING_KEYS.uiTextSize, v); setSize(v); }} />
      </SettingsRow>
      <SettingsRow label="Reduce motion" hint="Turns off slides and the lift on buttons.">
        <Toggle on={still} label="Reduce motion" onChange={(v) => { prefs.set(SETTING_KEYS.uiReduceMotion, v); setStill(v); }} />
      </SettingsRow>
      <SettingsRow label="High contrast edges" hint="Stronger borders on rows and controls.">
        <Toggle on={contrast} label="High contrast edges" onChange={(v) => { prefs.set(SETTING_KEYS.uiHighContrast, v); setContrast(v); }} />
      </SettingsRow>
    </>
  );
}
