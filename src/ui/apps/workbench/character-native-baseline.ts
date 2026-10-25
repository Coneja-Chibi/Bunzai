/** Preserve independently hydrated native formats that a save did not submit. */
export function acceptedNativeBaseline(submitted: Record<string, unknown>, stored: Record<string, unknown>, submittedFormats: ReadonlySet<string>): Record<string, unknown> {
  const accepted = structuredClone(submitted);
  for (const [format, entry] of Object.entries(stored)) if (!submittedFormats.has(format)) accepted[format] = structuredClone(entry);
  return accepted;
}
