/**
 * TicketWindow - THE image surface, transcribed 1:1 from the LOCKED vs-image-picker wire: the art
 * hangs behind glass in a booth (black marquee names the slot, actions are ticket stubs) with a
 * strip of hangable thumbs under it. In the editors the strip IS the variant strip (alt art is a
 * variant, not a parallel concept), rendered by the caller under the booth; the built-in strip here
 * serves deployments with their own thumb store (galleries, backgrounds) and renders only when one
 * is wired. Click or drop on the glass hangs art. The naked file input never renders.
 */
import { useRef, useState, type DragEvent, type JSX, type RefCallback } from "react";
import type { MediaAsset } from "../../../entities/character/schema";
import { portraitFromRef } from "../../../core/media";
import { useArtSrc } from "../../_shared/art-cache";
import type { AssetUpload } from "../../_shared/asset-upload";
import styles from "./styles.module.css";

export interface TicketAlternate {
  id: string;
  url: string;
  label?: string;
  active?: boolean;
}

function AlternateArt({ url }: { url: string }): JSX.Element {
  const art = useArtSrc(url);
  return <img ref={art.ref as RefCallback<HTMLImageElement>} src={art.src} alt="" />;
}

export interface TicketWindowProps {
  /** marquee slot name ("portrait", "background") */
  label: string;
  /** marquee right side, usually the piece name */
  title?: string;
  /** the hung art (previewable url or data URI), or null for the empty booth */
  artUrl: string | null;
  artRef?: RefCallback<Element>;
  /** empty-state letter (the piece's monogram) */
  monogram: string;
  /** hang new art from a picked/dropped file; absent makes the surface read-only */
  onPick?: (asset: MediaAsset) => void;
  /** remove the hung art (stub only renders when art exists) */
  onRemove?: () => void;
  /** the strip's thumbs; the active one is the hung art */
  alternates?: readonly TicketAlternate[];
  /** hang an alternate by id */
  onHang?: (id: string) => void;
  /** multi-add for gallery-capable surfaces; absent, the + tile behaves as onPick (add-and-hang) */
  onAdd?: (assets: MediaAsset[]) => void;
  /** Stages selected image bytes for an editor-owned conditional patch. */
  uploadAsset?: AssetUpload;
}

const IMAGE_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp,image/gif";

/** The mono microlabel naming a strip shelf; siblings (variants, expressions) borrow it so every
 *  strip under the booth is named in the same voice. */
export function ShelfKicker({ children }: { children: string }): JSX.Element {
  return <span className={styles.shelfKick}>{children}</span>;
}

const readImageFile = async (file: File, upload?: AssetUpload): Promise<MediaAsset> => {
  if (upload) {
    const uploaded = await upload(file);
    const asset = portraitFromRef(uploaded.ref, uploaded.mime);
    if (!asset) throw new Error(`ticket-window: could not stage ${file.name}`);
    return { ...asset, label: file.name };
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const asset = typeof reader.result === "string" ? portraitFromRef(reader.result) : null;
      if (asset) resolve({ ...asset, label: asset.label ?? file.name });
      else reject(new Error(`ticket-window: could not read ${file.name}`));
    };
    reader.onerror = () => reject(new Error(`ticket-window: could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
};

/** Every readable image from a picked/dropped file list; unreadable files skip (never hang the add). */
const readImageFiles = async (files: FileList, upload?: AssetUpload): Promise<MediaAsset[]> => {
  const settled = await Promise.allSettled(
    [...files].filter((f) => f.type.startsWith("image/")).map((file) => readImageFile(file, upload)),
  );
  return settled
    .filter((s): s is PromiseFulfilledResult<MediaAsset> => s.status === "fulfilled")
    .map((s) => s.value);
};

export function TicketWindow({
  label,
  title,
  artUrl,
  artRef,
  monogram,
  onPick,
  onRemove,
  alternates,
  onHang,
  onAdd,
  uploadAsset,
}: TicketWindowProps): JSX.Element {
  const pickRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const canEdit = typeof onPick === "function";

  const hangFirst = async (files: FileList | null): Promise<void> => {
    if (!canEdit || !files || files.length === 0) return;
    const [first] = await readImageFiles(files, uploadAsset);
    if (first) onPick(first);
  };

  const onDrop = (e: DragEvent): void => {
    e.preventDefault();
    setDragOver(false);
    void hangFirst(e.dataTransfer.files);
  };

  return (
    <div className={styles.sheet}>
      <div className={styles.booth}>
        <div className={styles.marquee}>
          <span>{label}</span>
          {title ? <span className={styles.marqueeTitle}>{title}</span> : <span>·</span>}
        </div>
        {/* The observed element is the glass itself: it exists while the booth is empty, which is when stored art needs to start loading. */}
        <button
          ref={artRef}
          type="button"
          className={`${styles.glass}${dragOver ? ` ${styles.glassDrag}` : ""}`}
          title={canEdit ? "Click or drop to hang art" : undefined}
          disabled={!canEdit}
          onClick={() => pickRef.current?.click()}
          onDragOver={(e) => {
            if (!canEdit) return;
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={canEdit ? onDrop : undefined}
        >
          {artUrl ? (
            <img src={artUrl} alt="" />
          ) : (
            <>
              <span className={styles.monogram}>{monogram}</span>
              {canEdit && (
                <span className={styles.emptyLine}>
                  no art hung yet
                  <br />
                  drop it here · or click
                </span>
              )}
            </>
          )}
        </button>
        {canEdit && (
          <div className={styles.stubs}>
            {dragOver ? (
              <span className={`${styles.stub} ${styles.stubPrimary}`}>release to replace</span>
            ) : (
              <>
                <button type="button" className={`${styles.stub} ${styles.stubPrimary}`} onClick={() => pickRef.current?.click()}>
                  {artUrl ? "change" : "choose art"}
                </button>
                {artUrl && onRemove && (
                  <button type="button" className={styles.stub} onClick={onRemove}>
                    remove
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {canEdit && (alternates !== undefined || onAdd !== undefined) && (
        <>
        <ShelfKicker>alternates</ShelfKicker>
        <div className={styles.strip}>
          {(alternates ?? []).map((alt) => (
            <button
              key={alt.id}
              type="button"
              className={`${styles.thumb}${alt.active ? ` ${styles.thumbOn}` : ""}`}
              title={alt.label ?? "hang this art"}
              onClick={() => onHang?.(alt.id)}
            >
              <AlternateArt url={alt.url} />
              {alt.label ? <span className={styles.thumbTag}>{alt.label}</span> : null}
            </button>
          ))}
          <button
            type="button"
            className={`${styles.thumb} ${styles.thumbAdd}`}
            title={onAdd ? "Add alternates" : "Hang new art"}
            onClick={() => (onAdd ? addRef.current : pickRef.current)?.click()}
          >
            +
          </button>
        </div>
        </>
      )}
      <input
        ref={pickRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className={styles.hiddenFile}
        onChange={(e) => {
          void hangFirst(e.target.files);
          e.target.value = "";
        }}
      />
      {onAdd && (
        <input
          ref={addRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          className={styles.hiddenFile}
          onChange={(e) => {
            const files = e.target.files;
            if (files) void readImageFiles(files, uploadAsset).then((assets) => assets.length > 0 && onAdd(assets));
            e.target.value = "";
          }}
        />
      )}
    </div>
  );
}
