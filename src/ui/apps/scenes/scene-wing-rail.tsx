/**
 * The scene's wing rails (RoleCall `WingRail.tsx` and `WingItem.tsx`): a glass column down each side with one icon per wing. Pointing anywhere at a rail surfaces every wing's label at once
 * (cleared 250ms after the pointer leaves, so crossing the gap onto a label keeps them), a wing's long help opens beside its label after a half second on it, and a wing that has just opened
 * shows its label for 1.4 seconds. The labels start past the open wing's live edge, so they never cover the panel (`tipOffset` follows the panel's width as it is dragged). The long help sits
 * past the label like RoleCall's, except where that would leave the window (a wide wing open): there it sits on the label's inner side, over the panel. RoleCall clips it there.
 */
import { Tile } from "../../components/button";
import { useEffect, useRef, useState, type JSX } from "react";
import { Ic } from "../../_shared/ic";
import { WINGS, type Wing } from "./scene-wing-data";
import { pushesAside } from "./wing-dismiss";

/** How long the label of a wing that has just opened stays (RoleCall `ACTIVE_LABEL_FLASH_MS`). */
const LABEL_FLASH_MS = 1400;
/** How long a wing is pointed at before its long help opens (`HOVER_TOOLTIP_DELAY_MS`). */
const HELP_MS = 500;
/** How long the labels outlast the pointer leaving the rail. */
const LEAVE_MS = 250;
/** The label's width plus its gap, and the long help's width plus a margin (the .tip and .tipd widths in scene-wing-style.ts). */
const TIP_SPAN = 272;
const HELP_SPAN = 302;

/** Where the long help starts, measured from the rail item like the label: past the label when it fits in the window, else on the label's inner side. */
export function helpOffset(offset: number, railEdge: number, viewport: number): number {
  return railEdge + offset + TIP_SPAN + HELP_SPAN <= viewport ? offset + TIP_SPAN : Math.max(0, offset - HELP_SPAN);
}

function RailItem({ wing, on, offset, help: helpAt, railHovered, onToggle }: { wing: Wing; on: boolean; offset: number; help: number; railHovered: boolean; onToggle(id: string): void }): JSX.Element {
  const [flash, setFlash] = useState(false);
  const [pointed, setPointed] = useState(false);
  const [help, setHelp] = useState(false);
  const was = useRef(on);
  useEffect(() => {
    if (on && !was.current) {
      was.current = true;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), LABEL_FLASH_MS);
      return () => clearTimeout(t);
    }
    if (!on && was.current) { was.current = false; setFlash(false); }
    return undefined;
  }, [on]);
  useEffect(() => {
    if (!pointed) { setHelp(false); return undefined; }
    const t = setTimeout(() => setHelp(true), HELP_MS);
    return () => clearTimeout(t);
  }, [pointed]);
  const show = flash || help || railHovered;
  return (
    <Tile kind="icon" data-wing={wing.id} selected={on} vars={{ "--w": wing.tone, "--tip-off": `${offset}px`, "--help-off": `${helpAt}px` }}
      aria-pressed={on} label={wing.label} {...(pushesAside() ? { title: "" } : { title: wing.blurb })} onClick={() => onToggle(wing.id)}
      onPointerEnter={() => setPointed(true)} onPointerLeave={() => setPointed(false)} onFocus={() => setPointed(true)} onBlur={() => setPointed(false)}
      icon={<>
        <Ic name={wing.icon} size={20} fill={wing.id === "booth"} />
        <span className="lbl">{wing.label}</span>
        <span className={`tip${show ? " show" : ""}`}><b>{wing.label}</b><span>{wing.blurb}</span></span>
        <span className={`tipd${help ? " show" : ""}`} aria-hidden={!help}>{wing.detail}</span>
      </>} />
  );
}

function Rail({ side, open, onToggle, wings }: { side: "l" | "r"; open: string | null; onToggle(id: string): void; wings: readonly Wing[] }): JSX.Element {
  const nav = useRef<HTMLElement>(null);
  const [hovered, setHovered] = useState(false);
  const [offset, setOffset] = useState(60);
  const [helpAt, setHelpAt] = useState(60 + TIP_SPAN);
  const clear = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collapsed = wings.some((w) => w.id === open && w.side === side);
  useEffect(() => () => { if (clear.current) clearTimeout(clear.current); }, []);
  // The rail stays at the edge while the panel opens beneath it: start the labels where the panel ends.
  useEffect(() => {
    const rail = nav.current;
    if (!rail) return undefined;
    const panel = rail.closest(".scs")?.querySelector<HTMLElement>(`[data-wing-panel][data-wing-side="${side}"][data-wing-open="true"]`) ?? null;
    const update = (): void => {
      const box = rail.getBoundingClientRect();
      const r = box.width;
      const p = panel?.getBoundingClientRect().width ?? 0;
      const next = p <= r ? (collapsed ? 45 : 60) : Math.round(p + 12 - Math.max(0, (r - 40) / 2));
      setOffset(next);
      setHelpAt(helpOffset(next, side === "l" ? box.left : window.innerWidth - box.right, window.innerWidth));
    };
    update();
    window.addEventListener("resize", update);
    const observer = typeof ResizeObserver === "undefined" || !panel ? null : new ResizeObserver(update);
    if (observer && panel) observer.observe(panel);
    return () => { window.removeEventListener("resize", update); observer?.disconnect(); };
  }, [collapsed, side]);
  const enter = (): void => { if (clear.current) { clearTimeout(clear.current); clear.current = null; } setHovered(true); };
  const leave = (): void => {
    if (clear.current) clearTimeout(clear.current);
    clear.current = setTimeout(() => { setHovered(false); clear.current = null; }, LEAVE_MS);
  };
  return (
    <nav ref={nav} className={`rail ${side}`} data-part="scene.wings" aria-label={side === "l" ? "Scene wings" : "Tool wings"} onPointerEnter={enter} onPointerLeave={leave}>
      {/* bounded-ok: navigation uses built-in wings and the two bundled rail Props, never user-content rows. */}
      {wings.filter((w) => w.side === side).map((w) => <RailItem key={w.id} wing={w} on={open === w.id} offset={offset} help={helpAt} railHovered={hovered} onToggle={onToggle} />)}
    </nav>
  );
}

export function WingRails({ open, onToggle, extra = [] }: { open: string | null; onToggle(id: string): void; extra?: readonly Wing[] }): JSX.Element {
  const wings = [...WINGS, ...extra];
  return <><Rail side="l" open={open} onToggle={onToggle} wings={wings} /><Rail side="r" open={open} onToggle={onToggle} wings={wings} /></>;
}
