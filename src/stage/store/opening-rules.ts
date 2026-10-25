/**
 * The input check for a scene's edited opening messages, applied by every
 * ChatStore implementation. Split from chat-rules.ts for the file-size cap.
 */
import type { ChatOpening } from "../contracts/chat-store";
import { checkText, fail } from "./chat-rules";
import { isWhole } from "./scalar-rules";
import { isPlainObject } from "../../core/guards";

const MAX_OPENING_EDITS = 64;

/** The scene's edited greetings, or null to forget them (rule 34): at most 64, one per whole index 0 to 63, text trimmed and non-blank. */
export function checkOpening(value: unknown): ChatOpening | null {
  if (value === null) return null;
  if (!isPlainObject(value)) fail("opening must be a plain object or null");
  for (const key of Object.keys(value)) if (key !== "edits") fail(`opening has an unknown field: ${key}`);
  if (!Array.isArray(value.edits)) fail("opening edits must be a list");
  if (value.edits.length > MAX_OPENING_EDITS) fail(`opening edits must be at most ${MAX_OPENING_EDITS}`);
  const seen = new Set<number>();
  const edits = value.edits.map((e: unknown) => {
    if (!isPlainObject(e)) fail("an opening edit must be a plain object");
    for (const key of Object.keys(e)) if (key !== "index" && key !== "text") fail(`an opening edit has an unknown field: ${key}`);
    const index = e.index;
    if (!isWhole(index, 0, MAX_OPENING_EDITS - 1)) fail(`an opening edit index must be a whole number from 0 to ${MAX_OPENING_EDITS - 1}`);
    if (seen.has(index)) fail(`opening edit index ${index} is given twice`);
    seen.add(index);
    const text = checkText(e.text, "an opening edit text").trim();
    if (text === "") fail("an opening edit must not be blank");
    return { index, text };
  });
  return { edits };
}
