/** Visibility-gated scene art; frozen snapshots stay immutable and legacy scenes follow committed live receipts. */
import { useEffect, useState, type JSX } from "react";
import type { AppContext } from "../app-contract";
import { useAsset, usePieceArtIdentity, type AssetSource } from "./art-cache";
import { skipFlatTop } from "./content-top";

export function scenePortraitUrl(chatId: string, snapshotVersion: number): string {
  return `/api/chats/portrait?id=${encodeURIComponent(chatId)}&v=${snapshotVersion}`;
}

export function sceneArtIdentity(snapshotVersion: number, writeId: number, revision: string, generation: number): string {
  return snapshotVersion > 0 ? `snapshot:${snapshotVersion}` : `live:${writeId}:${revision}:${generation}`;
}

export function sceneArtAvailable(snapshotVersion: number, liveHasArt: boolean | undefined, seeded: boolean, sceneHasArt: boolean): boolean {
  return snapshotVersion > 0 ? sceneHasArt : seeded ? liveHasArt ?? false : sceneHasArt;
}

export function SceneArt({ ctx, chatId, characterId, snapshotVersion, hasArt, name, trimTop }: {
  ctx: Pick<AppContext, "pieces">; chatId: string; characterId: string; snapshotVersion: number; hasArt: boolean; name: string;
  /** Crop from the top, below any flat band; the frame must use `object-position: center top`. */
  trimTop?: boolean;
}): JSX.Element {
  const receipt = ctx.pieces.snapshot("character", characterId);
  const available = sceneArtAvailable(snapshotVersion, receipt?.summary.hasPortrait, ctx.pieces.isSeeded(), hasArt);
  const liveIdentity = usePieceArtIdentity(snapshotVersion === 0 ? ctx.pieces : undefined, "character", characterId, receipt?.writeId ?? 0, receipt?.revision ?? "");
  const cacheIdentity = sceneArtIdentity(snapshotVersion, receipt?.writeId ?? 0, receipt?.revision ?? "", ctx.pieces.getGeneration());
  const source: AssetSource | null = !available ? null : snapshotVersion > 0
    ? { url: scenePortraitUrl(chatId, snapshotVersion), identity: cacheIdentity }
    : { portrait: { kind: "character", id: characterId, identity: liveIdentity } };
  const { ref, src, failed } = useAsset(source);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [chatId, characterId, available, snapshotVersion, liveIdentity]);
  return !available || failed || broken
    ? <span className="ini">{name.trim().charAt(0).toUpperCase() || "?"}</span>
    : <img ref={ref} src={src} alt="" loading="lazy" decoding="async" onLoad={trimTop ? skipFlatTop : undefined} onError={() => setBroken(true)} />;
}
