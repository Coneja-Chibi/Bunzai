/**
 * The canvas state hook: reads ctx.prefs once, applies edits in React state, and saves back to prefs
 * 400 ms after the last change through useDebouncedSave (which also flushes when the view closes), only
 * when the serialized record actually differs.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppContext } from "../../../app-contract";
import { useDebouncedSave } from "../../../_shared/use-debounced-value";
import { PREF_NODES, parseCanvas, serializeCanvas, type CanvasState } from "./canvas-state";

const SAVE_MS = 400;

export function useCanvasState(ctx: AppContext): [CanvasState, (edit: (s: CanvasState) => CanvasState) => void] {
  const [state, setState] = useState(() => parseCanvas(ctx.prefs.get(PREF_NODES)));
  const saved = useRef(JSON.stringify(serializeCanvas(state)));
  const save = useDebouncedSave((next: CanvasState) => {
    const json = JSON.stringify(serializeCanvas(next));
    if (json === saved.current || next.frozen) return; // a newer version's record is never overwritten
    saved.current = json;
    ctx.prefs.set(PREF_NODES, serializeCanvas(next));
  }, SAVE_MS);

  useEffect(() => {
    if (JSON.stringify(serializeCanvas(state)) !== saved.current) save.push(state);
  }, [state, save]);

  const edit = useCallback((fn: (s: CanvasState) => CanvasState) => setState((s) => fn(s)), []);
  return [state, edit];
}
