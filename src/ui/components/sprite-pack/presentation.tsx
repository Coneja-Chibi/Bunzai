/** SpritePack preview and profile-slot projection helpers. */
import type { JSX } from "react";
import type { ExpressionProfile, SpritePackValue } from "../../../core/media";
import { normalizeLabel } from "../../../core/media";
import { useArtSrc } from "../../_shared/art-cache";
import { Ic } from "../../_shared/ic";
import { parseUploadedRef } from "../../../entities/piece-parts-blob";

const CORE_VISIBLE = ["neutral", "happy", "sad", "angry", "surprised", "joy", "sadness", "anger", "surprise"];
export function profileGhostSlots(pack: SpritePackValue, profile: ExpressionProfile | undefined, show: boolean): string[] {
  if (!show || !profile) return [];
  const filled = new Set(pack.items.map((item) => normalizeLabel(item.label)));
  return profile.slots.filter((slot) => CORE_VISIBLE.includes(normalizeLabel(slot)) && !filled.has(normalizeLabel(slot))).slice(0, 8);
}
/** A sound has no picture to show (a Mood Music pack's tracks live in the same pack entity); it gets a note glyph, not a broken image. */
const isSound = (refValue: string): boolean => refValue.startsWith("data:audio/") || parseUploadedRef(refValue)?.mime.startsWith("audio/") === true;

export function SpritePreview({ refValue, alt }: { refValue: string; alt: string }): JSX.Element {
  const asset = useArtSrc(isSound(refValue) ? null : refValue);
  if (isSound(refValue)) return <span role="img" aria-label={alt} style={{ display: "grid", placeItems: "center", width: "100%", height: "100%" }}><Ic name="lucide:music" size={24} /></span>;
  return <img ref={asset.ref as (node: HTMLImageElement | null) => void} src={asset.src} alt={alt} draggable={false} />;
}
