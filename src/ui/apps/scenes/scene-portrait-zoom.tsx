/**
 * A message portrait that enlarges on click (RoleCall's EditableMessage.tsx:1946 `cursor-zoom-in` + `openScenePortrait`): the portrait fills a
 * button, and the click opens the Stage Gallery's lightbox on the scene's frozen portrait, without its "Use as background" button. A scene
 * without art keeps the plain initial, which has nothing to enlarge. The click stops here so it does not also toggle the message's touch bar.
 */
import { useState, type ComponentProps, type JSX, type ReactNode } from "react";
import { SceneArt } from "./scene-art";
import { GalleryLightbox } from "./stage-gallery-lightbox";
import { portraitItem } from "./stage-gallery-core";
import { Tile } from "../../components/button";

export function PortraitZoom({ chatId, snapshotVersion, name, children }: { chatId: string; snapshotVersion: number; name: string; children: ReactNode }): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tile kind="thumb" size="fill" data-part="scene.portrait.zoom" title="View portrait" label={`View portrait of ${name}`} art={children} onClick={(e) => { e.stopPropagation(); setOpen(true); }} />
      {open && <span className="pzoom-dlg" onClick={(e) => e.stopPropagation()}><GalleryLightbox item={portraitItem(chatId, snapshotVersion, name)} onClose={() => setOpen(false)} /></span>}
    </>
  );
}

export function ZoomArt(props: ComponentProps<typeof SceneArt>): JSX.Element {
  const art = <SceneArt {...props} />;
  return props.hasArt ? <PortraitZoom chatId={props.chatId} snapshotVersion={props.snapshotVersion} name={props.name}>{art}</PortraitZoom> : art;
}
