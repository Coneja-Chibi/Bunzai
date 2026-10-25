/**
 * A drag grip for one px size (RoleCall's prompt-list resize and macro-preview resize, PresetPanel.tsx:261-291 and :3709-3740): a separator the pointer
 * drags, one size rule, live while dragging and saved once when the pointer lifts and the size changed. `grows` says which way the pointer moves to
 * make the thing bigger (right for the list beside the editor, up for the preview under it). Keys step it, Home or a double click puts it back.
 */
import { useRef, type JSX, type KeyboardEvent, type PointerEvent } from "react";
import { clampSize, type SizeRule } from "./size-core";

type Grows = "right" | "up";

export function SplitGrip({ rule, size, grows, label, onLive, onSave }: {
  rule: SizeRule;
  size: number;
  grows: Grows;
  label: string;
  onLive(px: number): void;
  /** The size to keep, or null to forget it (the rule's start is back). */
  onSave(px: number | null): void;
}): JSX.Element {
  const drag = useRef<{ at: number; from: number; now: number } | null>(null);
  const axis = (e: { clientX: number; clientY: number }): number => (grows === "right" ? e.clientX : e.clientY);
  const sign = grows === "right" ? 1 : -1;
  const move = (e: PointerEvent): void => {
    const d = drag.current;
    if (!d) return;
    d.now = clampSize(rule, d.from + sign * (axis(e) - d.at));
    onLive(d.now);
  };
  const end = (): void => {
    const d = drag.current;
    drag.current = null;
    if (d && d.now !== d.from) onSave(d.now);
  };
  const reset = (): void => { onLive(rule.start); onSave(null); };
  const step = (by: number): void => { const next = clampSize(rule, size + by); onLive(next); onSave(next); };
  const key = (e: KeyboardEvent): void => {
    const [more, less] = grows === "right" ? ["ArrowRight", "ArrowLeft"] : ["ArrowUp", "ArrowDown"];
    if (e.key === more) step(rule.step);
    else if (e.key === less) step(-rule.step);
    else if (e.key === "Home") reset();
    else return;
    e.preventDefault();
  };
  return (
    <div
      className={`grip ${grows === "right" ? "col" : "row"}`} role="separator" aria-orientation={grows === "right" ? "vertical" : "horizontal"} aria-label={label}
      aria-valuenow={size} aria-valuemin={rule.min} aria-valuemax={rule.max} tabIndex={0} title="Drag to resize. Double click to reset."
      onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); drag.current = { at: axis(e), from: size, now: size }; }}
      onPointerMove={move} onPointerUp={end} onPointerCancel={end} onKeyDown={key} onDoubleClick={reset}
    ><i /></div>
  );
}
