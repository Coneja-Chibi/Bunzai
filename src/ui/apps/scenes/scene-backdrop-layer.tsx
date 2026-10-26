/**
 * The picture or video behind a scene's messages (ChatStore rule 36): the picked pack item, covering the scene and
 * centered (RoleCall BackgroundMedia.tsx:132-151), under an overlay of the theme's own well color at the scene's dim.
 * A video loops muted and plays at the scene's rate, and pauses while the tab is hidden (BackgroundMedia.tsx:56-110);
 * it loads from the asset route on the page's own origin, the only place the page policy lets media come from. The layer
 * draws nothing when no backdrop is picked and the card pins none, or the pack or item is gone (the Stage wing's row says
 * so), so the theme's own `scene.backdrop` look shows through unchanged.
 */
import { useEffect, useRef, useState, type CSSProperties, type JSX } from "react";
import type { AppContext } from "../../app-contract";
import { useArtSrc } from "../../_shared/art-cache";
import type { ChatBackdrop } from "../../../stage/contracts/chat-store";
import { blurOf, blurStyle, dimOf, isVideoRef, itemOf, rateOf, refSha, veilOf, type CharacterBackdrop } from "./scene-backdrop-core";
import { useBackdropPack } from "./use-backdrop-pack";

/** What to draw: a ref, its overlay, and for a video its speed. */
interface Shown { ref: string; dim: number; video: boolean; rate: number; blur: number }

/** A looping muted video from the asset route; it holds still while the tab is hidden, so it costs nothing unseen. */
export function BackdropVideo({ sha, rate, className, style }: { sha: string; rate: number; className?: string; style?: CSSProperties }): JSX.Element {
  const el = useRef<HTMLVideoElement | null>(null);
  useEffect(() => { if (el.current) el.current.playbackRate = rate; }, [rate, sha]);
  useEffect(() => {
    const onVisibility = (): void => {
      const v = el.current;
      if (!v) return;
      if (document.hidden) v.pause();
      else void v.play().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  return <video key={sha} ref={el} className={className} style={style} src={`/api/asset/${sha}`} autoPlay loop muted playsInline preload="metadata" />;
}

/** `backdrop` is the scene's pick; `character` is the card's pinned background, shown only while the scene has no pick of its own (RoleCall useCharacterLoad.ts:556-577). */
export function BackdropLayer({ ctx, backdrop, character }: { ctx: AppContext; backdrop: ChatBackdrop | undefined; character?: CharacterBackdrop | null }): JSX.Element | null {
  const loaded = useBackdropPack(ctx, backdrop?.pack);
  const item = backdrop && loaded.state === "ready" ? itemOf(loaded.pack, backdrop) : null;
  const shown: Shown | null = backdrop
    ? item ? { ref: item.ref, dim: dimOf(backdrop), video: isVideoRef(item.ref, item.mime), rate: rateOf(backdrop), blur: blurOf(backdrop) } : null
    : character ? { ref: character.ref, dim: character.dim, video: character.video === true, rate: character.rate ?? 1, blur: 0 } : null;
  const sha = shown?.video ? refSha(shown.ref) : null;
  const art = useArtSrc(shown && !shown.video ? shown.ref : null);
  if (!shown) return null;
  return (
    <div className="bdp" data-part="scene.backdrop.image" aria-hidden="true">
      {shown.video
        ? sha && <BackdropVideo sha={sha} rate={shown.rate} style={blurStyle(shown.blur)} />
        : <img ref={art.ref as (node: HTMLImageElement | null) => void} src={art.src} style={blurStyle(shown.blur)} alt="" draggable={false} />}
      <div className="veil" style={{ background: veilOf(shown.dim) }} />
    </div>
  );
}

/** A small picture of a pack item, for the picker's tiles and the Stage wing's row. It asks for a thumbnail and falls back to the full picture when the server cannot make one; a video shows its first frame. */
export function BackdropThumb({ refValue, mime, className }: { refValue: string; mime?: string; className?: string }): JSX.Element {
  const [full, setFull] = useState(false);
  const video = isVideoRef(refValue, mime);
  const art = useArtSrc(video ? null : refValue, undefined, full ? undefined : "256");
  useEffect(() => { if (art.failed) setFull(true); }, [art.failed]);
  const sha = video ? refSha(refValue) : null;
  return (
    <span className={className}>
      {video
        ? sha && <video src={`/api/asset/${sha}#t=0.1`} muted playsInline preload="metadata" />
        : <img ref={art.ref as (node: HTMLImageElement | null) => void} src={art.src} alt="" draggable={false} />}
    </span>
  );
}
