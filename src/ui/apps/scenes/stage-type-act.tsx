/**
 * The Type act (RoleCall's "The Type", StageSettingsPanel.tsx:1940-2110): text size, message font, the three text colours and line
 * spacing. The faces are bundled (src/ui/theme/fonts); the colours use the house SwatchRow, which commits whole colours only (F6).
 * Each control takes effect through the scene root (stage-look-core.ts lookRoot, stage-look-style.ts).
 */
import { Card } from "../../components/button";
import type { JSX } from "react";
import { SwatchRow } from "../../components/swatch-row";
import { Field, ResetLink, SliderField } from "./stage-controls";
import { LIMITS, LOOK_DEFAULTS, LOOK_FONTS, type StageLook } from "./stage-look-core";
import type { StageActProps } from "./stage-message-act";

const COLORS = [
  { key: "colorChar", caption: "Character" },
  { key: "colorUser", caption: "User" },
  { key: "colorDialogue", caption: "Dialogue" },
] as const;

/** `accent` is the colour the Dialogue picker starts from: the scene accent (RoleCall started it from a fixed violet, F5). */
export function TypeAct({ look, set, accent }: StageActProps & { accent: string }): JSX.Element {
  const d = LOOK_DEFAULTS;
  return (
    <>
      <SliderField icon="mdi:format-size" label="Message Text Size" caption="Font Size" value={look.size} limits={LIMITS.size} format={(v) => `${v}px`}
        help="Message text size only." changed={look.size !== d.size} onChange={(v) => set("size", v)} onReset={() => set("size", null)} />
      <Field icon="mdi:format-font" label="Message Font" help="Font used for message text (does not affect UI elements)">
        <div className="sa-fonts" role="group" aria-label="Message Font">
          {LOOK_FONTS.map((f) => (
            <Card key={f.id} data-part="scene.stage.font" kind="choice" selected={look.font === f.id} aria-pressed={look.font === f.id} onClick={() => set("font", f.id)}
              heading={<span style={f.stack ? { fontFamily: f.stack } : undefined}><span className="nm">{f.label}</span>{"note" in f && <span className="nt">{f.note}</span>}</span>}
              subtitle={<span style={f.stack ? { fontFamily: f.stack } : undefined}>The quick brown fox</span>} />
          ))}
        </div>
      </Field>
      <Field icon="mdi:format-color-text" label="Message Text Color" help="Character and user colors set narration. Dialogue changes quoted character speech; reset it to use accent and per-speaker colors.">
        <div className="sa-colors">
          {COLORS.map((c) => <ColorRow key={c.key} caption={c.caption} value={look[c.key]} start={c.key === "colorDialogue" ? accent : "var(--stage-card)"} onChange={(hex) => set(c.key, hex)} onReset={() => set(c.key, null)} />)}
        </div>
      </Field>
      <SliderField icon="mdi:format-line-spacing" label="Line Spacing" caption="Height" value={look.lineHeight} limits={LIMITS.lineHeight} format={(v) => `${v.toFixed(1)}x`}
        help="Controls spacing between lines of text (1.0 = tight, 2.0 = spacious)" changed={look.lineHeight !== d.lineHeight} onChange={(v) => set("lineHeight", v)} onReset={() => set("lineHeight", null)} />
    </>
  );
}

function ColorRow({ caption, value, start, onChange, onReset }: { caption: string; value: StageLook["colorChar"]; start: string; onChange(hex: string): void; onReset(): void }): JSX.Element {
  return (
    <div className="sa-color">
      <span className="cp">{caption}</span>
      <SwatchRow palette={[]} allowCustom value={value ?? start} onChange={onChange} />
      <span className="hx">{value ?? "Auto"}</span>
      {value && <ResetLink onClick={onReset} />}
    </div>
  );
}
