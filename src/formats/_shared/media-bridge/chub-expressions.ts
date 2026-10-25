/**
 * Chub extensions.chub.expressions / alt_expressions <-> SpritePack. Pure.
 * Shape is open: often {} or label->url/object; we accept string refs and {url}|{uri}|{path}.
 */
import {
  newPackItemId,
  normalizePack,
  type SpritePackItem,
  type SpritePackValue,
} from "../../../core/media";
import { isRecord, str, type Rec } from "../../../core/guards";
import { readOriginalExt, writeOriginalExt } from "./original-ext";

const refFromValue = (v: unknown): string => {
  if (typeof v === "string") return v.trim();
  if (!isRecord(v)) return "";
  return str(v.url || v.uri || v.path || v.image || v.src).trim();
};

export function packFromChubExpressions(bag: unknown): SpritePackValue {
  if (!isRecord(bag)) return normalizePack({ items: [] });
  const items: SpritePackItem[] = [];
  for (const [label, v] of Object.entries(bag)) {
    const ref = refFromValue(v);
    if (!label.trim() || !ref) continue;
    items.push({ id: newPackItemId(), label: label.trim(), ref });
  }
  return normalizePack({ items });
}

/** Simple map label -> url string (Chub-friendly). */
export function chubExpressionsFromPack(pack: SpritePackValue): Record<string, string> {
  const p = normalizePack(pack);
  const out: Record<string, string> = {};
  for (const it of p.items) out[it.label] = it.ref;
  return out;
}

export function packFromChubOriginal(original: Record<string, unknown>): SpritePackValue {
  const ext = readOriginalExt(original, "sillytavern");
  const chub = ext && isRecord(ext.chub) ? ext.chub : null;
  if (!chub) return normalizePack({ items: [] });
  const primary = packFromChubExpressions(chub.expressions);
  if (primary.items.length) return primary;
  return packFromChubExpressions(chub.alt_expressions);
}

export function originalWithChubPack(
  original: Record<string, unknown>,
  pack: SpritePackValue,
): Record<string, unknown> {
  return writeOriginalExt(original, "sillytavern", { expressions: chubExpressionsFromPack(pack) }, "chub");
}
