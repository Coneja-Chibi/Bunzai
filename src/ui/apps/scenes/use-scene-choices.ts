/**
 * A scene's answers to its preset's choice groups (ChatStore rule 42, RoleCall's useChoiceSelections): the declared groups, the answers as
 * the scene holds them with defaults applied, and a writer that sends one answer at a time in order, so a slower first answer can never land
 * after a newer one and erase it. The shown answer changes at once; a refused write puts the stored answers back and says why.
 */
import { useMemo, useRef, useState } from "react";
import type { AppContext } from "../../app-contract";
import type { PresetBody } from "../../../entities/preset/schema";
import type { Chat, ChoicePick } from "../../../stage/contracts/chat-store";
import { resolveSelections, type ChoiceGroup, type ChoiceSelections } from "../../../core/macros/choice-groups";
import { PRESET_CHOICE_DEFAULTS_KEY, defaultsFor, toChoiceGroups, withDefaults } from "../../../core/preset/choices";
import { toErrorMessage } from "../../_shared/error-message";

export interface SceneChoices {
  groups: ChoiceGroup[];
  /** The effective answers: stored ones where valid, declared defaults for the rest. */
  selections: ChoiceSelections;
  /** Sets one answer; the returned promise rejects with the reason when the store refused it. */
  select(groupId: string, value: ChoicePick): Promise<void>;
  error: string | null;
}

export function useSceneChoices(ctx: AppContext, chat: Chat, body: PresetBody | null, onChanged: (chat: Chat) => void): SceneChoices {
  const presetId = chat.preset?.id ?? null;
  const groups = useMemo(() => toChoiceGroups(body?.choices), [body]);
  /** Answers given but not yet confirmed by the store, over what the store holds. */
  const [pending, setPending] = useState<Record<string, ChoicePick>>({});
  const [error, setError] = useState<string | null>(null);
  const api = useRef(ctx.api);
  api.current = ctx.api;
  const held = useRef(chat);
  held.current = chat;
  const changed = useRef(onChanged);
  changed.current = onChanged;
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const stored = presetId ? chat.regex?.choices?.[presetId] : undefined;
  // The scene's own answers over the person's saved defaults (Save & done), over the preset's declared defaults.
  const saved = presetId && groups.length > 0 ? defaultsFor(ctx.prefs.get(PRESET_CHOICE_DEFAULTS_KEY), presetId) : undefined;
  const selections = useMemo(() => resolveSelections(groups, withDefaults(saved, { ...stored, ...pending })), [groups, saved, stored, pending]);
  return {
    groups,
    selections,
    error,
    select: (groupId, value) => {
      if (!presetId) return Promise.resolve();
      setError(null);
      setPending((old) => ({ ...old, [groupId]: value }));
      const done = queue.current.then(async () => {
        const next = await api.current.setSceneRegex(held.current.id, { choices: { [presetId]: { [groupId]: value } } });
        held.current = next;
        changed.current(next);
      });
      queue.current = done.catch(() => undefined);
      return done.then(
        () => setPending((old) => { const { [groupId]: _gone, ...rest } = old; return rest; }),
        (e: unknown) => { setPending((old) => { const { [groupId]: _gone, ...rest } = old; return rest; }); setError(toErrorMessage(e, "That answer could not be saved.")); throw e; },
      );
    },
  };
}
