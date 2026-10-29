/**
 * The Stage Gallery's pure half. RoleCall's Gallery lists the pictures in a chat's messages (ImageGalleryPanel.tsx);
 * Bunzai messages carry none, so the scene's pictures are its cast's art (the frozen portrait, the card's extra art and
 * background, the persona's portrait) and the pictures of one pack. Only art the library holds is listed: an uploaded ref
 * or inline image or video data, never a link, so nothing is hotlinked. The count counts pictures (RoleCall's tab chip
 * counts messages, right-wing-groups.ts:111).
 */
import { isRecord, str } from "../../../core/guards";
import { extFromMime } from "../../../core/media";
import { parseUploadedRef } from "../../../entities/piece-parts-blob";
import { refSha, type BackdropPack } from "./scene-backdrop-core";
import { scenePortraitUrl } from "../../_shared/scene-art";

export type GallerySource = "card" | "persona" | "pack";
export type GalleryTab = "all" | "cast" | "pack";

/** One picture. `ref` is library art; `url` is the scene's frozen portrait route. `pack` names the pack item a pack picture already is. */
export interface GalleryItem { id: string; source: GallerySource; label: string; ref?: string; url?: string; mime?: string; pack?: { pack: string; item: string } }

export const GALLERY_TABS: readonly { id: GalleryTab; label: string }[] = [{ id: "all", label: "All" }, { id: "cast", label: "Cast" }, { id: "pack", label: "Pack" }];

export const isLocalArt = (ref: string): boolean => parseUploadedRef(ref) !== undefined || /^data:(image|video)\//i.test(ref);

export const countText = (n: number): string => `${String(n)} ${n === 1 ? "image" : "images"}`;

export const visibleItems = (items: readonly GalleryItem[], tab: GalleryTab): GalleryItem[] =>
  tab === "all" ? [...items] : items.filter((i) => (tab === "pack") === (i.source === "pack"));

const roleLabel = (role: string): string => role.charAt(0).toUpperCase() + role.slice(1);

/** The card's extra art by role, then its pinned background. The portrait is the scene's frozen one, so the live portrait is not listed again. */
export function cardItems(entity: unknown): GalleryItem[] {
  const body = isRecord(entity) && isRecord(entity["body"]) ? entity["body"] : {};
  const media = isRecord(body["media"]) ? body["media"] : {};
  const out: GalleryItem[] = [];
  const seen = new Set<string>();
  const add = (ref: string, label: string, mime: string | undefined): void => {
    if (!isLocalArt(ref) || seen.has(ref)) return;
    seen.add(ref);
    out.push({ id: `card:${String(out.length)}`, source: "card", label, ref, ...(mime ? { mime } : {}) });
  };
  const portrait = isRecord(media["portrait"]) ? str(media["portrait"]["ref"]) : "";
  if (portrait) seen.add(portrait);
  for (const a of Array.isArray(media["assets"]) ? media["assets"] : []) {
    if (isRecord(a)) add(str(a["ref"]), str(a["label"]).trim() || str(a["name"]).trim() || roleLabel(str(a["role"]) || "other"), str(a["mime"]) || undefined);
  }
  const presentation = isRecord(body["presentation"]) ? body["presentation"] : {};
  const bg = isRecord(presentation["background"]) ? str(presentation["background"]["ref"]) : "";
  add(bg, "Card background", parseUploadedRef(bg)?.mime);
  return out;
}

/** The scene's own portrait of the card, served from the snapshot it froze. */
export const portraitItem = (chatId: string, snapshotVersion: number, name: string): GalleryItem =>
  ({ id: "portrait", source: "card", label: name, url: scenePortraitUrl(chatId, snapshotVersion) });

export function personaItems(entity: unknown): GalleryItem[] {
  const body = isRecord(entity) && isRecord(entity["body"]) ? entity["body"] : {};
  const media = isRecord(body["media"]) ? body["media"] : {};
  const ref = isRecord(media["portrait"]) ? str(media["portrait"]["ref"]) : "";
  return isLocalArt(ref) ? [{ id: "persona:0", source: "persona", label: str(body["name"]).trim() || "Persona", ref, ...(parseUploadedRef(ref) ? { mime: parseUploadedRef(ref)!.mime } : {}) }] : [];
}

export const packGalleryItems = (pack: BackdropPack): GalleryItem[] =>
  pack.items.map((i) => ({ id: `pack:${pack.id}:${i.id}`, source: "pack" as const, label: i.label, ref: i.ref, ...(i.mime ? { mime: i.mime } : {}), pack: { pack: pack.id, item: i.id } }));

/** The pack item that already holds this exact picture (same bytes), so Use as background never adds a copy twice. */
export function existingPackItem(pack: BackdropPack, ref: string): BackdropPack["items"][number] | null {
  const sha = refSha(ref);
  return sha === null ? null : pack.items.find((i) => refSha(i.ref) === sha) ?? null;
}

export function downloadName(label: string, mime: string | undefined): string {
  const stem = label.replace(/[\/:*?"<>|]+/g, "-").trim() || "image";
  return `${stem}.${extFromMime(mime) ?? "png"}`;
}

/** The art-cache identity of a frozen portrait: its snapshot version, so a re-frozen scene never shows the old bytes. */
export const portraitIdentity = (url: string): string => `snapshot:${new URL(url, "http://x").searchParams.get("v") ?? ""}`;
