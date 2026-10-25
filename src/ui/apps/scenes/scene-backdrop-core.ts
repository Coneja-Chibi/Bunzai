/**
 * The scene backdrop's pure half (ChatStore rule 36): which pack item a scene points at, how dark the overlay
 * is, how fast a video plays, and how many files one save carries. RoleCall shows a chat's background under a black
 * overlay that defaults to 0.6 and slides from 0 to 0.95 (BackgroundMedia.tsx:155-158, StageSettingsPanel.tsx:594 and
 * 1411-1428); here the overlay is the theme's own well color, so a light theme stays light and its text stays readable.
 */
import { isRecord, str } from "../../../core/guards";
import { normalizePack, type SpritePackItem } from "../../../core/media";
import type { ChatBackdrop } from "../../../stage/contracts/chat-store";
import { parseUploadedRef } from "../../../entities/piece-parts-blob";

/** RoleCall's default overlay darkness (`backgroundOverlayOpacity ?? ... ?? 0.6`, StandardLayout.tsx:1078). */
export const DEFAULT_DIM = 0.6;
/** The slider's top (RoleCall `max="0.95"`): the picture never disappears under the overlay. */
export const MAX_DIM = 0.95;
/** RoleCall's video speed slider (StageSettingsPanel.tsx:1448-1460): 0.25x to 2x, 1x unless moved. */
export const MIN_RATE = 0.25;
export const MAX_RATE = 2;

export const dimOf = (backdrop: Pick<ChatBackdrop, "dim">): number => backdrop.dim ?? DEFAULT_DIM;
export const rateOf = (backdrop: Pick<ChatBackdrop, "rate">): number => backdrop.rate ?? 1;

/** A video ref: an inline or uploaded file whose media type is video (the asset store keeps mp4, webm and mov). */
export const isVideoRef = (ref: string, mime?: string): boolean => mime?.startsWith("video/") === true || ref.startsWith("data:video") || parseUploadedRef(ref)?.mime.startsWith("video/") === true;

/** The sha an uploaded ref names: the asset route serves it from the page's own origin, the only place a video may load from. */
export const refSha = (ref: string): string | null => parseUploadedRef(ref)?.sha ?? null;

/** The overlay color: the scene's own well color at the dim strength, over the picture. */
export const veilOf = (dim: number): string => `color-mix(in srgb, var(--stage-well) ${String(Math.round(dim * 100))}%, transparent)`;

export interface BackdropPack { id: string; name: string; items: readonly SpritePackItem[] }

/** A pack entity's name and flat items (the default group), or null when it is not a pack. */
export function backdropPack(entity: unknown): BackdropPack | null {
  if (!isRecord(entity) || entity["kind"] !== "pack" || !isRecord(entity["body"])) return null;
  return { id: str(entity["id"]), name: str(entity["body"]["name"]).trim() || "Untitled pack", items: normalizePack(entity["body"]["pack"]).items };
}

/** The item a backdrop names, or null when the pack no longer holds it. */
export const itemOf = (pack: BackdropPack, backdrop: Pick<ChatBackdrop, "item">): SpritePackItem | null => pack.items.find((i) => i.id === backdrop.item) ?? null;

/** A character's own background, from the card's `presentation.background` (RoleCall `details.default_background`). */
export interface CharacterBackdrop { ref: string; dim: number; rate?: number; video?: boolean }

/**
 * The picture or video a character's creator pinned, which a scene shows until the person picks one of their own, as
 * RoleCall seeds a chat that has no background of its own (useCharacterLoad.ts:556-577; character-default-background.ts:
 * 32-58: overlay 0.6 unless set, clamped 0 to 1; a video plays at `videoPlaybackRate`, clamped here to 0.25 to 2).
 */
export function characterBackdrop(character: unknown): CharacterBackdrop | null {
  const presentation = isRecord(character) && isRecord(character["body"]) ? character["body"]["presentation"] : undefined;
  const bg = isRecord(presentation) ? presentation["background"] : undefined;
  if (!isRecord(bg)) return null;
  const ref = str(bg["ref"]).trim();
  if (!ref) return null;
  const opacity = bg["overlayOpacity"];
  const speed = bg["videoPlaybackRate"];
  const dim = typeof opacity === "number" && Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : DEFAULT_DIM;
  const rate = typeof speed === "number" && Number.isFinite(speed) ? Math.max(MIN_RATE, Math.min(MAX_RATE, speed)) : undefined;
  return { ref, dim, ...(isVideoRef(ref) ? { video: true } : {}), ...(rate === undefined ? {} : { rate }) };
}
