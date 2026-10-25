/** Search/display label for an imported piece, kept identical between the UI and worker. */
export function sourceLabelFor<E extends { kind: string; sourceFormat?: string; sourceVariant?: string }>(
  formatLabels: ReadonlyMap<string, string>,
  entity: E,
): string | null {
  if (!entity.sourceFormat) return null;
  const base = formatLabels.get(entity.sourceFormat);
  const variant = entity.sourceVariant?.toUpperCase();
  if (base === "Default") {
    if (entity.kind !== "character") return null;
    return variant ? `CC ${variant}` : "CC";
  }
  const label = base ?? entity.sourceFormat;
  return variant ? `${label} · ${variant}` : label;
}
