/**
 * The Colors control of a participant row (RoleCall ColorEditor, ParticipantRegistryPanel.tsx:524-612): up to three stops (a gradient
 * from the second), "+ Gradient", Clear. It works only while the Dialogue Colors prop is on, as RoleCall's works only while Character
 * Voices colours are, and says so.
 */
import type { JSX } from "react";
import { SwatchRow, type SwatchChoice } from "../../../components/swatch-row";
import { Button } from "../../../components/button";
import { DIALOGUE_PALETTE, pickPaletteHex } from "../../../../core/participants/palette";
import type { RosterRow } from "../../../../core/participants/roster";

/** Six quick picks from the dialogue palette (the Messenger profile card passes them; the Full Chat row keeps its custom-only swatch). */
export const SIX_SWATCHES: SwatchChoice[] = DIALOGUE_PALETTE.slice(0, 6).map((p) => ({ id: p.id, label: p.id, hex: p.hex }));

export function ColorEditor({ row, enabled, onColors, palette = [] }: { row: RosterRow; enabled: boolean; onColors(colors: string[] | null): void; palette?: SwatchChoice[] }): JSX.Element {
  // A participant with none shows one stop to start from, as RoleCall's editor does.
  const colors = (row.shown.length > 0 ? row.shown : [pickPaletteHex(row.id)]);
  const hint = enabled ? undefined : "Turn on Dialogue Colors in Props to edit participant colors";
  const setAt = (i: number, c: string): void => onColors(colors.map((x, j) => (j === i ? c : x)));
  return (
    <div className="colors">
      <div className={`box${enabled ? "" : " off"}`} title={hint}>
        Colors
        {colors.map((c, i) => (enabled
          ? <SwatchRow key={i} palette={palette} allowCustom value={c} onChange={(hex) => setAt(i, hex)} />
          : <span key={i} className="stop" style={{ background: c }} title={hint} />))}
        {colors.length < 3 && <Button variant="quiet" size="sm" disabled={!enabled} title={enabled ? "Add gradient stop" : hint} onClick={() => onColors([...colors, colors[colors.length - 1]!])}>+ Gradient</Button>}
        {row.colors.length > 0 && <Button variant="quiet" size="sm" disabled={!enabled} title={enabled ? "Clear participant color" : hint} onClick={() => onColors(null)}>Clear</Button>}
      </div>
      {!enabled && <small>Colors apply when Dialogue Colors is on.</small>}
    </div>
  );
}
