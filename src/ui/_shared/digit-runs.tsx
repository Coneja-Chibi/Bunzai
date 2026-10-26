/**
 * Splits text into runs of digits and the words between them, wrapping each digit run in a span with the caller's
 * class. One helper for every place numbers need their own face: the display face draws 1 like a capital I (room
 * titles), and summary lines set their numerals in gold mono (the Press).
 */
import type { JSX } from "react";

export function digitRuns(text: string, digitClass: string | undefined): (JSX.Element | string)[] {
  return text.split(/(\d+)/).filter((bit) => bit !== "").map((bit, i) => (/^\d+$/.test(bit) ? <span key={i} className={digitClass}>{bit}</span> : bit));
}
