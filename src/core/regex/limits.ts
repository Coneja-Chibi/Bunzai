/** Shared regex allocation ceilings for the core and its value-only worker. */
export const REGEX_TEXT_CHARS = 200_000;
export const REGEX_BATCH_CHARS = 1_000_000;
export const REGEX_OUTPUT_CHARS = REGEX_BATCH_CHARS;
export const REGEX_CAPTURE_LIMIT = 128;
export const REGEX_SPAN_LIMIT = 100_000;
export class RegexLimitError extends Error {
  constructor() { super("regex: output exceeds the size limit"); this.name = "RegexLimitError"; }
}
export function assertRegexSize(length: number, cap = REGEX_OUTPUT_CHARS): void {
  if (length > cap) throw new RegexLimitError();
}
