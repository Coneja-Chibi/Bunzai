/**
 * The persona's emoji picker, RoleCall's own (emoji-picker-react, native emoji style, search box, 280 by
 * 350), loaded only when it is first opened so the scene page does not carry its weight. It is portaled to
 * the page and placed under its button, as RoleCall does, so the form's scroll area never clips it. What the
 * person picks is theirs: it is stored on the persona (presentation.emoji) and never touched by the app's
 * own no-emoji copy rule. Closes on Escape and on a press outside it.
 */
import { lazy, Suspense, useEffect, useRef, type CSSProperties, type JSX } from "react";
import { createPortal } from "react-dom";
import { isEscapeClose, useEscapeKey } from "../../../_shared/use-escape-key";

const Picker = lazy(() => import("emoji-picker-react"));
const WIDTH = 280;

/** RoleCall's emoji picker, portaled under its button and loaded when first opened. */
export function EmojiPicker({ anchor, onPick, onClose }: { anchor: HTMLElement | null; onPick(emoji: string): void; onClose(): void }): JSX.Element | null {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.focus(); return () => { if (anchor?.isConnected) anchor.focus(); }; }, [anchor]);
  useEffect(() => {
    const press = (e: PointerEvent): void => {
      if (e.target instanceof Node && (box.current?.contains(e.target) || anchor?.contains(e.target))) return;
      onClose();
    };
    document.addEventListener("pointerdown", press);
    return () => document.removeEventListener("pointerdown", press);
  }, [anchor, onClose]);
  useEscapeKey(onClose, true);
  if (!anchor) return null;
  const r = anchor.getBoundingClientRect();
  const place: CSSProperties = {
    position: "fixed", zIndex: 9999, top: Math.max(8, Math.min(r.bottom + 8, window.innerHeight - 366)),
    left: Math.max(8, Math.min(r.left + r.width / 2 - WIDTH / 2, window.innerWidth - WIDTH - 8)),
    boxShadow: "6px 6px 0 0 var(--stage-black)",
  };
  return createPortal(
    <div style={place} ref={box} tabIndex={-1} role="dialog" aria-label="Pick an emoji" data-part="scene.cast.emoji"
      onKeyDown={(event) => { if (isEscapeClose(event.nativeEvent)) { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
      <Suspense fallback={<div className="cw-emoji-wait" style={{ padding: "2rem", background: "var(--stage-panel)", color: "var(--stage-mute)" }}>Loading...</div>}>
        {/* Props are RoleCall's: a dark picker, native glyphs, a "Search..." box. */}
        <Picker onEmojiClick={(data) => onPick(data.emoji)} theme={"dark" as never} emojiStyle={"native" as never} width={WIDTH} height={350} searchPlaceholder="Search..." />
      </Suspense>
    </div>,
    anchor.closest('[role="dialog"]') ?? document.body,
  );
}
