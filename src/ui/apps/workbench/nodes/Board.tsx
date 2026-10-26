/**
 * The Board layer: free notes and frames on the canvas. Notes edit in place on double-click; a frame
 * is dragged by its label and resized by its corner. Board items belong to this workbench (prefs),
 * never to a piece. Pictures are not offered: see docs/reference/ui.md (Nodes view) for why.
 */
import { useState } from "react";
import type { JSX, PointerEvent } from "react";
import { Button } from "../../../components/button";
import { newUiId } from "../../../_shared/new-id";
import { isEscapeClose } from "../../../_shared/use-escape-key";
import type { BoardItem } from "./canvas-state";
import css from "./nodes.module.css";

const SIZES = { note: { w: 170, h: 110 }, frame: { w: 420, h: 200 }, image: { w: 160, h: 110 } } as const;

/** A new item centred on a world point. */
export function newBoardItem(type: "note" | "frame", centre: readonly [number, number]): BoardItem {
  const { w, h } = SIZES[type];
  return { id: newUiId("b-"), type, x: Math.round(centre[0] - w / 2), y: Math.round(centre[1] - h / 2), w, h, text: type === "frame" ? "Frame" : "" };
}

export function AddMenu({ disabled, onAdd }: { disabled: boolean; onAdd(type: "note" | "frame"): void }): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <span className={css.addWrap}>
      <Button variant="primary" disabled={disabled} title={disabled ? "Adding needs a wider window" : "Add to the board"} onClick={() => setOpen((o) => !o)}>+ Add</Button>
      {open && (
        <span role="menu" className={css.addMenu}>
          <Button size="sm" onClick={() => { setOpen(false); onAdd("note"); }}>Note</Button>
          <Button size="sm" onClick={() => { setOpen(false); onAdd("frame"); }}>Frame</Button>
        </span>
      )}
    </span>
  );
}

export interface BoardLayerProps {
  items: readonly BoardItem[];
  selectedId: string | null;
  editingId: string | null;
  readOnly: boolean;
  /** item name for the "pinned to" line */
  pinName(key: string): string | undefined;
  onDown(e: PointerEvent, item: BoardItem): void;
  onResizeDown(e: PointerEvent, item: BoardItem): void;
  onEdit(id: string | null): void;
  onText(id: string, text: string): void;
}

export function BoardLayer(p: BoardLayerProps): JSX.Element {
  return (
    <>
      {p.items.map((item) => {
        const sel = item.id === p.selectedId ? ` ${css.itemSel}` : "";
        const box = { left: item.x, top: item.y, width: item.w, height: item.h };
        if (item.type === "frame") {
          return (
            <div key={item.id} className={`${css.frame}${sel}`} style={box} data-board={item.id}>
              <b className={css.frameLabel} onPointerDown={(e) => p.onDown(e, item)}>{item.text || "Frame"}</b>
              {!p.readOnly && <span className={css.resize} onPointerDown={(e) => p.onResizeDown(e, item)} />}
            </div>
          );
        }
        if (item.type === "image") {
          return <div key={item.id} className={`${css.imageItem}${sel}`} style={box} data-board={item.id} onPointerDown={(e) => p.onDown(e, item)}>Picture</div>;
        }
        const editing = p.editingId === item.id && !p.readOnly;
        return (
          <div key={item.id} className={`${css.note}${sel}`} style={box} data-board={item.id} onPointerDown={(e) => p.onDown(e, item)} onDoubleClick={() => !p.readOnly && p.onEdit(item.id)}>
            {editing ? (
              <textarea
                className={css.noteEdit}
                autoFocus
                defaultValue={item.text ?? ""}
                aria-label="Note text"
                onPointerDown={(e) => e.stopPropagation()}
                // saved as it is typed (the canvas save waits for a pause), so leaving the view or Escape keeps it
                onChange={(e) => p.onText(item.id, e.currentTarget.value)}
                onBlur={() => p.onEdit(null)}
                onKeyDown={(e) => { if (isEscapeClose(e.nativeEvent)) p.onEdit(null); }}
              />
            ) : (
              <span className={css.noteText}>{item.text || "Double-click to write"}</span>
            )}
            <span className={css.by}>{item.pin ? `note · pinned to ${p.pinName(item.pin) ?? "a missing piece"}` : "note"}</span>
          </div>
        );
      })}
    </>
  );
}
