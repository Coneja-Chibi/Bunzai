/**
 * The scalar checks every store rules module shares: a whole number inside bounds, and a message's hide
 * flag. They live apart from chat-rules.ts (which re-uses them) so the small rules modules can ask them
 * without reaching into the big one, and so no module keeps its own idea of "a whole number".
 */
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

/** A message's hide flag (rule 30): true or false, a validation error otherwise so every door answers it the same way. */
export function checkHidden(value: unknown): boolean {
  if (typeof value !== "boolean") throw new StudioValidationError("hidden must be true or false");
  return value;
}

/** Refuses with a validation error; every rules module fails the same way. */
export function fail(message: string): never {
  throw new StudioValidationError(message);
}
