/**
 * The scene's own preset values (ChatStore rule 19): the switches and sampler values that belong to this
 * scene, not to the library preset. One debounced writer for the Prompting wing's Preset tab and the
 * Control Booth: values show at once and are saved after a short pause so a slider drag is one write;
 * leaving (closing the wing) saves what was set, and a failed save puts back what the store holds. A
 * reply for a preset the scene has since left never brings it back on screen.
 */
import { useEffect, useRef, useState } from "react";
import type { AppContext } from "../../app-contract";
import type { PresetSamplers } from "../../../entities/preset/schema";
import type { Chat, ChatPreset } from "../../../stage/contracts/chat-store";
import { toErrorMessage } from "../../_shared/error-message";
import { useDebouncedSave, type DebouncedSave } from "../../_shared/use-debounced-value";
import { setSampler, type SamplerKey } from "./preset-core";

export interface ScenePresetOwn {
  own: ChatPreset | null;
  save(next: ChatPreset): void;
  /** One change on top of the latest values, including ones saved in this same tick: two edits in a row compose, neither is lost. A scene with no preset has nothing to edit. */
  edit(change: (current: ChatPreset) => ChatPreset): void;
  /** One sampler set to a value; the preset's own value clears the scene's (preset-core setSampler). */
  setSamplerValue<K extends SamplerKey>(presetSamplers: PresetSamplers | undefined, key: K, value: ChatPreset["samplers"][K]): void;
  /** The pending-write handle, for a caller that leaves the preset (cancel) or re-chooses it (flush). */
  saver: DebouncedSave<ChatPreset>;
}

/** `onFailed` is told why a save failed, in words fit to show. */
export function useScenePresetOwn(ctx: AppContext, chat: Chat, onChanged: (chat: Chat) => void, onFailed: (message: string) => void): ScenePresetOwn {
  const [own, setOwn] = useState<ChatPreset | null>(chat.preset ?? null);
  // The shell rebuilds ctx on every status change; these refs keep the writer from restarting with it.
  const api = useRef(ctx.api);
  api.current = ctx.api;
  const changed = useRef(onChanged);
  changed.current = onChanged;
  const failed = useRef(onFailed);
  failed.current = onFailed;
  const chatId = useRef(chat.id);
  chatId.current = chat.id;
  const held = useRef(chat.preset ?? null);
  held.current = chat.preset ?? null;
  const saver = useDebouncedSave<ChatPreset>(async (next) => {
    const saved = await api.current.setScenePreset(chatId.current, next);
    if (held.current?.id === next.id) changed.current(saved);
  }, 300, (e) => {
    // Newer values still waiting stay on screen; they are about to be sent.
    if (!saver.pending()) setOwn(held.current);
    failed.current(toErrorMessage(e, "This scene's settings could not be saved."));
  });
  // The scene's own values as the store holds them, unless a write of ours is still waiting.
  useEffect(() => { if (!saver.pending()) setOwn(chat.preset ?? null); }, [chat.preset, saver]);
  const latest = useRef(own);
  latest.current = own;
  const save = (next: ChatPreset): void => {
    latest.current = next;
    setOwn(next);
    saver.push(next);
  };
  return {
    own,
    save,
    edit: (change) => { if (latest.current) save(change(latest.current)); },
    setSamplerValue: (presetSamplers, key, value) => { if (latest.current) save({ ...latest.current, samplers: setSampler(latest.current.samplers, key, value, presetSamplers?.[key]) }); },
    saver,
  };
}
