/**
 * The one reader and writer of a character's new-scene defaults for both homes (the Messenger character settings page and the Full Chat Cast Character tab): the user pref
 * `scenes.characterDefaults`, read and written only through `characterDefaultsOf` and `withCharacterDefaults`. Backdrop and samplers are kept from the open scene's own; the preset is
 * chosen from the Library. Changing a default never changes a scene that already exists.
 */
import { useEffect, useRef, useState } from "react";
import { CHARACTER_DEFAULTS_PREF, characterDefaultsOf, withCharacterDefaults, type CharacterDefaults, type DefaultField } from "../../../../studio/scene-character-defaults";
import type { AppContext } from "../../../app-contract";
import type { OpenScene } from "../../../../studio/scenes";

export interface CharacterDefaultsState {
  d: CharacterDefaults;
  problems: DefaultField[];
  /** the Library's presets once listed, else null */
  choices: { value: string; label: string }[];
  /** the saved preset id is no longer in the Library */
  gone: boolean;
  note: string | undefined;
  customSamplers: boolean;
  put(patch: Parameters<typeof withCharacterDefaults>[2]): void;
  /** keeps this scene's samplers (or says it has none) */
  keepSamplers(): void;
  /** keeps this scene's backdrop (or says it has none) */
  keepBackdrop(): void;
}

export function useCharacterDefaults(ctx: Pick<AppContext, "prefs" | "api">, chat: Pick<OpenScene["chat"], "backdrop" | "preset" | "cast">): CharacterDefaultsState {
  const characterId = chat.cast.character.id;
  const [raw, setRaw] = useState<unknown>(() => ctx.prefs.get(CHARACTER_DEFAULTS_PREF));
  const [library, setLibrary] = useState<{ id: string; name: string }[] | null>(null);
  const [note, setNote] = useState<string | undefined>(undefined);
  const api = useRef(ctx.api);
  api.current = ctx.api;
  useEffect(() => {
    let live = true;
    api.current.listEntities("preset").then((list) => live && setLibrary(list), () => live && setLibrary([]));
    return () => { live = false; };
  }, []);
  const { defaults, problems } = characterDefaultsOf(raw, characterId);
  const d: CharacterDefaults = defaults ?? {};
  const put = (patch: Parameters<typeof withCharacterDefaults>[2]): void => {
    const next = withCharacterDefaults(raw, characterId, patch);
    ctx.prefs.set(CHARACTER_DEFAULTS_PREF, Object.keys(next).length > 0 ? next : null);
    setRaw(Object.keys(next).length > 0 ? next : undefined);
    setNote(undefined);
  };
  const choices = (library ?? []).map((s) => ({ value: s.id, label: s.name }));
  const gone = d.presetId !== undefined && library !== null && !choices.some((c) => c.value === d.presetId);
  const sceneSamplers = chat.preset?.samplers;
  return {
    d, problems, choices, gone, note, customSamplers: d.samplers !== undefined && Object.keys(d.samplers).length > 0, put,
    keepSamplers: () => {
      if (sceneSamplers && Object.keys(sceneSamplers).length > 0) put({ samplers: sceneSamplers });
      else setNote("This scene has no sampler changes of its own to keep. Change them in the Control Panel first.");
    },
    keepBackdrop: () => {
      if (chat.backdrop) put({ backdrop: chat.backdrop });
      else setNote("This scene has no backdrop to keep. Pick one in the Control Panel first.");
    },
  };
}
