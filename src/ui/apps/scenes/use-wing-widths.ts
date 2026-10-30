/**
 * The page's side of wing widths: what each wing is now (the viewer's saved width, else its own default), and the handle a wing's edge drives. A drag writes the `--wing-w` variable on the
 * scene root directly (no page re-render per pointer move; RoleCall writes the panel's style the same way) and turns the 300ms push-aside off while the pointer is down; the save at the end
 * is the only state change. A reset (`null`) puts the wing's default back.
 */
import { useCallback, useState, type RefObject } from "react";
import type { AppContext } from "../../app-contract";
import { wingOf, type Wing } from "./scene-wing-data";
import { parseWidth, widthKey } from "./wing-resize-core";
import type { WingResize } from "./wing-resize-edge";

export function useWingWidths(prefs: AppContext["prefs"], root: RefObject<HTMLElement | null>, extra?: readonly Wing[]): { widthOf(id: string): number; resizeOf(id: string): WingResize } {
  // A save re-renders with the new number; the pref read is the source after a reload.
  const [saved, setSaved] = useState<Readonly<Record<string, number | null>>>({});
  const widthOf = useCallback((id: string): number => {
    const fallback = wingOf(id, extra)?.width ?? 500;
    return id in saved ? saved[id] ?? fallback : parseWidth(prefs.get(widthKey(id)), fallback);
  }, [prefs, saved, extra]);
  const resizeOf = useCallback((id: string): WingResize => ({
    width: widthOf(id),
    fallback: wingOf(id, extra)?.width ?? 500,
    available: () => root.current?.clientWidth ?? 0,
    onLive: (px) => root.current?.style.setProperty("--wing-w", `${px}px`),
    onDragging: (on) => root.current?.toggleAttribute("data-resizing", on),
    onSave: (px) => { prefs.set(widthKey(id), px); setSaved((s) => ({ ...s, [id]: px })); },
  }), [prefs, root, widthOf, extra]);
  return { widthOf, resizeOf };
}
