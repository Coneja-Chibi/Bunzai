/**
 * A pop-out's open state and place, live. ctx.prefs (`popout.<id>`) is the owner and the only thing persisted; it tells nobody when it
 * changes, so the docked slot and the floating panel of one kind would drift. This keeps one parsed copy per kind, rereads it when the
 * pref's value changes, and notifies every subscriber when the person opens, closes or drops the panel. It never writes during a drag.
 */
import { useCallback, useSyncExternalStore } from "react";
import type { AppContext } from "../../../app-contract";
import { parsePopout, popoutValue, type Pos } from "./popout-core";
import type { PopoutState } from "./popout-kind";

const KEY = "popout.";
const parsed = new Map<string, { raw: unknown; state: PopoutState }>();
const listeners = new Set<() => void>();
/** Kinds the person just opened this session: their panel takes focus once. A state restored on load never does. */
const justOpened = new Set<string>();

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

function read(prefs: AppContext["prefs"], id: string): PopoutState {
  const raw = prefs.get(KEY + id);
  const hit = parsed.get(id);
  if (hit && hit.raw === raw) return hit.state;
  const state = parsePopout(raw);
  parsed.set(id, { raw, state });
  return state;
}

/** True once for a kind the person has just opened, so its panel can take focus. */
export const consumeUserOpen = (id: string): boolean => justOpened.delete(id);

export function usePopout(ctx: AppContext, id: string): { state: PopoutState; open(): void; close(): void; move(pos: Pos): void } {
  const state = useSyncExternalStore(subscribe, () => read(ctx.prefs, id));
  const save = useCallback((next: PopoutState): void => {
    const value = popoutValue(next);
    ctx.prefs.set(KEY + id, value);
    parsed.set(id, { raw: value, state: next });
    listeners.forEach((l) => l());
  }, [ctx.prefs, id]);
  return {
    state,
    open: () => { justOpened.add(id); save({ ...state, open: true }); },
    close: () => save({ ...state, open: false }),
    move: (pos) => save({ open: true, pos }),
  };
}
