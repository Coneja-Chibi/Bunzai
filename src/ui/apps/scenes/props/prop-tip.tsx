/**
 * The Props hover card, to RoleCall's RichTooltip (packages/ui/src/rich-tooltip.tsx): a card portaled to the body so no wing edge clips
 * it, shown 220ms after the pointer or focus arrives (never on a touch screen), placed by prop-tip-core.ts so it flips to whichever side
 * has room, and dismissed by Escape, a press elsewhere, a scroll or a resize. The peek shows the title and the description; where a prop
 * has bullets it says so, and "?" on the focused row opens the same card with the bullets. The Tooltips switch turns the whole thing off.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type JSX, type ReactNode } from "react";
import { useEscapeKey } from "../../../_shared/use-escape-key";
import { createPortal } from "react-dom";
import { tipPosition, type TipPoint } from "./prop-tip-core";
import type { PropTip as PropTipContent } from "./prop-contract";

export const TIP_DELAY_MS = 220;
const coarse = (): boolean => window.matchMedia?.("(hover: none), (pointer: coarse)").matches ?? false;

export function PropTip({ title, tip, notes = [], tone, enabled, children }: { title: string; tip: PropTipContent; notes?: readonly string[]; tone: string; enabled: boolean; children: ReactNode }): JSX.Element {
  const [peek, setPeek] = useState(false);
  const [help, setHelp] = useState(false);
  const [at, setAt] = useState<TipPoint>({ x: 0, y: 0 });
  const trigger = useRef<HTMLSpanElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = useId();
  const place = useCallback((): void => {
    if (!trigger.current) return;
    const c = card.current?.getBoundingClientRect();
    setAt(tipPosition(trigger.current.getBoundingClientRect(), c ? { width: c.width, height: c.height } : null, { width: window.innerWidth, height: window.innerHeight }));
  }, []);
  const hide = useCallback((): void => { clearTimeout(timer.current); setPeek(false); }, []);
  const show = (): void => {
    if (!enabled || help || coarse()) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { place(); setPeek(true); }, TIP_DELAY_MS);
  };
  const shown = enabled && (peek || help);
  useLayoutEffect(() => { if (shown) place(); }, [shown, place]);
  useEffect(() => () => clearTimeout(timer.current), []);
  // Switching the tips off drops a pending open and an open card, so turning them back on never revives one.
  useEffect(() => { if (!enabled) { hide(); setHelp(false); } }, [enabled, hide]);
  useEscapeKey(() => { hide(); setHelp(false); }, shown);
  useEffect(() => {
    if (!shown) return;
    const press = (e: Event): void => { hide(); if (!card.current?.contains(e.target as Node)) setHelp(false); };
    const away = (): void => { hide(); setHelp(false); };
    document.addEventListener("mousedown", press);
    document.addEventListener("scroll", hide, true);
    window.addEventListener("resize", away);
    return () => { document.removeEventListener("mousedown", press); document.removeEventListener("scroll", hide, true); window.removeEventListener("resize", away); };
  }, [shown, hide]);
  // "?" opens the detailed card from a focused row, so it listens even before the peek is up
  useEffect(() => {
    if (!enabled) return;
    const key = (e: KeyboardEvent): void => { if (e.key === "?" && trigger.current?.contains(document.activeElement)) { e.preventDefault(); hide(); setHelp(true); } };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [enabled, hide]);
  const bullets = tip.bullets ?? [];
  return (
    <>
      <span ref={trigger} className="pw-trig" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} aria-describedby={peek ? id : undefined}>{children}</span>
      {shown && createPortal(
        <div id={id} ref={card} className="pw-rt" role={help ? "dialog" : "tooltip"} aria-label={help ? `${title} help` : undefined} style={{ left: at.x, top: at.y, "--tone": tone, pointerEvents: help ? "auto" : "none" } as CSSProperties}>
          <div className="pw-rt-head"><span>{title}</span>{help && <button type="button" aria-label="Close help" onClick={() => setHelp(false)}>X</button>}</div>
          <div className="pw-rt-body">
            <p>{tip.description}</p>
            {notes.length > 0 && <p className="pw-rt-note">{notes.join(". ")}</p>}
            {help && bullets.length > 0 && <ul>{bullets.map((b) => <li key={b}><i aria-hidden="true">+</i><span>{b}</span></li>)}</ul>}
            {!help && bullets.length > 0 && <div className="pw-rt-hint">Open help for details. This peek never locks.</div>}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
