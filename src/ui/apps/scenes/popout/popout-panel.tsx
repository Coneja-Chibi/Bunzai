/**
 * The floating panel and the two things that stand for it in the docked spot (RoleCall `LorebookActivityFeed.tsx:747-842`): the
 * header you drag by, with Dock back and Close (both dock, as in RoleCall), and the placeholder with Bring back. Square corners and a
 * hard shadow replace RoleCall's blur. The drag keeps the whole panel in the scene (its real size, not RoleCall's fixed 200px), the
 * panel takes focus when the person opens it, Escape inside it docks it, and focus goes back to the docked spot.
 */
import { useEffect, useRef, useState, type JSX, type PointerEvent as ReactPointerEvent } from "react";
import { Button, IconButton } from "../../../components/button";
import { Ic } from "../../../_shared/ic";
import { isEscapeClose } from "../../../_shared/use-escape-key";
import { isTypingTarget } from "../../../_shared/typing-target";
import { clampPopout, defaultPopout, POPOUT_WIDTH, type Box, type Pos } from "./popout-core";
import { consumeUserOpen } from "./popout-store";
import type { PopoutContext, PopoutKind } from "./popout-kind";

const originOf = (id: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-popout-origin="${id}"]`);

/** The docked spot's button: it floats the content. */
export function PopoutButton({ id, onClick }: { id: string; onClick(): void }): JSX.Element {
  return <IconButton size="sm" label="Pop out" icon="lucide:external-link" data-popout-origin={id} onClick={onClick} />;
}

/** What the docked spot shows while its panel floats. */
export function PopoutPlaceholder({ kind, onBack }: { kind: PopoutKind; onBack(): void }): JSX.Element {
  return (
    <div className="po-ph" data-part="scene.popout.placeholder">
      <span className="ring"><Ic name="lucide:external-link" size={16} /></span>
      <p>{kind.noun} is floating</p>
      <Button variant="quiet" size="sm" data-popout-origin={kind.id} onClick={onBack}>Bring back</Button>
    </div>
  );
}

export function PopoutPanel({ kind, c, saved, view, onDrop, onClose }: { kind: PopoutKind; c: PopoutContext; saved: Pos | null; view: Box; onDrop(pos: Pos): void; onClose(): void }): JSX.Element {
  const panel = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ pos: Pos; from: { x: number; y: number; at: Pos } } | null>(null);
  const width = kind.width ?? POPOUT_WIDTH;
  const size = (): Box => ({ width, height: panel.current?.offsetHeight ?? 0 });
  const at = clampPopout(drag?.pos ?? saved ?? defaultPopout(kind, view), size(), view);

  useEffect(() => {
    if (consumeUserOpen(kind.id)) panel.current?.focus();
    return () => {
      const active = document.activeElement;
      if (!active || active === document.body) originOf(kind.id)?.focus();
    };
  }, [kind.id]);

  const down = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ pos: at, from: { x: e.clientX, y: e.clientY, at } });
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (drag) setDrag({ ...drag, pos: clampPopout({ x: drag.from.at.x + e.clientX - drag.from.x, y: drag.from.at.y + e.clientY - drag.from.y }, size(), view) });
  };
  const up = (): void => {
    if (!drag) return;
    setDrag(null);
    onDrop(drag.pos);
  };

  return (
    <div className="po" ref={panel} role="dialog" aria-label={kind.title} tabIndex={-1} data-popout={kind.id} data-part={`scene.popout.${kind.id}`} style={{ left: at.x, top: at.y, width }}
      onKeyDown={(e) => { if (isEscapeClose(e.nativeEvent) && !isTypingTarget(e.target)) { e.preventDefault(); onClose(); } }}>
      <div className={`po-hd${drag ? " drag" : ""}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <Ic name="lucide:grip-vertical" size={14} />
        <b>{kind.title}</b>
        <i className="dot" aria-hidden="true" />
        <span className="grow" />
        <IconButton size="sm" label="Dock back" icon="lucide:minimize-2" onClick={onClose} />
        <IconButton size="sm" label="Close" icon="lucide:x" onClick={onClose} />
      </div>
      <div className="po-body">{kind.render(c)}</div>
    </div>
  );
}
