/**
 * Shared Ctrl+S, window-close, autosave, and shell dirty-state wiring for every Workbench editor.
 *
 * AUTOSAVE LIVES HERE because every editor already calls this - preset, lorebook, regex, persona,
 * pack, character. Adding it per editor would mean six debounces to keep in step, and the first one
 * somebody forgot would be a room that quietly does not autosave while the setting says it does.
 */
import { useEffect, useRef, useState } from "react";
import { useEditorKeys } from "./editor-key-owner";
import { AUTOSAVE_PREF, AUTOSAVE_TRIES, retryDelayMs, shouldAutosave } from "./autosave-core";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import type { SaveIntent } from "../../../stage/contracts/content-store";

/** What autosave is doing, for an editor that wants to say so on screen. */
export interface AutosaveStatus {
  /** Autosave has used up its tries and is waiting for a person. */
  readonly stalled: boolean;
  /** Give it its tries back - after a conflict has been resolved one way or the other. */
  retry: () => void;
}

export interface AutosaveBudget extends AutosaveStatus {
  readonly stalled: boolean;
  readonly attempts: number;
}

export function useEditorGuards(
  ctx: AppContext,
  piece: StudioEntitySummary,
  dirty: boolean,
  /**
   * FALSE MEANS THE SAVE FAILED. An editor that catches its own error and reports it through
   * `setStatus` resolves either way, so without an answer the retry counter below counts saves
   * rather than failures - and stands autosave down in the middle of ordinary successful typing.
   * `void` reads as success, so an editor with nothing to say passes nothing.
   */
  save: (intent?: SaveIntent) => Promise<boolean | void>,
  /**
   * Whether this piece can be saved at all right now - a preset with no name cannot. Optional so an
   * editor with no such condition passes nothing and autosaves whenever it is dirty.
   */
  savable = true,
  budget?: AutosaveBudget,
): AutosaveStatus {
  /**
   * AUTOSAVE, AFTER YOU STOP. The timer restarts on every change, so it fires when somebody pauses
   * rather than on a schedule that writes mid sentence. Off by default and read from settings, so
   * this does nothing at all until it is turned on.
   */
  const autosave = ctx.prefs.get(AUTOSAVE_PREF) === true;
  const saveRef = useRef(save);
  saveRef.current = save;

  /**
   * How many times this piece's autosave has run without clearing `dirty`.
   *
   * IT IS A DEPENDENCY ON PURPOSE. The effect used to key on `dirty` alone, so a save that failed
   * left dirty true, nothing changed, and no timer was ever armed again - autosave was not paused
   * for that piece, it was dead, silently. Counting attempts gives the effect something that DOES
   * change after a failure, which is what re-arms it.
   */
  const [attempts, setAttempts] = useState(0);
  const failures = budget?.attempts ?? attempts;
  const retry = budget?.retry;
  const sharedBudget = budget !== undefined;
  // A fresh piece starts with a clean slate; the count is about this editor, not about the app.
  useEffect(() => { setAttempts(0); retry?.(); }, [piece.id, piece.kind, retry]);

  useEffect(() => {
    if (!shouldAutosave({ enabled: autosave, dirty, saving: false, savable })) return;
    if (failures >= AUTOSAVE_TRIES) return; // stood down; the conflict notice carries it from here
    const timer = setTimeout(() => {
      /**
       * COUNTED ON FAILURE ONLY. A failed save leaves `dirty` true, so bumping the count is the one
       * thing that re-arms this effect - and counting successes too would stand autosave down after
       * three ordinary saves, which is the same silent death from the other direction.
       */
      void Promise.resolve(saveRef.current("autosave")).then(
        (ok) => { if (ok === false && !sharedBudget) setAttempts((n) => n + 1); },
        () => { if (!sharedBudget) setAttempts((n) => n + 1); },
      );
    }, retryDelayMs(failures));
    // Cleared on every change, which is what makes this a pause detector rather than a metronome.
    return () => { clearTimeout(timer); };
  }, [autosave, dirty, savable, failures, piece.id, piece.kind, sharedBudget]);

  // A save that lands resets the budget, so the next edit gets its full three tries.
  useEffect(() => { if (!dirty) { setAttempts(0); retry?.(); } }, [dirty, retry]);

  useEditorKeys((event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void save();
    }
  });
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [dirty]);

  useEffect(() => {
    ctx.workbench.setDirty(piece.id, piece.kind, dirty);
    // ctx is a stable adapter whose identity changes on shell writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, piece.id, piece.kind]);

  return budget ?? { stalled: attempts >= AUTOSAVE_TRIES, retry: () => setAttempts(0) };
}
