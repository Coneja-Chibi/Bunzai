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
import { asPresetBody } from "../../../core/writing";
import type { ScriptSheetBody } from "../../../entities/scriptsheet/schema";

type Entity = { kind: string; id: string; body: PresetBody };
/** The piece as the library holds it; a write sends it back whole with only the body changed. */
type Stored = { kind: string; id: string; body: unknown };
/** The scene's writing setup as the preset it sends (`entity`), and as the library holds it (`raw`). */
type Ready = { entity: Entity; revision: string; raw: Stored };
/** Which writing setup the scene follows (its kind and id), or null. */
export type WritingSlot = { kind: string; id: string } | null;
export type PresetLoad = AsyncState<Ready, { state: "none" } | { state: "gone" }>;
export type PresetNote = { kind: "saved" | "stale" | "failed"; text: string };
export type SystemPromptKey = keyof PresetSystemPrompts;

export type PresetText = {
  loaded: PresetLoad;
  /** Which load of the preset is showing; every text an editor hands back carries it. */
  reloads: number;
  note: PresetNote | null;
  setNote(note: PresetNote | null): void;
  load(slot: WritingSlot): Promise<void>;
  saveText(promptId: string, text: string, typedAt: number): void;
  saveSystemPrompt(key: SystemPromptKey, text: string, typedAt: number): void;
  /** Saves a Script Sheet's name and instruction in the same chain; rejects with words fit to show, and the draft stays with the caller. */
  saveSheet(name: string, content: string): Promise<void>;
};

export function useScenePresetText(ctx: AppContext, slot: WritingSlot, onBody: (body: PresetBody | null) => void): PresetText {
  const [loaded, setLoaded] = useState<PresetLoad>(slot ? { state: "loading" } : { state: "none" });
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

  const load = useCallback(async (slot: WritingSlot) => {
    const mine = ++generation.current;
    if (slot) loadedFor.current.set(mine, `${slot.kind}:${slot.id}`);
    current.current = null;
    if (!slot) return setLoaded({ state: "none" });
    setLoaded({ state: "loading" });
    try {
      const found = await api.current.getEditableEntity(`kind=${encodeURIComponent(slot.kind)}&id=${encodeURIComponent(slot.id)}`);
      // A newer load (another preset, or a later reload) owns the writer now.
      if (mine !== generation.current) return;
      const raw = found.entity as Stored | null;
      const body = raw?.kind === slot.kind ? asPresetBody(slot.kind, raw.body) : null;
      if (!raw || !body) return setLoaded({ state: "gone" });
      current.current = { entity: { kind: slot.kind, id: slot.id, body }, revision: found.revision, raw };
      setLoaded({ state: "ready", ...current.current });
      setReloads(mine);
    } catch (e) {
      if (mine !== generation.current) return;
      setLoaded(e instanceof ApiHttpError && e.status === 404 ? { state: "gone" } : { state: "failed", why: toErrorMessage(e, "the preset could not be read") });
    }
  }, []);

  const slotKey = slot ? `${slot.kind}:${slot.id}` : "";
  useEffect(() => {
    void load(slot);
    setNote(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotKey, load]);
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
      // a block or template edit belongs to a preset's own blocks; a Script Sheet is edited as its one instruction
      if (cur && cur.entity.kind !== "preset") return setNote({ kind: "failed", text: "This scene uses a Script Sheet, which has no blocks to edit. Edit its instruction instead." });
      const body = cur ? edit(cur.entity.body) : null;
      if (!cur || !body) return;
      const raw = { ...cur.raw, body };
      try {
        const saved = await api.current.saveEditedEntity(raw, cur.revision);
        current.current = { entity: { ...cur.entity, body }, revision: saved.revision, raw };
        setLoaded({ state: "ready", ...current.current });
        setNote({ kind: "saved", text: `Saved to ${body.name}. Every scene using this preset sends the new text from its next turn.` });
      } catch (e) {
        if (e instanceof ApiHttpError && e.status === 409) {
          // Reload only if the writer still shows this preset; a switch since then owns it.
          if (typedAt !== generation.current) return;
          await load({ kind: cur.entity.kind, id: cur.entity.id });
          setNote({ kind: "stale", text: "This preset changed somewhere else first, so the edit was not saved. The latest text is loaded; type it again to save." });
        } else {
          setNote({ kind: "failed", text: `The text was not saved: ${toErrorMessage(e, "the library refused it")}. It is still here to try again.` });
        }
      }
    });
  };

  const saveSheet = (name: string, content: string): Promise<void> => {
    const queuedAt = generation.current;
    const run = texts.current.then(async () => {
      // queued against a load that has since been replaced: this draft belongs to the sheet that was showing then
      if (queuedAt !== generation.current) throw new Error("The Script Sheet reloaded before this save ran. Your draft has been kept.");
      const cur = current.current;
      if (!cur || cur.entity.kind !== "scriptsheet") throw new Error("This Script Sheet is no longer loaded. Your draft has been kept.");
      const raw = { ...cur.raw, body: { ...(cur.raw.body as ScriptSheetBody), name, content } };
      try {
        const saved = await api.current.saveEditedEntity(raw, cur.revision);
        current.current = { entity: { ...cur.entity, body: asPresetBody(cur.entity.kind, raw.body)! }, revision: saved.revision, raw };
        setLoaded({ state: "ready", ...current.current });
      } catch (e) {
        if (e instanceof ApiHttpError && e.status === 409) throw new Error("This Script Sheet changed somewhere else first. Your draft has been kept; reopen it to see the saved version.");
        throw new Error(toErrorMessage(e, "Could not save this Script Sheet. Your draft has been kept."));
      }
    });
    texts.current = run.catch(() => undefined);
    return run;
  };

  return {
    loaded, reloads, note, setNote, load, saveSheet,
    saveText: (id, text, typedAt) => save(typedAt, (body) => {
      const prompt = body.prompts.find((p) => p.id === id);
      return !prompt || prompt.content === text ? null : { ...body, prompts: body.prompts.map((p) => (p.id === id ? { ...p, content: text } : p)) };
    }),
    saveSystemPrompt: (key, text, typedAt) => save(typedAt, (body) =>
      (body.systemPrompts?.[key] ?? "") === text ? null : { ...body, systemPrompts: { ...body.systemPrompts, [key]: text } }),
  };
}
