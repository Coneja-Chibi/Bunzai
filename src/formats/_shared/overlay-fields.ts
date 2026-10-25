/** Compare canonical values with the values recovered from a raw format twin. */
import { deepEq } from "../../core/guards";

type Field<C extends object> = keyof C | readonly (keyof C)[];
type Rule<C extends object> = readonly [Field<C>, () => void];

/** Whether a canonical field needs to be written over its representable twin value. */
export function overlayChanged(canonical: unknown, twin: unknown): boolean {
  return !deepEq(canonical, twin);
}

/** Run each dialect writer only when its canonical field differs from the decoded twin. */
export function overlayFields<C extends object>(
  canonical: C,
  decoded: C | null | undefined,
  rules: readonly Rule<C>[],
): void {
  for (const [fields, write] of rules) {
    const keys: readonly (keyof C)[] = Array.isArray(fields)
      ? fields as readonly (keyof C)[]
      : [fields as keyof C];
    if (decoded && keys.every((key) => !overlayChanged(canonical[key], decoded[key]))) continue;
    write();
  }
}
