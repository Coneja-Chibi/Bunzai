/**
 * The Stage wing's Gallery tab (RoleCall ImageGalleryPanel.tsx): the scene's pictures in a grid, a tile opens an enlarged view, and Use as
 * background hangs one behind the messages. RoleCall lists the pictures in a chat's messages; Bunzai messages carry none, so this lists the
 * cast's art and one pack (use-stage-gallery.ts). Struck from RoleCall: generated "Received" images and the Sent filter. `onChat` takes the
 * scene's chat back from setSceneBackdrop, as the Backdrop row's does. The tab body carries no title; the Stage strip owns it.
 */
import { useState, type JSX } from "react";
import { toErrorMessage } from "../../_shared/error-message";
import { SegControl } from "../settings/section-contract";
import { applyAsBackdrop } from "./stage-gallery-apply";
import { GALLERY_TABS, countText, visibleItems, type GalleryItem, type GalleryTab } from "./stage-gallery-core";
import { GalleryGrid } from "./stage-gallery-grid";
import { GalleryLightbox } from "./stage-gallery-lightbox";
import { GALLERY_STYLE } from "./stage-gallery-style";
import type { StageTab, StageTabProps } from "./stage-tabs";
import { useStageGallery } from "./use-stage-gallery";
import { Segmented } from "../../components/button";

export function StageGallery({ ctx, chat, scene, onChat }: StageTabProps): JSX.Element {
  const gallery = useStageGallery(ctx, chat, scene);
  const [tab, setTab] = useState<GalleryTab>("all");
  const [open, setOpen] = useState<GalleryItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const shown = visibleItems(gallery.items, tab);
  const use = async (item: GalleryItem): Promise<void> => {
    setBusy(true);
    setNote(null);
    try {
      onChat(await applyAsBackdrop(ctx, chat, item));
      setOpen(null);
    } catch (e) {
      setNote(toErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="wbody sg" data-part="scene.stage.gallery">
      <style>{GALLERY_STYLE}</style>
      {gallery.items.length > 0 && (
        <div className="sg-head">
          <Segmented label="Show" size="sm" items={GALLERY_TABS.map((t) => ({ value: t.id, label: t.label }))} value={tab} onChange={setTab} />
          <span className="sg-count">{countText(gallery.items.length)} in this scene</span>
        </div>
      )}
      {tab !== "cast" && gallery.packs.length > 1 && gallery.packId && (
        <SegControl options={gallery.packs.map((p) => ({ value: p.id, label: p.name || "Untitled pack" }))} current={gallery.packId} onPick={gallery.setPackId} />
      )}
      {note && <p className="sg-note" role="alert">{note}</p>}
      {shown.length > 0 ? <GalleryGrid items={shown} onOpen={(item) => { setNote(null); setOpen(item); }} /> : gallery.ready && gallery.pack.state !== "loading" && (
        <div className="sg-empty"><b>No images in this scene yet</b><span>Add art to the character, the persona or a pack in the Library and it shows here.</span></div>
      )}
      {open && <GalleryLightbox item={open} busy={busy} onUse={() => void use(open)} onClose={() => setOpen(null)} />}
    </div>
  );
}

export const GALLERY_TAB: StageTab = { id: "gallery", label: "Gallery", visible: () => true, Panel: StageGallery };
