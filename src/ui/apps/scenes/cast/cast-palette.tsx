/**
 * The Cast wing's one colour component (both tabs): swatches with their name under each and a small LABEL
 * caption (Hair, Eyes, Skin...), RoleCall's PersonaColorPalette. `NamedSwatches` draws the named colours and the
 * signature one (larger, starred, "Signature"); `ThemeSwatches` draws the one to three theme colours with the
 * gradient bar. A swatch opens the house ColorPicker below the row (in flow, so a scroll area never clips it).
 * New swatches start on a resolved house colour (entity data must never hold a CSS variable).
 */
import { useState, type JSX } from "react";
import { ColorPicker } from "../../../components/color-picker";
import { Button, IconButton, Tile as SwatchTile } from "../../../components/button";
import { normalizeHex } from "../../../_shared/color-math";
import { Ic } from "../../../_shared/ic";
import { resolveCssColor } from "../../../_shared/css-color";

export interface NamedSwatch { label?: string; name?: string; hex: string }

const fresh = (): string => resolveCssColor("var(--deck-lorebook)");

function Tile({ hex, label, on, big, onToggle }: { hex: string; label: string; on: boolean; big?: boolean; onToggle(): void }): JSX.Element {
  return <SwatchTile kind="swatch" size={big ? "lg" : "md"} color={hex} label={label} selected={on} aria-expanded={on} onClick={onToggle} />;
}

function Picker({ hex, onPick, onDone }: { hex: string; onPick(hex: string): void; onDone(): void }): JSX.Element {
  return (
    <div className="cw-pick" data-part="scene.cast.picker.color">
      {/* eslint-disable-next-line no-restricted-syntax -- rendered only while its swatch is open (open-gated), as the Workbench palette does */}
      <ColorPicker value={normalizeHex(hex) ?? hex} onChange={onPick} />
      <Button size="sm" onClick={onDone}>Done</Button>
    </div>
  );
}

export function NamedSwatches({ value, onChange, signature, onSignature, signatureCaption, lockSignatureName }: {
  value: readonly NamedSwatch[];
  onChange(next: NamedSwatch[]): void;
  /** the signature swatch, drawn first and larger; absent where the tab keeps it elsewhere */
  signature?: { hex: string; name: string };
  onSignature?(next: { hex: string; name: string }): void;
  signatureCaption?: string;
  /** the signature's name is a fixed word (the Character tab's "Theme"), not a field */
  lockSignatureName?: boolean;
}): JSX.Element {
  const [open, setOpen] = useState<number | "sig" | null>(null);
  const toggle = (k: number | "sig"): void => setOpen(open === k ? null : k);
  const set = (i: number, patch: Partial<NamedSwatch>): void => onChange(value.map((s, at) => (at === i ? { ...s, ...patch } : s)));
  const move = (i: number, by: -1 | 1): void => {
    const to = i + by;
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    [next[i], next[to]] = [next[to]!, next[i]!];
    onChange(next);
    setOpen(null);
  };
  const current = open === "sig" ? signature?.hex : open === null ? undefined : value[open]?.hex;
  return (
    <div className="cw-colors">
      <div className="cw-swatches" data-part="scene.cast.swatches">
        {signature && onSignature && (
          <div className="cw-sw cw-sig">
            <span className="cw-hold"><Tile big hex={signature.hex} label="Signature color" on={open === "sig"} onToggle={() => toggle("sig")} /><i><Ic name="lucide:star" size={10} /></i></span>
            {lockSignatureName
              ? <span className="cw-nm">{signature.name}</span>
              : <input className="cw-nm" value={signature.name} placeholder="Name" aria-label="Signature color name" onChange={(e) => onSignature({ ...signature, name: e.target.value })} />}
            <span className="cw-lab gold">{signatureCaption ?? "Signature"}</span>
          </div>
        )}
        {value.map((s, i) => (
          <div className="cw-sw" key={i}>
            <span className="cw-hold">
              <Tile hex={s.hex} label={`${s.label || s.name || "Color"} swatch`} on={open === i} onToggle={() => toggle(i)} />
              <IconButton variant="quiet" size="sm" icon="lucide:x" label={`Remove ${s.label || s.name || "color"}`} onClick={() => { setOpen(null); onChange(value.filter((_, at) => at !== i)); }} />
            </span>
            <input className="cw-nm" value={s.name ?? ""} placeholder="Name" aria-label={`Name of ${s.label || "color"} ${i + 1}`} onChange={(e) => set(i, { name: e.target.value })} />
            <input className="cw-lab" value={s.label ?? ""} placeholder="Label" aria-label={`Label of color ${i + 1}`} onChange={(e) => set(i, { label: e.target.value })} />
            <span className="cw-ar">
              <IconButton variant="quiet" size="sm" label="Move left" icon="lucide:chevron-left" disabled={i === 0} onClick={() => move(i, -1)} />
              <IconButton variant="quiet" size="sm" label="Move right" icon="lucide:chevron-right" disabled={i === value.length - 1} onClick={() => move(i, 1)} />
            </span>
          </div>
        ))}
        <div className="cw-sw cw-add">
          <SwatchTile kind="add" label="Add a color" onClick={() => onChange([...value, { hex: fresh() }])} />
          <span className="cw-nm">Add</span>
        </div>
      </div>
      {open !== null && current !== undefined && (
        <Picker hex={current} onDone={() => setOpen(null)}
          onPick={(hex) => (open === "sig" ? signature && onSignature?.({ ...signature, hex }) : set(open, { hex }))} />
      )}
    </div>
  );
}

export function ThemeSwatches({ value, onChange, max = 3 }: { value: readonly string[]; onChange(next: string[]): void; max?: number }): JSX.Element {
  const [open, setOpen] = useState<number | null>(null);
  const css = value.length < 2 ? value[0] ?? "transparent" : `linear-gradient(90deg, ${value.join(", ")})`;
  return (
    <div className="cw-theme" data-part="scene.cast.theme">
      <div className="cw-swatches row">
        {value.map((hex, i) => (
          <span className="cw-sw" key={i}>
            <span className="cw-hold">
              <Tile hex={hex} label={`Theme color ${i + 1}`} on={open === i} onToggle={() => setOpen(open === i ? null : i)} />
              {value.length > 1 && <IconButton variant="quiet" size="sm" icon="lucide:x" label={`Remove theme color ${i + 1}`} onClick={() => { setOpen(null); onChange(value.filter((_, at) => at !== i)); }} />}
            </span>
          </span>
        ))}
        {value.length < max && <SwatchTile kind="add" label="Add a theme color" onClick={() => onChange([...value, fresh()])} />}
      </div>
      <div className="cw-gbar" style={{ background: css }} aria-hidden="true" />
      {open !== null && value[open] !== undefined && <Picker hex={value[open]!} onDone={() => setOpen(null)} onPick={(h) => onChange(value.map((x, at) => (at === open ? h : x)))} />}
    </div>
  );
}
