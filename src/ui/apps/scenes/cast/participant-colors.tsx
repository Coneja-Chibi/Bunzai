/**
 * The Colors control of a participant row (RoleCall ColorEditor, ParticipantRegistryPanel.tsx:524-612): up to three stops (a gradient
 * from the second), "+ Gradient", Clear. It works only while the Dialogue Colors prop is on, as RoleCall's works only while Character
 * Voices colours are, and says so.
 */
import type { JSX } from "react";
import { SwatchRow } from "../../../components/swatch-row";
import { pickPaletteHex } from "../../../../core/participants/palette";
import type { RosterRow } from "../../../../core/participants/roster";

export function ColorEditor({ row, enabled, onColors }: { row: RosterRow; enabled: boolean; onColors(colors: string[] | null): void }): JSX.Element {
  // A participant with none shows one stop to start from, as RoleCall's editor does.
  const colors = (row.shown.length > 0 ? row.shown : [pickPaletteHex(row.id)]);
  const hint = enabled ? undefined : "Turn on Dialogue Colors in Props to edit participant colors";
  const setAt = (i: number, c: string): void => onColors(colors.map((x, j) => (j === i ? c : x)));
  return (
    <div className="colors">
      <div className={`box${enabled ? "" : " off"}`} title={hint}>
        Colors
        {colors.map((c, i) => (enabled
          ? <SwatchRow key={i} palette={[]} allowCustom value={c} onChange={(hex) => setAt(i, hex)} />
          : <span key={i} className="stop" style={{ background: c }} title={hint} />))}
        {colors.length < 3 && <button type="button" disabled={!enabled} title={enabled ? "Add gradient stop" : hint} onClick={() => onColors([...colors, colors[colors.length - 1]!])}>+ Gradient</button>}
        {row.colors.length > 0 && <button type="button" disabled={!enabled} title={enabled ? "Clear participant color" : hint} onClick={() => onColors(null)}>Clear</button>}
      </div>
      {!enabled && <small>Colors apply when Dialogue Colors is on.</small>}
    </div>
  );
}
