/**
 * What a theme's slots hold, read once from the root attribute the painter writes (`data-theme-slots`). This is
 * the host's second look at data the package inspector already checked: anything off-shape is dropped, never
 * repaired. Slot ids, item shapes and limits come from the extensions slot registry.
 */
import { isRecord, strArray } from "../../core/guards";
import { MAX_SLOT_ITEMS, MAX_SLOT_TEXT, SLOT_IDS } from "../../extensions/slot-registry";
import { isSha256Hex } from "../../core/sha256";

export { SLOT_IDS, type SlotId } from "../../extensions/slot-registry";

/** An item ready to draw: an image already resolved to its digest URL, text with a class only if the package defined it. */
export type DrawnItem =
  | { kind: "image"; src: string; alt: string }
  | { kind: "text"; text: string; className?: string };

/** The same name theme-mod.ts writes (a test holds them equal); the shell's painter is not bundled into every app. */
export const SLOT_ATTRIBUTE = "data-theme-slots";

/** The digest asset route, or the object URL the painter makes of the same bytes in static browser mode. */
const DIGEST_ROUTE = /^\/api\/themes\/assets\/[^/?#]+\/[a-z0-9-]+\?digest=(.*)$/;
const BLOB_URL = /^blob:\S+$/;
const isDigestUrl = (url: string): boolean => BLOB_URL.test(url) || isSha256Hex(DIGEST_ROUTE.exec(url)?.[1]);
const CLASS_NAME = /^[A-Za-z][\w-]{0,63}$/;

function drawItem(raw: unknown, assets: Record<string, unknown>, classes: ReadonlySet<string>): DrawnItem | null {
  if (!isRecord(raw)) return null;
  if (raw.kind === "image") {
    const url = typeof raw.asset === "string" ? assets[raw.asset] : undefined;
    return typeof url === "string" && isDigestUrl(url) && typeof raw.alt === "string" ? { kind: "image", src: url, alt: raw.alt } : null;
  }
  if (raw.kind === "text" && typeof raw.text === "string" && raw.text.length <= MAX_SLOT_TEXT) {
    const named = typeof raw.class === "string" && CLASS_NAME.test(raw.class) && classes.has(raw.class);
    return named ? { kind: "text", text: raw.text, className: raw.class as string } : { kind: "text", text: raw.text };
  }
  return null;
}

/** Every slot's drawable items. A missing, malformed or hostile payload is an empty theme, never an error. */
export function readSlotItems(payload: string | null): ReadonlyMap<string, readonly DrawnItem[]> {
  const out = new Map<string, readonly DrawnItem[]>();
  if (!payload) return out;
  let parsed: unknown;
  try { parsed = JSON.parse(payload); } catch { return out; }
  if (!isRecord(parsed) || !isRecord(parsed.slots) || !isRecord(parsed.assets)) return out;
  const classes = new Set(strArray(parsed.classes));
  for (const id of SLOT_IDS) {
    const list = parsed.slots[id];
    if (!Array.isArray(list)) continue;
    const items = list.slice(0, MAX_SLOT_ITEMS).map((item) => drawItem(item, parsed.assets as Record<string, unknown>, classes)).filter((item): item is DrawnItem => item !== null);
    if (items.length > 0) out.set(id, items);
  }
  return out;
}

