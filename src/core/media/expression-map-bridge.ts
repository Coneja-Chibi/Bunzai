/**
 * ExpressionMap (Lumi twin shape) <-> SpritePack hub. Pure adapter so UI never dual-authors.
 */
import {
  newPackItemId,
  normalizePack,
  type SpritePackItem,
  type SpritePackValue,
} from "./pack";
import { isRecord, str } from "../guards";

export type ExpressionMapValue = {
  enabled?: boolean;
  defaultExpression?: string;
  mappings?: Record<string, string>;
};


export function packFromExpressionMap(value: unknown): SpritePackValue {
  if (!isRecord(value)) return normalizePack({ items: [] });
  const mappings = isRecord(value.mappings) ? value.mappings : {};
  const items: SpritePackItem[] = [];
  for (const [label, ref] of Object.entries(mappings)) {
    if (typeof ref !== "string" || !ref.trim() || !label.trim()) continue;
    items.push({ id: newPackItemId(), label: label.trim(), ref: ref.trim() });
  }
  return normalizePack({
    items,
    enabled: value.enabled === true ? true : value.enabled === false ? false : undefined,
    defaultLabel: str(value.defaultExpression).trim() || undefined,
  });
}

export function expressionMapFromPack(pack: SpritePackValue): ExpressionMapValue {
  const p = normalizePack(pack);
  const mappings: Record<string, string> = {};
  for (const it of p.items) mappings[it.label] = it.ref;
  return {
    enabled: p.enabled === true,
    defaultExpression: p.defaultLabel ?? (p.items[0]?.label ?? ""),
    mappings,
  };
}
