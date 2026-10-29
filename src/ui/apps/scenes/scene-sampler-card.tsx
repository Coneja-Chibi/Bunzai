/**
 * One sampler as RoleCall draws it (PresetPanel.tsx:2859-3030 SamplerSlider): a card holding the label with its own-value dot and a "?" that opens
 * the help, the coloured value (click it to type one, Enter keeps it held to the range and step, Escape drops it), and the slider. Bunzai adds the
 * preset's own value, struck through, as the way back when the scene has changed this one. `plain` is the Control Booth's QuickSlider
 * (QuickPlayPanel.tsx:439-498): the label and the value as text, no help and no typing.
 */
import { useState, type CSSProperties, type JSX, type ReactNode } from "react";
import { isEscapeClose } from "../../_shared/use-escape-key";
import { Slider } from "../../components/slider";
import { commitSampler, formatQuickSampler, formatSampler } from "./preset-core";
import { Button, IconButton, InlineValue } from "../../components/button";

export interface SamplerCardProps {
  label: string;
  /** The colour of the value and the slider (a CSS colour value). */
  tone: string;
  value: number | undefined;
  /** Where the handle rests when nothing sets a value. */
  unset: number;
  min: number;
  max: number;
  step: number;
  help?: string;
  plain?: boolean;
  /** Whether this scene, not the preset, holds the value. */
  own: boolean;
  /** The preset's value as text, offered as the way back when the scene holds its own. */
  back?: string;
  onSet(value: number): void;
  onBack?(): void;
  /** Rides above the label row inside the card (RoleCall hosts the Tokens/Messages switch this way). */
  header?: ReactNode;
  footer?: ReactNode;
}

export function SamplerCard(p: SamplerCardProps): JSX.Element {
  const [helping, setHelping] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const finish = (keep: boolean): void => {
    const typed = Number.parseFloat(draft ?? "");
    setDraft(null);
    if (keep && Number.isFinite(typed)) p.onSet(commitSampler(typed, p.min, p.max, p.step));
  };
  return (
    <div className={`sl${p.plain ? " plain" : ""}`} style={{ "--c": p.tone } as CSSProperties}>
      {p.header && <div className="slhd">{p.header}</div>}
      <div className="slh">
        <span>{p.label}{p.own && <i className="ov" title="This scene's own value" />}{p.help && !p.plain && (
          <IconButton variant="quiet" size="sm" icon="lucide:circle-question-mark" label="Help" aria-expanded={helping} onClick={() => setHelping(!helping)} />
        )}</span>
        {p.own && p.back !== undefined && <Button variant="link" size="sm" title={`Back to the preset's ${p.back}`} onClick={p.onBack}>{p.back}</Button>}
        {p.plain ? (
          <span className="slv">{p.value === undefined ? "-" : formatQuickSampler(p.value, p.step)}</span>
        ) : draft !== null ? (
          <input type="number" className="slv-in" autoFocus value={draft} min={p.min} max={p.max} step={p.step} aria-label={`${p.label} value`}
            onChange={(e) => setDraft(e.target.value)} onBlur={() => finish(true)}
            onKeyDown={(e) => { if (e.key === "Enter") finish(true); else if (isEscapeClose(e.nativeEvent)) finish(false); }} />
        ) : (
          <InlineValue title="Click to type a value" onClick={() => setDraft(String(p.value ?? p.unset))}>{p.value === undefined ? "-" : formatSampler(p.value, p.step)}</InlineValue>
        )}
      </div>
      {helping && p.help && <div className="slhelp">{p.help}</div>}
      <Slider readout={false} min={p.min} max={p.max} step={p.step} value={p.value ?? p.unset} aria-label={p.label} color={p.tone} onChange={p.onSet} />
      {p.footer && <div className="slf">{p.footer}</div>}
    </div>
  );
}
