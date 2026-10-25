/**
 * The three shapes SillyTavern writes a time in: its humanized "June 24, 2025 6:22pm" (the machine's
 * local clock, which is also how it is read here), an ISO string, and epoch milliseconds (a number or
 * digits). `Date.parse` is not trusted with the humanized one: "4:49am" is not a format it promises.
 */
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const HUMAN = /^([A-Za-z]+) (\d{1,2}), (\d{4}) (\d{1,2}):(\d{2})\s*([ap]m)$/i;
/** A chat file's own start stamp: "2025-6-24 @13h 05m 16s 373ms" or "2025-06-24@13h00m58s". */
const FILE_STAMP = /^(\d{4})-(\d{1,2})-(\d{1,2}) ?@ ?(\d{1,2})h ?(\d{1,2})m ?(\d{1,2})s(?: ?(\d{1,3})ms)?$/;

/** Epoch milliseconds, or null when the value is none of the shapes. */
export function parseStTime(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null;
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (/^\d{9,}$/.test(text)) return Number(text);
  const human = HUMAN.exec(text);
  if (human) {
    const month = MONTHS.indexOf(human[1]!.toLowerCase());
    const hour = Number(human[4]) % 12 + (human[6]!.toLowerCase() === "pm" ? 12 : 0);
    if (month < 0 || Number(human[4]) < 1 || Number(human[4]) > 12) return null;
    const at = new Date(Number(human[3]), month, Number(human[2]), hour, Number(human[5])).getTime();
    return Number.isNaN(at) ? null : at;
  }
  const stamp = FILE_STAMP.exec(text);
  if (stamp) {
    const [y, mo, d, h, mi, s, ms] = stamp.slice(1).map((n) => Number(n ?? 0)) as [number, number, number, number, number, number, number];
    const at = new Date(y, mo - 1, d, h, mi, s, ms).getTime();
    return Number.isNaN(at) ? null : at;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const at = Date.parse(text);
    return Number.isNaN(at) ? null : at;
  }
  return null;
}
