/**
 * The floating activity button (RoleCall's FloatingDMActivity.tsx): a 40px clapperboard button the person can drag, hidden until the Director has logged something, a badge counting the lines
 * from the last five minutes, a border that pulses in the newest line's color for six seconds, and a 320px popover of the last ten lines with "View All Activity ->" (which opens the panel on
 * its Activity tab, floating over the scene). Square, not round (the app's corner rule). The lines come from the saved story (use-director-panel.ts), so they are here after a reload; the pulse
 * is one CSS animation keyed to the newest line, so nothing ticks in the background. The place is a per-viewer pref.
 */
import { useEffect, useRef, useState, type CSSProperties, type JSX, type PointerEvent as ReactPointerEvent } from "react";
import type { AppContext } from "../../../../app-contract";
import type { Chat } from "../../../../../stage/contracts/chat-store";
import { Button, IconButton } from "../../../../components/button";
import { Ic } from "../../../../_shared/ic";
import { useEscapeKey } from "../../../../_shared/use-escape-key";
import { ACTIVITY_LABELS, ACTIVITY_TONES, PULSE_MS, activityNewestFirst, recentCount } from "./director-core";
import { directorPanelPopout } from "./director-panel";
import { requestDirectorTab } from "./director-live";
import { ActivityLine } from "./director-parts";
import { usePopout } from "../../popout/popout-store";
import { useDirectorPanel } from "./use-director-panel";

const PREF = "scenes.director.fab";
const SIZE = 40;
const MOVE = 3;
type Spot = { x: number; y: number };
const readSpot = (v: unknown): Spot | null => (typeof v === "object" && v !== null && typeof (v as Spot).x === "number" && typeof (v as Spot).y === "number" ? { x: (v as Spot).x, y: (v as Spot).y } : null);

export function DirectorFab({ ctx, chat }: { ctx: AppContext; chat: Chat }): JSX.Element | null {
  const { load } = useDirectorPanel(ctx, chat);
  const pop = usePopout(ctx, directorPanelPopout.id);
  const [open, setOpen] = useState(false);
  const [spot, setSpot] = useState<Spot | null>(() => readSpot(ctx.prefs.get(PREF)));
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean; last?: Spot } | null>(null);
  const dragged = useRef(false);
  const [anchor, setAnchor] = useState<{ below: boolean; right: boolean }>({ below: false, right: false });
  useEscapeKey(() => setOpen(false), open);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent): void => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const entries = load.state === "ready" ? activityNewestFirst(load.panel.state.activity) : [];
  if (load.state !== "ready" || entries.length === 0) return null;
  const now = Date.now();
  const newest = entries[0]!;
  const pulsing = now - newest.at < PULSE_MS;
  const count = recentCount(entries, now);
  const parent = (): DOMRect | null => box.current?.parentElement?.getBoundingClientRect() ?? null;

  const down = (e: ReactPointerEvent<HTMLButtonElement>): void => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const here = box.current?.getBoundingClientRect();
    const area = parent();
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: here && area ? here.left - area.left : 0, oy: here && area ? here.top - area.top : 0, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e: ReactPointerEvent<HTMLButtonElement>): void => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.abs(dx) <= MOVE && Math.abs(dy) <= MOVE) return;
    d.moved = true;
    const area = parent();
    const clamp = (v: number, max: number): number => Math.max(0, Math.min(v, Math.max(0, max)));
    d.last = { x: clamp(d.ox + dx, (area?.width ?? 0) - SIZE), y: clamp(d.oy + dy, (area?.height ?? 0) - SIZE) };
    setSpot(d.last);
  };
  const up = (e: ReactPointerEvent<HTMLButtonElement>): void => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.moved) { dragged.current = true; if (d.last) ctx.prefs.set(PREF, d.last); }
  };
  const click = (): void => {
    if (dragged.current) { dragged.current = false; return; }
    if (!open) {
      const here = box.current?.getBoundingClientRect();
      const area = parent();
      if (here && area && area.width > 0) setAnchor({ below: here.top - area.top < area.height / 2, right: here.left - area.left < area.width / 2 });
    }
    setOpen(!open);
  };
  const style = { ...(spot ? { left: spot.x, top: spot.y } : { right: 96, bottom: 144 }), "--c": ACTIVITY_TONES[newest.type] } as unknown as CSSProperties;

  return (
    <div className="dr-fab" ref={box} style={style} data-part="scene.director.fab">
      {open && (
        <div className={`dr-fab-pop${anchor.below ? " below" : ""}${anchor.right ? " right" : ""}`} role="dialog" aria-label="Story Director Activity" data-part="scene.director.fab.popover">
          <div className="dr-fab-hd"><Ic name="mdi:drama-masks" size={12} /><span>Story Director Activity</span></div>
          <div className="dr-fab-list">
            {entries.slice(0, 10).map((e) => <ActivityLine key={e.id} entry={e} now={now} clamp />)}
          </div>
          <div className="dr-fab-foot"><Button variant="quiet" size="sm" block onClick={() => { setOpen(false); requestDirectorTab(chat.id, "activity"); pop.open(); }}>View All Activity {"->"}</Button></div>
        </div>
      )}
      <IconButton key={pulsing ? newest.id : "rest"} size="fab" label="Story Director Activity" icon="mdi:drama-masks" data-part="scene.director.fab.button" data-pulse={pulsing || undefined}
        title={pulsing ? `DM: ${ACTIVITY_LABELS[newest.type]}` : "Story Director Activity"} aria-expanded={open}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={click} />
      {count > 0 && !open && <span className="dr-fab-badge" data-part="scene.director.fab.badge">{count > 99 ? "99+" : count}</span>}
    </div>
  );
}
