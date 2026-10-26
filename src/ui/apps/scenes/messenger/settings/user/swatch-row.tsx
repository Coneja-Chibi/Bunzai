/** A row whose control is the house colour picker: label and description at the left, the swatches under them. */
import type { JSX } from "react";
import { Button } from "../../../../../components/button";
import { SwatchRow, type SwatchChoice } from "../../../../../components/swatch-row";

export function SwatchSettingRow({ label, description, value, palette = [], onChange, onReset }: { label: string; description?: string; value: string | undefined; palette?: SwatchChoice[]; onChange(hex: string): void; onReset?(): void }): JSX.Element {
  return (
    <div className="msn-st-r msn-st-stack" data-part="scene.messenger.settings.row.swatch">
      <div className="msn-st-t"><b>{label}</b>{description ? <span>{description}</span> : null}</div>
      <SwatchRow palette={palette} allowCustom value={value} onChange={onChange} />
      {onReset && value ? <Button variant="quiet" size="sm" onClick={onReset} data-part="scene.messenger.settings.row.swatch.reset">Reset</Button> : null}
    </div>
  );
}
