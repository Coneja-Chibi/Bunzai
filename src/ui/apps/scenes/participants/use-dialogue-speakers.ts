/**
 * The speakers the message list colours quotes for: the scene's roster (participants-store.ts) while the Dialogue Colors prop is on,
 * undefined otherwise. Each colour is held to the painted theme's text floor (the one accent derivation, F4), so a dark colour a
 * person chose stays readable. The array is rebuilt only when the roster, the cast or the theme changes (Prose is memoized on it).
 */
import { useEffect, useMemo } from "react";
import { speakersOf, type Speaker } from "../../../../core/participants/roster";
import type { OpenScene } from "../../../../studio/scenes";
import type { AppContext } from "../../../app-contract";
import { useAccentText } from "../../../_shared/use-scoped-accents";
import { DIALOGUE_COLORS_PROP } from "../props/dialogue-colors";
import { heldParticipants, holdParticipants, useHeldParticipants } from "./participants-store";
import { sceneRoster } from "./scene-roster";

export function useDialogueSpeakers(ctx: AppContext, scene: OpenScene | null, propsOn: readonly string[] | null): readonly Speaker[] | undefined {
  const on = scene !== null && propsOn?.includes(DIALOGUE_COLORS_PROP) === true;
  const chatId = scene?.chat.id ?? "";
  const stored = useHeldParticipants(chatId);
  useEffect(() => {
    if (!on || heldParticipants(chatId) !== undefined) return;
    ctx.api.getSceneParticipants(chatId).then((r) => holdParticipants(chatId, r.participants), () => undefined);
  }, [on, chatId, ctx.api]);
  const readable = useAccentText();
  return useMemo(() => (on && scene ? speakersOf(sceneRoster(scene, stored ?? undefined)).map((s) => ({ ...s, color: readable(s.color) })) : undefined), [on, scene?.chat.id, scene?.snapshot, scene?.chat.cast, stored, readable]); // eslint-disable-line react-hooks/exhaustive-deps -- the roster reads only the frozen cast
}
