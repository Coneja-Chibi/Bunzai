/**
 * Draws the rows of rows.ts with the settings row primitives (frames/settings-rows.tsx). A row owns no state of its own: it reads on every render and, since the app preferences are
 * not reactive, counts a write to draw again.
 */
import { useReducer, type JSX } from "react";
import { RadioCards, SelectRow, SliderRow, ToggleRow } from "../frames/settings-rows";
import type { RowDef, RowEnv } from "./rows";

function RowView({ row, env }: { row: RowDef; env: RowEnv }): JSX.Element {
  const [, again] = useReducer((n: number) => n + 1, 0);
  const copy = { label: row.label, ...(row.description ? { description: row.description } : {}) };
  switch (row.control) {
    case "toggle": return <ToggleRow {...copy} on={row.read(env)} onChange={(v) => { row.write(env, v); again(); }} />;
    case "slider": return <SliderRow {...copy} value={row.read(env)} min={row.min} max={row.max} step={row.step} {...(row.unit ? { unit: row.unit } : {})} onChange={(v) => { row.write(env, v); again(); }} />;
    case "select": return <SelectRow {...copy} value={row.read(env)} options={row.options} onChange={(v) => { row.write(env, v); again(); }} />;
    case "radios": return <RadioCards label={row.label} value={row.read(env)} options={row.options} onChange={(v) => { row.write(env, v); again(); }} />;
  }
}

/** A section body made of rows. */
export function RowList({ rows, env }: { rows: readonly RowDef[]; env: RowEnv }): JSX.Element {
  return <div data-part="scene.messenger.settings.rows">{rows.map(/* bounded-ok: fixed registry of panels / settings / props / platforms */ (r) => <RowView key={r.id} row={r} env={env} />)}</div>;
}
