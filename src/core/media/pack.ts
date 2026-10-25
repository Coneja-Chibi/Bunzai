/**
 * Sprite / expression pack hub model. Label -> image ref. Platforms differ only in bridges.
 * Pure: no React, no format ids.
 */
import type { Media, MediaAsset } from "../../entities/character/schema";
import { isRecord, str } from "../guards";

export type SpritePackItem = {
  id: string;
  label: string;
  ref: string;
  mime?: string;
};

export type SpritePackValue = {
  enabled?: boolean;
  defaultLabel?: string;
  items: readonly SpritePackItem[];
};


/** Normalize a free-form label: trim, collapse separators, lowercase for compare. */
export const normalizeLabel = (raw: string): string =>
  raw
    .trim()
    .replace(/\.[a-z0-9]+$/i, "") // strip extension if someone pasted a filename
    .replace(/^(expr_|expression_|full_)/i, "")
    .replace(/[\s_/-]+/g, " ")
    .trim()
    .toLowerCase();

/** Display label from a filename (basename, no ext, light clean). Keeps original casing of stem. */
export const labelFromFilename = (filename: string): string => {
  const base = filename.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "");
  const cleaned = base.replace(/^(expr_|expression_)/i, "").trim();
  return cleaned.length > 0 ? cleaned : "face";
};

export const emptyPack = (): SpritePackValue => ({ items: [] });

export const newPackItemId = (): string =>
  `sp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Fail closed: drop an item with no label or no picture, and nothing else. A picture is the user's, so two
 * that share a label are both kept: the first keeps its label, a later one becomes "label (2)", "label (3)"
 * (the first number no other label in the pack uses, so a pack that already holds "label (2)" is never
 * disturbed), and a repeated id is replaced by a fresh one. Normalizing a normalized pack changes nothing,
 * which matters because the editor runs this on every edit.
 */
export function normalizePack(value: unknown): SpritePackValue {
  if (!isRecord(value)) return emptyPack();
  const v = value;
  const rawItems = Array.isArray(v.items) ? v.items : [];
  const kept: SpritePackItem[] = [];
  for (const row of rawItems) {
    if (!isRecord(row)) continue;
    const r = row;
    const label = str(r.label).trim();
    const ref = str(r.ref).trim();
    if (!label || !ref) continue;
    const id = str(r.id).trim() || newPackItemId();
    const mime = str(r.mime).trim();
    const item: SpritePackItem = { id, label, ref };
    if (mime) item.mime = mime;
    kept.push(item);
  }
  // First occurrences claim their labels before any repeat picks a number, whatever order they sit in.
  const taken = new Set<string>();
  const repeats: number[] = [];
  kept.forEach((item, index) => {
    const key = normalizeLabel(item.label);
    if (taken.has(key)) repeats.push(index);
    else taken.add(key);
  });
  for (const index of repeats) {
    const item = kept[index]!;
    let n = 2;
    while (taken.has(normalizeLabel(`${item.label} (${n})`))) n++;
    item.label = `${item.label} (${n})`;
    taken.add(normalizeLabel(item.label));
  }
  const ids = new Set<string>();
  for (const item of kept) {
    if (ids.has(item.id)) item.id = newPackItemId();
    ids.add(item.id);
  }
  const items = kept;
  const out: SpritePackValue = { items };
  if (v.enabled === true) out.enabled = true;
  if (v.enabled === false) out.enabled = false;
  const def = str(v.defaultLabel).trim();
  if (def && items.some((i) => normalizeLabel(i.label) === normalizeLabel(def))) {
    out.defaultLabel = items.find((i) => normalizeLabel(i.label) === normalizeLabel(def))!.label;
  } else if (items.some((i) => normalizeLabel(i.label) === "neutral")) {
    out.defaultLabel = items.find((i) => normalizeLabel(i.label) === "neutral")!.label;
  }
  return out;
}

/** Emotion-role assets from body.media -> pack (portrait excluded). */
export function packFromMedia(media: Media | undefined): SpritePackValue {
  if (!media) return emptyPack();
  const items: SpritePackItem[] = [];
  for (const a of media.assets ?? []) {
    if (a.role !== "emotion") continue;
    const label = (a.label ?? a.name ?? "").trim();
    const ref = (a.ref ?? "").trim();
    if (!label || !ref) continue;
    const item: SpritePackItem = { id: newPackItemId(), label, ref };
    if (a.mime) item.mime = a.mime;
    items.push(item);
  }
  return normalizePack({ items });
}

/** Pack -> emotion MediaAssets (does not include portrait). */
export function emotionAssetsFromPack(pack: SpritePackValue): MediaAsset[] {
  const p = normalizePack(pack);
  return p.items.map((i) => {
    const a: MediaAsset = { role: "emotion", label: i.label, ref: i.ref };
    if (i.mime) a.mime = i.mime;
    return a;
  });
}

/**
 * Merge pack emotions into media: replace all emotion assets, keep other roles + portrait.
 */
export function applyPackToMedia(media: Media | undefined, pack: SpritePackValue): Media {
  const base = media ?? {};
  const nonEmotion = (base.assets ?? []).filter((a) => a.role !== "emotion");
  const emotions = emotionAssetsFromPack(pack);
  const next: Media = {};
  if (base.portrait) next.portrait = base.portrait;
  if (base.sprite) next.sprite = base.sprite;
  if (base.visualKind !== undefined) next.visualKind = base.visualKind;
  if (base.faceLabel !== undefined) next.faceLabel = base.faceLabel;
  const assets = [...nonEmotion, ...emotions];
  if (assets.length) next.assets = assets;
  return next;
}

/** Reorder pack items by id list (unknown ids dropped). */
export function reorderPackItems(
  pack: SpritePackValue,
  orderedIds: readonly string[],
): SpritePackValue {
  const p = normalizePack(pack);
  const byId = new Map(p.items.map((i) => [i.id, i]));
  const items: SpritePackItem[] = [];
  for (const id of orderedIds) {
    const hit = byId.get(id);
    if (hit) {
      items.push(hit);
      byId.delete(id);
    }
  }
  for (const rest of byId.values()) items.push(rest);
  return normalizePack({ ...p, items });
}

/** Resolve which face to show: explicit label -> defaultLabel -> neutral -> first. */
export function resolvePackFace(
  pack: SpritePackValue,
  wantLabel?: string | null,
): SpritePackItem | null {
  const p = normalizePack(pack);
  if (p.items.length === 0) return null;
  if (wantLabel) {
    const n = normalizeLabel(wantLabel);
    const hit = p.items.find((i) => normalizeLabel(i.label) === n);
    if (hit) return hit;
  }
  if (p.defaultLabel) {
    const n = normalizeLabel(p.defaultLabel);
    const hit = p.items.find((i) => normalizeLabel(i.label) === n);
    if (hit) return hit;
  }
  const neutral = p.items.find((i) => normalizeLabel(i.label) === "neutral");
  if (neutral) return neutral;
  return p.items[0] ?? null;
}
