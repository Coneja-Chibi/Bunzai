/**
 * Cross-platform filename normalization for browser downloads and ZIP entries. This is filename
 * handling only: callers still mint extensions and enforce uniqueness at their own boundary.
 */

// Bidi controls are refused too: they let a listing show `gnp.exe` for a name that is really `exe.png`.
const FORBIDDEN_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f\u202a-\u202e\u2066-\u2069]/g;
const WINDOWS_DEVICE_NAME = /^(con|prn|aux|nul|conin\$|conout\$|com[1-9\u00b9\u00b2\u00b3]|lpt[1-9\u00b9\u00b2\u00b3])(?:\.|$)/i;

/** Return a safe filename base while retaining ordinary punctuation and authored spacing. */
export function sanitizeDownloadBase(raw: string, fallback: string): string {
  // Cut by code points, never inside a surrogate pair: half an emoji is not a valid name anywhere.
  const normalized = Array.from((raw.trim() || fallback).replace(FORBIDDEN_FILENAME_CHARS, "_")).slice(0, 80).join("");
  const withoutTrailingDots = normalized.replace(/[.\s]+$/, "") || fallback; // \s as trim() sees it, so a second pass changes nothing
  if (withoutTrailingDots === "." || withoutTrailingDots === "..") return `_${withoutTrailingDots}`;
  return WINDOWS_DEVICE_NAME.test(withoutTrailingDots) ? `_${withoutTrailingDots}` : withoutTrailingDots;
}
