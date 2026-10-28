/**
 * TrackHare's Stage (wireframe states `stage`/`panel`/`miss`/`settings`/`chains`/`tokens`): the
 * button, its badge, drag and resize, and which of the popover/options/Chains/Tokens is open. Data
 * comes from `ctx.api.getSceneTrace` (th-contract.md); position, size, and the popover's own options
 * are per-viewer prefs under `trackhare.*` (app-contract.ts). Presentational parts live in
 * hare-popover.tsx, hare-options.tsx, and chains-sheet.tsx; T2b's tokens-sheet.tsx is opened, never
 * edited.
 */
import { useEffect, useRef, useState, type CSSProperties, type JSX, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Dot, IconButton } from "../../../../components/button";
import type { AppContext } from "../../../../app-contract";
import { useEscapeKey } from "../../../../_shared/use-escape-key";
import type { Chat } from "../../../../../stage/contracts/chat-store";
import { HareLogo } from "./hare-logo";
import { HarePopover, type TraceState } from "./hare-popover";
import { HareOptions } from "./hare-options";
import { hareTracePopout } from "./hare-popout";
import { PopoutPlaceholder } from "../../popout/popout-panel";
import { usePopout } from "../../popout/popout-store";
import { ChainsSheet } from "./chains-sheet";
import { TokensSheet } from "./tokens-sheet";
import { useSceneSignals } from "../../scene-signals";
import {
  badgeCount, clampButtonRect, DEFAULT_BUTTON_RECT, parseButtonRect, parseDensity, parseSort,
  HARE_PREFS, type ButtonRect, type Density, type SortMode,
} from "./hare-core";
import { boolOr } from "../../../../../core/guards";

const MOVE_THRESHOLD = 10;
const LONG_PRESS_MS = 500;
type Panel = "popover" | "options" | "chains" | "tokens" | null;

