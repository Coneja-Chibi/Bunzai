/**
 * The scene preset's one text writer: it loads the scene's library preset and saves the text edits
 * made to it (a block's content, or one of its always-on system prompts). The Preset tab and the
 * Writing Tools tab both edit the preset through it, so they hold one revision and never 409 each
 * other; PromptingWing owns it and hands it to both (the Booth learned the same for samplers in
 * use-scene-preset-own.ts).
 *
 * Saves run one after another, each against the revision the last left, and one that changes nothing
 * is not sent. Text typed before a reload, or on another preset, is never saved over it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppContext } from "../../app-contract";
import type { PresetBody, PresetSystemPrompts } from "../../../entities/preset/schema";
import { ApiHttpError } from "../../_shared/api-fetch";
import { toErrorMessage } from "../../_shared/error-message";
import type { AsyncState } from "../../_shared/async-state";

type Entity = { kind: string; id: string; body: PresetBody };
type Ready = { entity: Entity; revision: string };
export type PresetLoad = AsyncState<Ready, { state: "none" } | { state: "gone" }>;
export type PresetNote = { kind: "saved" | "stale" | "failed"; text: string };
export type SystemPromptKey = keyof PresetSystemPrompts;

export type PresetText = {
  loaded: PresetLoad;
  /** Which load of the preset is showing; every text an editor hands back carries it. */
  reloads: number;
  note: PresetNote | null;
  setNote(note: PresetNote | null): void;
  load(id: string | null): Promise<void>;
  saveText(promptId: string, text: string, typedAt: number): void;
  saveSystemPrompt(key: SystemPromptKey, text: string, typedAt: number): void;
};

export function useScenePresetText(ctx: AppContext, presetId: string | null, onBody: (body: PresetBody | null) => void): PresetText {
  const [loaded, setLoaded] = useState<PresetLoad>(presetId ? { state: "loading" } : { state: "none" });
  const [reloads, setReloads] = useState(0);
  const [note, setNote] = useState<PresetNote | null>(null);

  // The shell rebuilds ctx on every status change; these refs keep the writer from reloading with it.
  const api = useRef(ctx.api);
  api.current = ctx.api;
  const current = useRef<Ready | null>(null);
  const texts = useRef<Promise<void>>(Promise.resolve());
  /** Rises with every load: text typed before a reload, or on another preset, is never saved over it. */
  const generation = useRef(0);
  /** Which preset each load was for, so a note about an old one never shows on the next. */
  const loadedFor = useRef(new Map<number, string>());

  const load = useCallback(async (id: string | null) => {
    const mine = ++generation.current;
    if (id) loadedFor.current.set(mine, id);
    current.current = null;
    if (!id) return setLoaded({ state: "none" });
    setLoaded({ state: "loading" });
    try {
      const found = await api.current.getEditableEntity(`kind=preset&id=${encodeURIComponent(id)}`);
      // A newer load (another preset, or a later reload) owns the writer now.
      if (mine !== generation.current) return;
      const entity = found.entity as Entity;
      if (entity?.kind !== "preset") return setLoaded({ state: "gone" });
      current.current = { entity, revision: found.revision };
      setLoaded({ state: "ready", ...current.current });
      setReloads(mine);
    } catch (e) {
      if (mine !== generation.current) return;
      setLoaded(e instanceof ApiHttpError && e.status === 404 ? { state: "gone" } : { state: "failed", why: toErrorMessage(e, "the preset could not be read") });
    }
  }, []);

  useEffect(() => {
    void load(presetId);
    setNote(null);
  }, [presetId, load]);
  useEffect(() => onBody(loaded.state === "ready" ? loaded.entity.body : null), [loaded, onBody]);

  /** One save after another; `edit` returns the changed body, or null when there is nothing to change. */
  const save = (typedAt: number, edit: (body: PresetBody) => PresetBody | null) => {
    texts.current = texts.current.then(async () => {
      // Typed against a load that has since been replaced: saving it would overwrite what came in.
      if (typedAt !== generation.current) {
        if (loadedFor.current.get(typedAt) === loadedFor.current.get(generation.current)) {
          setNote({ kind: "stale", text: "The preset reloaded while you typed, so that text was not saved. The latest text is showing; type it again to save." });
        }
        return;
      }
      const cur = current.current;
      const body = cur ? edit(cur.entity.body) : null;
      if (!cur || !body) return;
      const entity = { ...cur.entity, body };
      try {
        const saved = await api.current.saveEditedEntity(entity, cur.revision);
        current.current = { entity, revision: saved.revision };
        setLoaded({ state: "ready", ...current.current });
        setNote({ kind: "saved", text: `Saved to ${body.name}. Every scene using this preset sends the new text from its next turn.` });
      } catch (e) {
        if (e instanceof ApiHttpError && e.status === 409) {
          // Reload only if the writer still shows this preset; a switch since then owns it.
          if (typedAt !== generation.current) return;
          await load(cur.entity.id);
          setNote({ kind: "stale", text: "This preset changed somewhere else first, so the edit was not saved. The latest text is loaded; type it again to save." });
        } else {
          setNote({ kind: "failed", text: `The text was not saved: ${toErrorMessage(e, "the library refused it")}. It is still here to try again.` });
        }
      }
    });
  };

  return {
    loaded, reloads, note, setNote, load,
    saveText: (id, text, typedAt) => save(typedAt, (body) => {
      const prompt = body.prompts.find((p) => p.id === id);
      return !prompt || prompt.content === text ? null : { ...body, prompts: body.prompts.map((p) => (p.id === id ? { ...p, content: text } : p)) };
    }),
    saveSystemPrompt: (key, text, typedAt) => save(typedAt, (body) =>
      (body.systemPrompts?.[key] ?? "") === text ? null : { ...body, systemPrompts: { ...body.systemPrompts, [key]: text } }),
  };
}
