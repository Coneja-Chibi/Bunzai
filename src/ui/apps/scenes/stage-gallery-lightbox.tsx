/**
 * The Gallery's enlarged view (RoleCall's lightbox, ImageGalleryPanel.tsx: the picture, Download, Close) with Use as background beside
 * them. The picture comes through the shared art cache or the asset route on the page's own origin and is shown by SealedMedia, so nothing
 * is fetched from anywhere else. Download saves the picture's bytes under its name.
 */
import { useState, type JSX } from "react";
import { InkDialog } from "../../components/ink-dialog";
import { SealedMedia } from "../../components/sealed-media";
import { Stamp } from "../../components/stamp";
import { artCache, useArtSrc } from "../../_shared/art-cache";
import { toErrorMessage } from "../../_shared/error-message";
import { isVideoRef, refSha } from "./scene-backdrop-core";
import { downloadName, portraitIdentity, type GalleryItem } from "./stage-gallery-core";

/** Saves a picture's bytes through the browser's own download, named for it. */
async function download(item: GalleryItem): Promise<void> {
  const blob = await artCache.getBlob(item.url ?? item.ref ?? "", item.url ? portraitIdentity(item.url) : undefined);
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = downloadName(item.label, blob.type || item.mime);
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 0);
}

/** `onUse` is absent where the picture is only for looking at (a message portrait), and the button goes with it. */
export function GalleryLightbox({ item, busy = false, onUse, onClose }: { item: GalleryItem; busy?: boolean; onUse?(): void; onClose(): void }): JSX.Element {
  const [note, setNote] = useState<string | null>(null);
  const video = item.ref !== undefined && isVideoRef(item.ref, item.mime);
  const art = useArtSrc(video ? null : item.url ?? item.ref ?? null, item.url ? portraitIdentity(item.url) : undefined);
  const sha = video && item.ref ? refSha(item.ref) : null;
  return (
    <InkDialog onDismiss={onClose} ariaLabel={item.label} sheetClassName="sgl">
      <h2>{item.label}</h2>
      <div className="view" data-part="scene.stage.lightbox">
        <SealedMedia kind={video ? "video" : "image"} src={video ? (sha ? `/api/asset/${sha}` : null) : art.src ?? null} name={item.label} artRef={art.ref} />
      </div>
      {note && <p className="hint">{note}</p>}
      <div className="actions">
        <Stamp onClick={() => void download(item).catch((e: unknown) => setNote(`Could not download: ${toErrorMessage(e)}`))}>Download</Stamp>
        {onUse && <Stamp onClick={onUse} disabled={busy}>{busy ? "Working..." : "Use as background"}</Stamp>}
        <Stamp onClick={onClose}>Close</Stamp>
      </div>
    </InkDialog>
  );
}
