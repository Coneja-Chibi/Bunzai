/**
 * The input check for a scene's backdrop, applied by every ChatStore
 * implementation. Split from chat-rules.ts for the file-size cap, like opening-rules.ts.
 */
import type { ChatBackdrop } from "../contracts/chat-store";
import { checkText, fail } from "./chat-rules";
import { isPlainObject } from "../../core/guards";

const MAX_ID = 200;

function checkId(value: unknown, what: string): string {
  const id = checkText(value, what);
  if (id.trim() === "" || id.length > MAX_ID) fail(`${what} must be 1 to ${MAX_ID} characters`);
  return id;
}

/** The scene's backdrop, or null to forget it (rule 36): a pack id, an item id and an optional dim from 0 to 1 and an optional playback rate from 0.25 to 2. */
export function checkBackdrop(value: unknown): ChatBackdrop | null {
  if (value === null) return null;
  if (!isPlainObject(value)) fail("backdrop must be a plain object or null");
  for (const key of Object.keys(value)) if (key !== "pack" && key !== "item" && key !== "dim" && key !== "rate") fail(`backdrop has an unknown field: ${key}`);
  const pack = checkId(value.pack, "backdrop pack");
  const item = checkId(value.item, "backdrop item");
  const out: ChatBackdrop = { pack, item };
  if (value.dim !== undefined) {
    if (typeof value.dim !== "number" || !Number.isFinite(value.dim) || value.dim < 0 || value.dim > 1) fail("backdrop dim must be a number from 0 to 1");
    out.dim = value.dim;
  }
  if (value.rate !== undefined) {
    if (typeof value.rate !== "number" || !Number.isFinite(value.rate) || value.rate < 0.25 || value.rate > 2) fail("backdrop rate must be a number from 0.25 to 2");
    out.rate = value.rate;
  }
  return out;
}