export function HareStage({ ctx, chat }: { ctx: AppContext; chat: Chat }): JSX.Element {
  const { version } = useSceneSignals(chat.id); // a swipe or a regenerate moves the take's version, not the chat's updatedAt
  const [rect, setRect] = useState<ButtonRect>(() => parseButtonRect(ctx.prefs.get(HARE_PREFS.button)) ?? DEFAULT_BUTTON_RECT);
  const [density, setDensity] = useState<Density>(() => parseDensity(ctx.prefs.get(HARE_PREFS.density)));
  const [group, setGroup] = useState(() => boolOr(ctx.prefs.get(HARE_PREFS.group), true));
  const [sort, setSort] = useState<SortMode>(() => parseSort(ctx.prefs.get(HARE_PREFS.sort)));
  const [misses, setMisses] = useState(() => boolOr(ctx.prefs.get(HARE_PREFS.misses), true));
  const [panel, setPanel] = useState<Panel>(null);
  const [traceState, setTraceState] = useState<TraceState>({ state: "loading" });
  const [selectedMessageId, setSelectedMessageId] = useState<string | undefined>(undefined);

  const tracePop = usePopout(ctx, hareTracePopout.id);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fabRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const chainsRef = useRef<HTMLElement>(null);
  const requestId = useRef(0);
  const restoreFocus = useRef<HTMLElement | null>(null);

  const containerSize = (): { width: number; height: number } => {
    const parent = fabRef.current?.parentElement;
    const box = parent?.getBoundingClientRect();
    return box ? { width: box.width, height: box.height } : { width: 0, height: 0 };
  };

  const fetchTrace = async (messageId?: string): Promise<void> => {
    const id = ++requestId.current;
    setTraceState({ state: "loading" });
    try {
      const trace = await ctx.api.getSceneTrace(chat.id, messageId);
      if (id === requestId.current) setTraceState({ state: "ready", trace });
    } catch (e) {
      if (id === requestId.current) setTraceState({ state: "failed", why: e instanceof Error && e.message ? e.message : "TrackHare couldn't read this reply." });
    }
  };

  // The latest reply, on mount and whenever the scene's take or latest reply changes.
  useEffect(() => {
    setSelectedMessageId(undefined);
    void fetchTrace(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id, chat.updatedAt, chat.activeBranchId, version]);

  useEffect(() => {
    setRect((r) => clampButtonRect(r, containerSize()));
  }, []);

  // Escape closes whichever panel is open; focus returns to the button.
  useEscapeKey(close, panel !== null);

  // Outside click closes the popover and options (not the full-stage sheets, which own a Close button).
  useEffect(() => {
    if (panel !== "popover" && panel !== "options") return;
    const onDown = (e: MouseEvent): void => {
      const host = panel === "popover" ? popoverRef.current : optionsRef.current;
      if (host && !host.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [panel]);

  // Focus follows the panel: into it on open, back to the button on close.
  useEffect(() => {
    if (panel === "popover") popoverRef.current?.focus();
    else if (panel === "options") optionsRef.current?.focus();
    else if (panel === "chains") chainsRef.current?.focus();
    else restoreFocus.current?.focus();
  }, [panel]);

  function close(): void {
    setPanel(null);
  }

  function openPopover(): void {
    restoreFocus.current = buttonRef.current;
    setPanel("popover");
    void fetchTrace(selectedMessageId);
  }

  function openOptions(): void {
    restoreFocus.current = buttonRef.current;
    setPanel("options");
  }

  function persistRect(next: ButtonRect): void {
    setRect(next);
    ctx.prefs.set(HARE_PREFS.button, next);
  }

  // -- drag and resize (the original extension's tap-vs-drag rule: a move past threshold is a drag,
  // never a click; a long press on touch opens options; a real <button> keeps click/keyboard free) --
  const drag = useRef<{ pointerId: number; startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justDragged = useRef(false);

  function onButtonPointerDown(e: ReactPointerEvent<HTMLButtonElement>): void {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    drag.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, origX: rect.x, origY: rect.y, moved: false };
    buttonRef.current?.setPointerCapture?.(e.pointerId);
    if (e.pointerType !== "mouse") {
      longPress.current = setTimeout(() => {
        if (drag.current && !drag.current.moved) { drag.current = null; openOptions(); }
      }, LONG_PRESS_MS);
    }
  }

  function onButtonPointerMove(e: ReactPointerEvent<HTMLButtonElement>): void {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD)) {
      d.moved = true;
      if (longPress.current) { clearTimeout(longPress.current); longPress.current = null; }
    }
    if (d.moved) setRect(clampButtonRect({ x: d.origX + dx, y: d.origY + dy, size: rect.size }, containerSize()));
  }

  function onButtonPointerUp(e: ReactPointerEvent<HTMLButtonElement>): void {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (longPress.current) { clearTimeout(longPress.current); longPress.current = null; }
    buttonRef.current?.releasePointerCapture?.(e.pointerId);
    drag.current = null;
    if (d.moved) {
      justDragged.current = true;
      ctx.prefs.set(HARE_PREFS.button, rect);
    }
  }

  function onButtonClick(): void {
    if (justDragged.current) { justDragged.current = false; return; }
    openPopover();
  }

  function onButtonContextMenu(e: ReactMouseEvent<HTMLButtonElement>): void {
    e.preventDefault();
    openOptions();
  }

  const resize = useRef<{ pointerId: number; startX: number; startY: number; origSize: number } | null>(null);

  function onResizePointerDown(e: ReactPointerEvent<HTMLButtonElement>): void {
    e.stopPropagation();
    resize.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, origSize: rect.size };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onResizePointerMove(e: ReactPointerEvent<HTMLButtonElement>): void {
    const r = resize.current;
    if (!r || r.pointerId !== e.pointerId) return;
    const delta = Math.max(e.clientX - r.startX, e.clientY - r.startY);
    setRect(clampButtonRect({ x: rect.x, y: rect.y, size: r.origSize + delta }, containerSize()));
  }

  function onResizePointerUp(e: ReactPointerEvent<HTMLButtonElement>): void {
    const r = resize.current;
    if (!r || r.pointerId !== e.pointerId) return;
    resize.current = null;
    ctx.prefs.set(HARE_PREFS.button, rect);
  }

  const trace = traceState.state === "ready" ? traceState.trace : null;
  const count = traceState.state === "ready" && trace !== null ? badgeCount(trace) : null;

  return (
    <>
      <div ref={fabRef} className="hare-fab" style={{ left: rect.x, top: rect.y, width: rect.size, height: rect.size } as CSSProperties}>
        <IconButton ref={buttonRef} size="fab" label="TrackHare" title="TrackHare (right-click for options)" data-part="props.trackhare.button" vars={{ "--fab-size": `${rect.size}px` }}
          icon={<HareLogo size={rect.size * 0.54} />} badge={count !== null ? count : undefined}
          onPointerDown={onButtonPointerDown} onPointerMove={onButtonPointerMove} onPointerUp={onButtonPointerUp}
          onPointerCancel={onButtonPointerUp} onContextMenu={onButtonContextMenu} onClick={onButtonClick} />
        <Dot kind="handle" label="Resize TrackHare" tabIndex={-1} aria-hidden="true" data-part="props.trackhare.resize"
          onPointerDown={onResizePointerDown} onPointerMove={onResizePointerMove} onPointerUp={onResizePointerUp} onPointerCancel={onResizePointerUp} />
      </div>

      {panel === "popover" && tracePop.state.open && (
        <div className="hare-pop" ref={popoverRef} tabIndex={-1} role="dialog" aria-modal="false" aria-label="TrackHare"><PopoutPlaceholder kind={hareTracePopout} onBack={tracePop.close} /></div>
      )}
      {panel === "popover" && !tracePop.state.open && (
        <HarePopover panelRef={popoverRef} traceState={traceState} density={density} group={group} sort={sort} showMisses={misses} pop={{ id: hareTracePopout.id, open: tracePop.open }}
          onToggleDensity={(d) => { setDensity(d); ctx.prefs.set(HARE_PREFS.density, d); }}
          onPickReply={(messageId) => { setSelectedMessageId(messageId); void fetchTrace(messageId); }}
          onOpenTokens={() => setPanel("tokens")} onOpenChains={() => setPanel("chains")} onClose={close} />
      )}

      {panel === "options" && (
        <HareOptions panelRef={optionsRef} group={group} sort={sort} misses={misses}
          onSetGroup={(v) => { setGroup(v); ctx.prefs.set(HARE_PREFS.group, v); }}
          onSetSort={(v) => { setSort(v); ctx.prefs.set(HARE_PREFS.sort, v); }}
          onSetMisses={(v) => { setMisses(v); ctx.prefs.set(HARE_PREFS.misses, v); }}
          onResetPlace={() => { ctx.prefs.set(HARE_PREFS.button, undefined); persistRect(clampButtonRect(DEFAULT_BUTTON_RECT, containerSize())); }} />
      )}

      {panel === "chains" && trace && (
        <ChainsSheet sheetRef={chainsRef} lore={trace.lore} replyNumber={trace.reply.number} onClose={() => setPanel("popover")} />
      )}

      {panel === "tokens" && trace && (
        <TokensSheet trace={trace} model={trace.reply.model} onClose={() => setPanel("popover")} />
      )}
    </>
  );
}
