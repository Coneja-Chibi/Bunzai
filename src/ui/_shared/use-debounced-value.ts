/** Keep a value current only after it has stayed unchanged for the requested delay (useDebouncedValue), or save one after it rests (useDebouncedSave). */
import { useEffect, useMemo, useRef, useState } from "react";

export function useDebouncedValue<T>(value: T, ms: number, flushWhen?: (value: T) => boolean): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (flushWhen?.(value)) {
      setSettled(value);
      return;
    }
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms, flushWhen]);
  return settled;
}

/** What useDebouncedSave hands back. The object is stable across renders. */
export interface DebouncedSave<T> {
  /** Queue a value; it is saved once no newer value has come for the delay. */
  push(value: T): void;
  /** Save the queued value now (nothing happens when none is queued). */
  flush(): void;
  /** Forget the queued value, and the one still being saved, as if neither had been asked for. */
  cancel(): void;
  /** The value not yet safely saved: queued, or sent and not yet settled. */
  pending(): T | undefined;
}

interface Held<T> { value: T }

/**
 * Debounced autosave for a field or slider that drags fast: the pending ref, the timer, the flush and the
 * flush-on-unmount that five scene wings each wrote by hand (dry audit A3). The queued value is ALWAYS saved when
 * the owner goes away (closing a panel must not drop a change), and a failed save is reported to `onError`; after the
 * owner is gone that report cannot be drawn in it, so a save that must be heard then reports through its own `save`.
 * Without `onError` a rejected save is left as an unhandled rejection rather than swallowed. `save` is read at call
 * time, so a new closure each render is fine; a sync save that throws is reported the same way.
 */
export function useDebouncedSave<T>(
  save: (value: T) => void | Promise<void>,
  delayMs: number,
  onError?: (error: unknown) => void,
): DebouncedSave<T> {
  const saveRef = useRef(save);
  saveRef.current = save;
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const delayRef = useRef(delayMs);
  delayRef.current = delayMs;
  const state = useRef({ queued: undefined as Held<T> | undefined, sending: undefined as Held<T> | undefined, timer: null as ReturnType<typeof setTimeout> | null });
  const api = useMemo<DebouncedSave<T>>(() => {
    const s = state.current;
    const stop = (): void => {
      if (s.timer !== null) clearTimeout(s.timer);
      s.timer = null;
    };
    const flush = (): void => {
      stop();
      const sent = s.queued;
      s.queued = undefined;
      if (!sent) return;
      s.sending = sent;
      const settle = (): void => { if (s.sending === sent) s.sending = undefined; };
      const fail = (error: unknown): void => {
        settle();
        if (errorRef.current) errorRef.current(error);
        else throw error;
      };
      try {
        const done = saveRef.current(sent.value);
        if (done) done.then(settle, fail);
        else settle();
      } catch (error) {
        fail(error);
      }
    };
    return {
      push(value) {
        stop();
        s.queued = { value };
        s.timer = setTimeout(flush, delayRef.current);
      },
      flush,
      cancel() {
        stop();
        s.queued = undefined;
        s.sending = undefined;
      },
      pending: () => (s.queued ?? s.sending)?.value,
    };
  }, []);
  useEffect(() => {
    return () => { api.flush(); };
  }, [api]);
  return api;
}
