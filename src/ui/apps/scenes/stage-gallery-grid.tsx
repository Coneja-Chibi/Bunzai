/**
 * The Gallery's grid: two square tiles a row (RoleCall `grid grid-cols-2 gap-2`, `aspect-square`), windowed by the shared virtualizer so a pack of
 * thousands mounts only the rows in view. A tile asks for a 256 thumbnail (BackdropThumb), never the full picture; RoleCall's 60-per-page
 * "Load more" is replaced by the window. The hover strip names the source and the picture where RoleCall shows "Sent/Received" and a date.
 */
import { useRef, type JSX } from "react";
import { useArtSrc } from "../../_shared/art-cache";
import { rowsOf, useVirtualRows } from "../../_shared/virtual-list";
import { BackdropThumb } from "./scene-backdrop-layer";
import { portraitIdentity, type GalleryItem, type GallerySource } from "./stage-gallery-core";

const SOURCE_LABEL: Record<GallerySource, string> = { card: "Card", persona: "Persona", pack: "Pack" };
const COLUMNS = 2;
const ROW_ESTIMATE = 180;

/** The scene's frozen portrait: one picture from a route, so there is no size to ask for. */
function PortraitThumb({ url }: { url: string }): JSX.Element {
  const art = useArtSrc(url, portraitIdentity(url));
  return <span className="th"><img ref={art.ref as (node: HTMLImageElement | null) => void} src={art.src} alt="" draggable={false} /></span>;
}

function Thumb({ item }: { item: GalleryItem }): JSX.Element {
  return item.url
    ? <PortraitThumb url={item.url} />
    : <BackdropThumb refValue={item.ref ?? ""} {...(item.mime ? { mime: item.mime } : {})} className="th" />;
}

export function GalleryGrid({ items, onOpen }: { items: readonly GalleryItem[]; onOpen(item: GalleryItem): void }): JSX.Element {
  const scroller = useRef<HTMLDivElement | null>(null);
  const rows = rowsOf(items, COLUMNS);
  const virtual = useVirtualRows({ mode: "variable", count: rows.length, getScrollElement: () => scroller.current, estimateSize: () => ROW_ESTIMATE });
  return (
    <div className="sg-scroll" ref={scroller} data-part="scene.stage.gallery.grid">
      <div className="sg-space" role="list" aria-label="Images" style={{ height: virtual.getTotalSize() }}>
        {virtual.getVirtualItems().map((row) => (
          <div key={row.key} className="sg-row" data-index={row.index} ref={virtual.measureElement} style={{ transform: `translateY(${String(row.start)}px)` }}>
            {rows[row.index]?.map((item, col) => (
              <button type="button" role="listitem" key={item.id} className="sg-tile" title={`${SOURCE_LABEL[item.source]}: ${item.label}`}
                aria-setsize={items.length} aria-posinset={row.index * COLUMNS + col + 1} onClick={() => onOpen(item)}>
                <Thumb item={item} />
                <span className="strip"><b>{SOURCE_LABEL[item.source]}</b><span>{item.label}</span></span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
