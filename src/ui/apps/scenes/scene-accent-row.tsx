/**
 * The Stage wing's Scene accent row (RoleCall's accent source picker in its Stage settings panel, StageSettingsPanel.tsx:2146-2220):
 * which colour the replies and the scene chrome wear. A source with no colour is shown but cannot be picked; Custom opens
 * the house SwatchRow's custom picker below the chips. Saved to the app preferences the moment it is picked, like the switches above it.
 */
import type { JSX } from "react";
import { Chip } from "../../components/button";
import { SwatchRow } from "../../components/swatch-row";
import { ACCENT_CUSTOM_KEY, ACCENT_SOURCE_KEY, ACCENT_SOURCES, accentSourceAvailable, accentSourceOf, sceneAccentHex, type AccentSource, type PieceColors } from "./scene-accent-core";

const LABELS: Record<AccentSource, { name: string; hint: string }> = {
  character: { name: "Character", hint: "The character's own colour." },
  persona: { name: "Persona", hint: "Your persona's colour." },
  profile: { name: "Profile", hint: "Your accent from Settings." },
  custom: { name: "Custom", hint: "A colour you pick for every scene." },
};

export function AccentRow({ prefs, colors, onSet }: { prefs: { get(key: string): unknown }; colors: PieceColors; onSet(key: string, value: unknown): void }): JSX.Element {
  const source = accentSourceOf(prefs.get(ACCENT_SOURCE_KEY));
  const custom = prefs.get(ACCENT_CUSTOM_KEY);
  return (
    <section className="pg-card" aria-label="Chat Accent Color">
      <div className="pg-label"><span>Chat Accent Color</span></div>
      <div className="pg-chips">
        {ACCENT_SOURCES.map((s) => {
          const available = accentSourceAvailable(s, colors);
          return <Chip key={s} pressed={source === s} disabled={!available} title={available ? LABELS[s].hint : `${LABELS[s].hint} It has no colour yet.`} onClick={() => onSet(ACCENT_SOURCE_KEY, s)}>{LABELS[s].name}</Chip>;
        })}
      </div>
      <p className="pg-help">{LABELS[source].hint} It tints the replies, the composer and the scene's panels.</p>
      {source === "custom" && <SwatchRow palette={[]} allowCustom value={sceneAccentHex("custom", colors, custom) ?? colors.character} onChange={(hex) => onSet(ACCENT_CUSTOM_KEY, hex)} />}
    </section>
  );
}
