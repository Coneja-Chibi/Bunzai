/**
 * Numeric clamping shared by Kit's cursor and scroll math (settings nav, session list, rewind rail,
 * session model). Pure and total: no NaN handling beyond what Math.max/Math.min already give.
 */

export const clamp = (value: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, value));
