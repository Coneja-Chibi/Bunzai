/**
 * The one copy of the small type guards untrusted JSON is read through. Every format, entity, and
 * UI reader imports these instead of redefining them (AGENTS.md rule 12).
 */
export type Rec = Record<string, unknown>;

/** A plain JSON object: not null, not an array. */
export const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

/** The plain object itself, or a fresh empty one for anything else. Takes no fallback so `.map(recOr)` cannot mistake the index for one. */
export const recOr = (v: unknown): Rec => (isRecord(v) ? v : {});

/** A record whose prototype is exactly Object.prototype: rejects class instances, Map/Date and null-prototype objects. */
export const isPlainObject = (v: unknown): v is Rec => isRecord(v) && Object.getPrototypeOf(v) === Object.prototype;

/** The string, or "" for anything else. */
export const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** The string, or undefined for anything else. */
export const optStr = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/** A canonical entity's body, or an empty record when there is none. */
export const bodyOf = (entity: unknown): Rec => (isRecord(entity) && isRecord(entity["body"]) ? entity["body"] : {});

/** The string, or a given fallback for anything else. */
export const strOr = (v: unknown, fallback: string): string => (typeof v === "string" ? v : fallback);

/** A finite number, or a given fallback for anything else (NaN and Infinity are not numbers here). */
export const numOr = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/** The boolean, or a given fallback for anything else ("true" and 1 are not booleans here). */
export const boolOr = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);

/** A finite number, or null for anything else. */
export const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** A finite number if the field is present and well-formed, or undefined if it was never authored. */
export const presentNum = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

/** A string if the field is present, or undefined if it was never authored. */
export const presentStr = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/** A boolean if the field is present, or undefined if it was never authored. */
export const presentBool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);

/** Every string element of an array; non-array or non-string entries are dropped, never thrown. */
export const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** The string elements of an array, or undefined when the field is not an array (never authored). */
export const presentStrArray = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined;

/** Every plain-object element of an array; non-array or non-object entries are dropped, never thrown. */
export const recArray = (v: unknown): Rec[] => (Array.isArray(v) ? v.filter(isRecord) : []);

/** A storage-layer boolean that may still be the pre-deserialization wire spelling ("true"/"false"). */
export const boolFromWire = (v: unknown): boolean => v === true || v === "true";

/** True when `v` is one of the given literal options; narrows to that option union. */
export const isOneOf = <T extends string>(v: unknown, options: readonly T[]): v is T =>
  typeof v === "string" && (options as readonly string[]).includes(v);

/** Match an error name across bundle identities without changing caller-specific class checks. */
export const hasErrorName = (value: unknown, name: string): boolean =>
  typeof value === "object" && value !== null && (value as { name?: unknown }).name === name;

/**
 * Structural, key-order-safe deep equality for decoded JSON-shaped values (no functions, no Date,
 * no Map/Set - only what `JSON.parse` can produce). `JSON.stringify(a) === JSON.stringify(b)` is NOT
 * a substitute: object key order is insertion order in `JSON.stringify` but carries no meaning in the
 * value itself, so two structurally identical objects built in a different field order compare
 * unequal under stringify-equality - a false "changed" reading that can silently rewrite or drop data
 * a caller never actually touched (see B10). Never reach for `JSON.stringify` equality on parsed
 * data; call this instead.
 */
export const deepEq = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEq(v, b[i]));
  }
  if (typeof a === "object") {
    const ao = a as Rec;
    const bo = b as Rec;
    const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
    for (const k of keys) if (!deepEq(ao[k], bo[k])) return false;
    return true;
  }
  return false;
};
