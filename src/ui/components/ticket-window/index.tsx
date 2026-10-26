/**
 * TicketWindow - THE image surface, transcribed 1:1 from the LOCKED vs-image-picker wire: the art
 * hangs behind glass in a booth (black marquee names the slot, actions are ticket stubs) with a
 * strip of hangable thumbs under it. In the editors the strip IS the variant strip (alt art is a
 * variant, not a parallel concept), rendered by the caller under the booth; the built-in strip here
 * serves deployments with their own thumb store (galleries, backgrounds) and renders only when one
 * is wired. Click or drop on the glass hangs art. The naked file input never renders.
 */
import { Button, Card, Tile } from "../button";
import { useRef, useState, type JSX, type RefCallback } from "react";
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
const readImageFiles = async (files: ArrayLike<File>, upload?: AssetUpload): Promise<MediaAsset[]> => {
  const settled = await Promise.allSettled(
    Array.from(files).filter((f) => f.type.startsWith("image/")).map((file) => readImageFile(file, upload)),
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

  const hangFirst = async (files: ArrayLike<File> | null): Promise<void> => {
    if (!canEdit || !files || files.length === 0) return;
    const [first] = await readImageFiles(files, uploadAsset);
    if (first) onPick(first);
  };

  return (
    <div className={styles.sheet}>
      <div className={styles.booth}>
        <div className={styles.marquee}>
          <span>{label}</span>
          {title ? <span className={styles.marqueeTitle}>{title}</span> : <span>·</span>}
        </div>
        {/* The observed element is the glass itself: it exists while the booth is empty, which is when stored art needs to start loading. */}
        {/* The Card owns the drop and its art face; this frame only tracks drag-over so the stub below can say "release to replace". */}
        <div
          className={`${styles.glass}${dragOver ? ` ${styles.glassDrag}` : ""}`}
          onDragOver={canEdit ? () => setDragOver(true) : undefined}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false); }}
          onDrop={() => setDragOver(false)}
        >
          <Card
            kind="drop"
            ref={artRef}
            title={canEdit ? "Click or drop to hang art" : undefined}
            disabled={!canEdit}
            art={artUrl ? <img src={artUrl} alt="" /> : undefined}
            onFiles={canEdit ? (files) => void hangFirst(files) : undefined}
            onClick={() => pickRef.current?.click()}
          >
            {!artUrl && (
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
          </Card>
        </div>
        {canEdit && (
          <div className={styles.stubs}>
            {dragOver ? (
              <span className={`${styles.stub} ${styles.stubPrimary}`}>release to replace</span>
            ) : (
              <>
                <Button size="sm" onClick={() => pickRef.current?.click()}>
                  {artUrl ? "change" : "choose art"}
                </Button>
                {artUrl && onRemove && (
                  <Button size="sm" variant="danger" onClick={onRemove}>
                    Remove
                  </Button>
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
            <Tile
              key={alt.id}
              kind="thumb"
              label={alt.label ?? "Hang this art"}
              selected={alt.active}
              art={<span className={styles.thumbArt}><AlternateArt url={alt.url} />{alt.label ? <span className={styles.thumbTag}>{alt.label}</span> : null}</span>}
              onClick={() => onHang?.(alt.id)}
            />
          ))}
          <Tile
            kind="add"
            label={onAdd ? "Add alternates" : "Hang new art"}
            onClick={() => (onAdd ? addRef.current : pickRef.current)?.click()}
          />
        </div>
        </>
      )}
      <input
        ref={pickRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className={styles.hiddenFile}
        onChange={(e) => {
          void hangFirst(e.target.files ? [...e.target.files] : null);
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
