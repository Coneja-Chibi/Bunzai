/** The icon a person picks for a persona (presentation.emoji): one short emoji, nothing else. A pure check shared by the schema and the RoleCall codec. */
const MAX_UNITS = 32;
const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

/** True for exactly one grapheme cluster (a flag, a family, a skin-toned hand) of at most 32 UTF-16 units that is not plain text. */
export function isPersonaEmoji(value: string): boolean {
  if (value.length === 0 || value.length > MAX_UNITS) return false;
  const clusters = [...segmenter.segment(value)];
  return clusters.length === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}|^[0-9#*]\uFE0F?\u20E3$/u.test(value);
}
