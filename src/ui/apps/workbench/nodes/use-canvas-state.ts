/**
 * The canvas state hook: reads ctx.prefs once, applies edits in React state, and saves back to prefs
 * 400 ms after the last change, only when the serialized record actually differs (and on unmount).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppContext } from "../../../app-contract";
import { PREF_NODES, parseCanvas, serializeCanvas, type CanvasState } from "./canvas-state";

const SAVE_MS = 400;

export function useCanvasState(ctx: AppContext): [CanvasState, (edit: (s: CanvasState) => CanvasState) => void] {
  const [state, setState] = useState(() => parseCanvas(ctx.prefs.get(PREF_NODES)));
  const latest = useRef(state);
  const saved = useRef(JSON.stringify(serializeCanvas(state)));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback((): void => {
    timer.current = null;
    const json = JSON.stringify(serializeCanvas(latest.current));
    if (json === saved.current || latest.current.frozen) return; // a newer version's record is never overwritten
    saved.current = json;
    ctx.prefs.set(PREF_NODES, serializeCanvas(latest.current));
  }, [ctx]);

  useEffect(() => {
    latest.current = state;
    if (JSON.stringify(serializeCanvas(state)) === saved.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_MS);
  }, [state, flush]);
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); flush(); } }, [flush]);

  const edit = useCallback((fn: (s: CanvasState) => CanvasState) => setState((s) => fn(s)), []);
  return [state, edit];
}
