/**
 * Editor left column: portrait card with manage sprites / named assets.
 * Extracted from Editor.tsx (presentational assembly only).
 */
import type { JSX } from "react";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import {
  mediaCapabilities,
  type NamedAssetsValue,
  type SpritePackValue,
} from "../../../../core/media";
import { PortraitCard } from "../controls/portrait-card";
import { readPath } from "../editor-core";
import { str, tokenEstimate } from "../editor-derive";
import { packFromBodyDraft } from "../media/session";
import { namedFromRisuOriginal } from "../../../../formats/_shared/media-bridge";
import { KnowledgeRail } from "../lore/KnowledgeRail";
import { variantArtUrls } from "../variants-art";
import type { useVariants } from "../use-variants";
import { portraitUrl } from "../../../_shared/asset-url";
import { isAssetImageRef, useArtSrc, usePieceArtIdentity, usePortraitAsset } from "../../../_shared/art-cache";
import type { AssetUpload } from "../../../_shared/asset-upload";
import { recOr } from "../../../../core/guards";

type VaryApi = ReturnType<typeof useVariants>;

export function resolveArtUrl(opts: {
  draft: unknown;
  varyActiveId: string | null;
  piece: StudioEntitySummary;
}): string | null {
  const portrait = recOr(readPath(opts.draft, "media.portrait"));
  const ref = str(portrait.ref);
  if (isAssetImageRef(ref)) {
    return ref;
  }
  if (!opts.varyActiveId && opts.piece.hasPortrait) {
    return portraitUrl(opts.piece.kind, opts.piece.id);
  }
  return null;
}

export function mediaBundle(
  baseDraft: Record<string, unknown>,
  originalDraft: Record<string, unknown>,
  targets: string[],
): {
  mediaCaps: ReturnType<typeof mediaCapabilities>;
  spritePack: SpritePackValue;
  spriteCount: number;
  namedBag: NamedAssetsValue;
  namedCount: number;
} {
  const mediaCaps = mediaCapabilities({ original: originalDraft, targets });
  const spritePack = packFromBodyDraft(baseDraft, originalDraft);
  const namedBag = namedFromRisuOriginal(originalDraft);
  return {
    mediaCaps,
    spritePack,
    spriteCount: spritePack.items.length,
    namedBag,
    namedCount: namedBag.items.length,
  };
}

export function EditorLeftCard({
  artUrl,
  draft,
  piece,
  vary,
  styles,
  setField,
  mediaCaps,
  spriteCount,
  namedCount,
  setSpritesOpen,
  setSpritesFocusLabel,
  setNamedOpen,
  ctx,
  knowledgeRefs,
  onKnowledgeRefsChange,
  uploadAsset,
}: {
  artUrl: string | null;
  draft: unknown;
  piece: StudioEntitySummary;
  vary: VaryApi;
  styles: Readonly<Record<string, string>>;
  setField(path: string, value: unknown): void;
  mediaCaps: ReturnType<typeof mediaCapabilities>;
  spriteCount: number;
  namedCount: number;
  setSpritesOpen(v: boolean): void;
  setSpritesFocusLabel(v: string | null): void;
  setNamedOpen(v: boolean): void;
  ctx?: AppContext;
  knowledgeRefs?: readonly string[];
  onKnowledgeRefsChange?: (next: string[]) => void;
  uploadAsset?: AssetUpload;
}): JSX.Element {
  const storedPortrait = artUrl?.startsWith("/api/studio/portrait?");
  const externalArt = !!artUrl?.startsWith("http");
  const artIdentity = usePieceArtIdentity(ctx?.pieces, piece.kind, piece.id, piece.writeId ?? 0, piece.revision ?? "");
  const storedArt = usePortraitAsset(piece.kind, piece.id, piece.version, storedPortrait ? artUrl : null, artIdentity);
  const draftArt = useArtSrc(artUrl && !storedPortrait && !externalArt ? artUrl : null);
  const resolvedArt = storedPortrait ? storedArt.src : externalArt ? artUrl : draftArt.src;
  const artRef = storedPortrait ? storedArt.ref : draftArt.ref;
  const updatedAt = ((): string | null => {
    const t = readPath(draft, "attribution.updatedAt");
    return typeof t === "number" && Number.isFinite(t) ? new Date(t * 1000).toLocaleDateString() : null;
  })();
  const variantArt = variantArtUrls(vary.variants);

  return (
    <>
      <PortraitCard
        artUrl={resolvedArt ?? null}
        artRef={artRef}
        name={str(readPath(draft, "identity.name")) || piece.name}
        tokens={tokenEstimate(draft)}
        updatedAt={updatedAt}
        sourceVariant={piece.sourceVariant}
        vary={vary}
        styles={styles}
        onPortraitChange={(portrait) => {
          if (portrait === null) setField("media.portrait", "");
          else setField("media.portrait", portrait);
        }}
        uploadAsset={uploadAsset}
        onOpenSprites={
          mediaCaps.sprites
            ? () => {
                setSpritesFocusLabel(null);
                setSpritesOpen(true);
              }
            : undefined
        }
        spriteCount={spriteCount}
        showCardAssets={mediaCaps.namedAssets}
        cardAssetCount={namedCount}
        onOpenCardAssets={mediaCaps.namedAssets ? () => setNamedOpen(true) : undefined}
        variantArt={variantArt}
      />
      {ctx && onKnowledgeRefsChange && (
        <div style={{ marginTop: "0.75rem" }}>
          <KnowledgeRail
            ctx={ctx}
            refs={knowledgeRefs ?? []}
            onChange={onKnowledgeRefsChange}
          />
        </div>
      )}
    </>
  );
}
