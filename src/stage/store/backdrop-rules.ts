/**
 * The input check for a scene's backdrop, applied by every ChatStore
 * implementation. Split from chat-rules.ts for the file-size cap, like opening-rules.ts.
 */
import type { ChatBackdrop } from "../contracts/chat-store";
import { checkText, fail } from "./chat-rules";
import { checkNumber, onlyKeys } from "./scalar-rules";

const MAX_ID = 200;
const BACKDROP_KEYS = ["pack", "item", "dim", "rate", "blur"] as const;

function checkId(value: unknown, what: string): string {
  const id = checkText(value, what);
  if (id.trim() === "" || id.length > MAX_ID) fail(`${what} must be 1 to ${MAX_ID} characters`);
  return id;
}

/** The scene's backdrop, or null to forget it (rule 36): a pack id, an item id and an optional dim from 0 to 1 an optional playback rate from 0.25 to 2 and an optional blur from 0 to 20 pixels. */
export function checkBackdrop(value: unknown): ChatBackdrop | null {
  if (value === null) return null;
  const v = onlyKeys(value, BACKDROP_KEYS, "backdrop");
  const pack = checkId(v.pack, "backdrop pack");
  const item = checkId(v.item, "backdrop item");
  const out: ChatBackdrop = { pack, item };
  if (v.dim !== undefined) out.dim = checkNumber(v.dim, "backdrop dim must be a number from 0 to 1", 0, 1);
  if (v.rate !== undefined) out.rate = checkNumber(v.rate, "backdrop rate must be a number from 0.25 to 2", 0.25, 2);
  if (v.blur !== undefined) out.blur = checkNumber(v.blur, "backdrop blur must be a number from 0 to 20", 0, 20);
  return out;
}
