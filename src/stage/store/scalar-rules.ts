/**
 * The scalar checks every store rules module shares: a whole number inside bounds, and a message's hide
 * flag. They live apart from chat-rules.ts (which re-uses them) so the small rules modules can ask them
 * without reaching into the big one, and so no module keeps its own idea of "a whole number".
 */
import { isPlainObject } from "../../core/guards";
import { StudioValidationError } from "../../studio/errors";

/**
 * THE whole-number test of the store rules: a safe integer from `min` to `max` (ends included). Every
 * rules module asks it here, so a bound never quietly differs between one check and the next.
 */
export const isWhole = (value: unknown, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;

/** `value` when it is a whole number from `min` to `max`, else a validation error saying `message`. */
export function checkWhole(value: unknown, message: string, min?: number, max?: number): number {
  if (!isWhole(value, min, max)) throw new StudioValidationError(message);
  return value;
}

/** `value` when it is a finite number from `min` to `max` (ends included, fractions allowed), else a validation error saying `message`. */
export function checkNumber(value: unknown, message: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new StudioValidationError(message);
  return value;
}

/** An object carrying only the named fields: a misspelt one is refused, never dropped. */
export function onlyKeys(value: unknown, allowed: readonly string[], what: string): Record<string, unknown> {
  if (!isPlainObject(value)) fail(`${what} must be an object`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${what} has an unknown field: ${key}`);
  return value;
}

/** A message's hide flag (rule 30): true or false, a validation error otherwise so every door answers it the same way. */
export function checkHidden(value: unknown): boolean {
  if (typeof value !== "boolean") throw new StudioValidationError("hidden must be true or false");
  return value;
}

/** Refuses with a validation error; every rules module fails the same way. */
export function fail(message: string): never {
  throw new StudioValidationError(message);
}

/** True for JSON exactly, so what a store keeps as text is what it hands back. */
export function isJson(value: unknown, seen: Set<object> = new Set()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  // -0 is not JSON: it comes back as 0.
  if (typeof value === "number") return Number.isFinite(value) && !Object.is(value, -0);
  if (typeof value !== "object") return false;
  // A cycle has no JSON form; refuse it instead of overflowing the stack.
  if (seen.has(value)) return false;
  seen.add(value);
  const ok = isJsonContainer(value, seen);
  seen.delete(value);
  return ok;
}

function isJsonContainer(value: object, seen: Set<object>): boolean {
  if (Array.isArray(value)) {
    // A plain loop, not every(): every() skips holes, which JSON would turn into null. A hole reads
    // as undefined here, which is not JSON.
    for (let i = 0; i < value.length; i++) if (!isJson(value[i], seen)) return false;
    return true;
  }
  return isPlainObject(value) && Object.values(value).every((v) => isJson(v, seen));
}
