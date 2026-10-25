/**
 * The scene's Final Cut for the wing (ChatStore rule 44): the switch, the passes and the tool overrides, shown at once and saved after a short
 * pause so a slider drag or a typed paragraph is one write, composed on the latest values so two changes in a row both land. Leaving the wing
 * saves what was set; a failed save puts back what the store holds and says why. The scene's own copy wins whenever no write of ours is waiting.
 */
import { useEffect, useRef, useState } from "react";
import type { AppContext } from "../../../app-contract";
import type { FinalCutPass, FinalCutSettings, FinalCutTools, PassType } from "../../../../core/final-cut/pass";
import type { Chat } from "../../../../stage/contracts/chat-store";
import { toErrorMessage } from "../../../_shared/error-message";
import { useDebouncedSave } from "../../../_shared/use-debounced-value";
import { patchPass, togglePass } from "./fc-core";

export interface FinalCutState {
  settings: FinalCutSettings;
  /** Why the last save failed, in words fit to show; null when none did. */
  error: string | null;
  setOn(on: boolean): void;
  toggle(type: PassType): void;
  /** Changes a pass and switches it on; a function sees the latest values. */
  patch(type: PassType, change: Partial<FinalCutPass> | ((current: FinalCutPass) => Partial<FinalCutPass>)): void;
  /** Replaces a pass whole (a saved agent loaded onto it, a field cleared). */
  replace(type: PassType, next: (current: FinalCutPass | undefined) => FinalCutPass): void;
  setTools(tools: FinalCutTools): void;
}

const patchOf = (s: FinalCutSettings) => ({ on: s.on ? true : null, passes: s.passes && s.passes.length > 0 ? s.passes : null, tools: s.tools && Object.keys(s.tools).length > 0 ? s.tools : null });

export function useFinalCut(ctx: AppContext, chat: Chat, onChanged: (chat: Chat) => void): FinalCutState {
  const [settings, setSettings] = useState<FinalCutSettings>(chat.finalCut ?? {});
  const [error, setError] = useState<string | null>(null);
  // The shell rebuilds ctx on every status change; these refs keep the writer from restarting with it.
  const api = useRef(ctx.api);
  api.current = ctx.api;
  const changed = useRef(onChanged);
  changed.current = onChanged;
  const chatId = useRef(chat.id);
  chatId.current = chat.id;
  const held = useRef(chat.finalCut ?? {});
  held.current = chat.finalCut ?? {};
  const latest = useRef(settings);
  const saver = useDebouncedSave<FinalCutSettings>(async (next) => {
    changed.current(await api.current.setSceneFinalCut(chatId.current, patchOf(next)));
    setError(null);
  }, 300, (e) => {
    if (!saver.pending()) { latest.current = held.current; setSettings(held.current); }
    setError(toErrorMessage(e, "This scene's Final Cut settings could not be saved."));
  });
  useEffect(() => { if (!saver.pending()) { latest.current = chat.finalCut ?? {}; setSettings(latest.current); } }, [chat.finalCut, saver]);
  const save = (next: FinalCutSettings): void => {
    latest.current = next;
    setSettings(next);
    saver.push(next);
  };
  return {
    settings, error,
    setOn: (on) => save({ ...latest.current, ...(on ? { on: true as const } : { on: undefined }) }),
    toggle: (type) => save({ ...latest.current, passes: togglePass(latest.current.passes, type) }),
    patch: (type, change) => save({ ...latest.current, passes: patchPass(latest.current.passes, type, change) }),
    replace: (type, next) => {
      const passes = [...(latest.current.passes ?? [])];
      const at = passes.findIndex((p) => p.type === type);
      const made = next(passes[at]);
      if (at < 0) passes.push(made);
      else passes[at] = made;
      save({ ...latest.current, passes });
    },
    setTools: (tools) => save({ ...latest.current, tools }),
  };
}
