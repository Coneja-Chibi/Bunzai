/**
 * Immutable JSON dot-path operations shared by canonical entity mutation authorities. Structural
 * equality (previously re-exported here as `jsonEqual`) is core/guards' `deepEq`; callers import it
 * directly.
 */
import { isRecord, recOr } from "../../core/guards";

const record = (value: unknown): Record<string, unknown> =>
  recOr(value);

/** Read one value from a JSON object by canonical dot path. */
export function readEntityPath(value: unknown, dotPath: string): unknown {
  let current: unknown = value;
  for (const key of dotPath.split(".")) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

/** Immutably write one JSON dot path, using the caller's domain-specific removal rule. */
export function writeEntityPath(
  value: Record<string, unknown>,
  dotPath: string,
  nextValue: unknown,
  remove: (candidate: unknown) => boolean,
): Record<string, unknown> {
  const keys = dotPath.split(".");
  const output: Record<string, unknown> = { ...value };
  let host = output;
  for (const key of keys.slice(0, -1)) {
    const next = { ...record(host[key]) };
    host[key] = next;
    host = next;
  }
  const leaf = keys.at(-1)!;
  if (remove(nextValue)) delete host[leaf];
  else host[leaf] = structuredClone(nextValue);
  return output;
}
