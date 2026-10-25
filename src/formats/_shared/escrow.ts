/** Shared extraction of format fields the canonical model does not own. */

/** Returns unknown fields as own data properties, including keys such as `__proto__`. */
export function splitKnown(
  source: Record<string, unknown>,
  known: ReadonlySet<string>,
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(([key]) => !known.has(key)));
}
