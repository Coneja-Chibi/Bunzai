/**
 * Loads what the Stage Gallery can show for one scene: the frozen portrait, the live card's extra art, the persona's portrait, and the
 * pictures of one pack (the scene's backdrop pack, else the library's first; the person can switch). A card or persona that is gone from
 * the library is simply not listed. Exposes `items`, so the Stage tab strip can show `countText(items.length)` as its Gallery chip.
 */
import { useEffect, useMemo, useState } from "react";
import { bodyOf, isRecord, str } from "../../../core/guards";
import type { Chat } from "../../../stage/contracts/chat-store";
import type { OpenScene } from "../../../studio/scenes";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { cardItems, packGalleryItems, personaItems, portraitItem, type GalleryItem } from "./stage-gallery-core";
import { useBackdropPack, type BackdropPackState } from "./use-backdrop-pack";

/** One library entity read through the editor's light read; null while loading and when it is gone or unreadable. */
function useLiveEntity(ctx: AppContext, kind: string, id: string | undefined): unknown {
  const [read, setRead] = useState<{ key: string; entity: unknown } | null>(null);
  const key = id ? `${kind}:${id}` : "";
  useEffect(() => {
    if (!id) return;
    let live = true;
    ctx.api.getLightEditableEntity(`kind=${kind}&id=${encodeURIComponent(id)}`).then(
      (loaded) => { if (live) setRead({ key, entity: loaded.entity }); },
      () => { if (live) setRead({ key, entity: null }); },
    );
    return () => { live = false; };
  }, [ctx, kind, id, key]);
  return read?.key === key ? read.entity : null;
}

export interface StageGallery {
  items: GalleryItem[];
  packs: StudioEntitySummary[];
  packId: string | undefined;
  setPackId(id: string): void;
  pack: BackdropPackState;
  /** False until the pack list has answered, so an empty first paint is not read as an empty scene. */
  ready: boolean;
}

export function useStageGallery(ctx: AppContext, chat: Chat, scene: Pick<OpenScene, "hasPortrait" | "snapshot">): StageGallery {
  const [packs, setPacks] = useState<StudioEntitySummary[] | null>(null);
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  useEffect(() => {
    let live = true;
    ctx.api.listEntities("pack").then((list) => { if (live) setPacks(list); }, () => { if (live) setPacks([]); });
    return () => { live = false; };
  }, [ctx]);
  const packId = chosen ?? chat.backdrop?.pack ?? packs?.[0]?.id;
  const pack = useBackdropPack(ctx, packId);
  const card = useLiveEntity(ctx, "character", chat.cast.character.id);
  const persona = useLiveEntity(ctx, "persona", chat.cast.persona?.id);
  const identity = bodyOf(scene.snapshot.character)["identity"];
  const name = (isRecord(identity) ? str(identity["name"]) : "") || "Character";
  const items = useMemo(() => [
    ...(scene.hasPortrait ? [portraitItem(chat.id, chat.snapshotVersion, name)] : []),
    ...cardItems(card),
    ...personaItems(persona),
    ...(pack.state === "ready" ? packGalleryItems(pack.pack) : []),
  ], [scene.hasPortrait, chat.id, chat.snapshotVersion, name, card, persona, pack]);
  return { items, packs: packs ?? [], packId, setPackId: setChosen, pack, ready: packs !== null };
}
