/**
 * NumberInput - a number field that can be empty: blank is `undefined` (open, not zero), anything else is the number typed. A half-typed value
 * the browser cannot read as a number reads as blank, so the draft never holds NaN. Built on the shared Input, so it looks like every field.
 */
import type { InputHTMLAttributes, JSX } from "react";
import { Input } from "../rc-controls";

export function NumberInput({ value, onChange, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | undefined;
  onChange(next: number | undefined): void;
}): JSX.Element {
  return (
    <Input {...rest} type="number" inputMode="decimal" value={value === undefined ? "" : String(value)}
      onChange={(e) => { const typed = e.target.value.trim() === "" ? Number.NaN : Number(e.target.value); onChange(Number.isFinite(typed) ? typed : undefined); }} />
  );
}
