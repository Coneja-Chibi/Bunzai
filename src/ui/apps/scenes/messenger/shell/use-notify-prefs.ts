/**
 * The Messenger's notification choices as state (prefs are not reactive): this character's notify choice, the muted scenes, "Hide muted scenes" and the desktop notice switch, over the one
 * module that owns them (../../reply-notice.ts). Turning the desktop notice on is the only place a permission is asked for, from the click that did it; a refusal leaves it off and says so.
 */
import { useCallback, useState } from "react";
import type { AppContext } from "../../../../app-contract";
import type { SceneSummary } from "../../../../../studio/scenes";
import { characterNotify, desktopOn, enableDesktop, hideMutedOn, mutedScenes, setCharacterNotify, setDesktop, setHideMuted, toggleMutedScene, type CharacterNotify } from "../../reply-notice";

export interface NotifyView { character: CharacterNotify; desktop: boolean; hideMuted: boolean; /** The browser can show notices at all. */ canDesktop: boolean }
export type NotifyChange = { kind: "character"; value: CharacterNotify } | { kind: "desktop"; on: boolean } | { kind: "hideMuted"; on: boolean };

export const DESKTOP_DENIED = "Desktop notices are blocked for this app. Allow them in your browser's site settings, then turn this on again.";

const read = (prefs: AppContext["prefs"], characterId: string) => ({ muted: mutedScenes(prefs), hideMuted: hideMutedOn(prefs), desktop: desktopOn(prefs), character: characterNotify(prefs, characterId) });

export function useNotifyPrefs(ctx: AppContext, characterId: string) {
  const { prefs, setStatus } = ctx;
  const [saved, setSaved] = useState(() => read(prefs, characterId));
  const [seenCharacter, setSeenCharacter] = useState(characterId);
  // The open character changed (another scene): its own choice is read, the rest stays.
  if (seenCharacter !== characterId) { setSeenCharacter(characterId); setSaved(read(prefs, characterId)); }
  const refresh = useCallback(() => setSaved(read(prefs, characterId)), [prefs, characterId]);
  const view: NotifyView = { character: saved.character, desktop: saved.desktop, hideMuted: saved.hideMuted, canDesktop: typeof Notification !== "undefined" };
  const change = (c: NotifyChange): void => {
    if (c.kind === "character") { setCharacterNotify(prefs, characterId, c.value); refresh(); return; }
    if (c.kind === "hideMuted") { setHideMuted(prefs, c.on); refresh(); return; }
    if (!c.on) { setDesktop(prefs, false); refresh(); return; }
    void enableDesktop(prefs).then((r) => { if (r !== "on") setStatus(DESKTOP_DENIED); refresh(); });
  };
  const toggleMute = (chatId: string): void => { toggleMutedScene(prefs, chatId); refresh(); };
  /** The scenes to list: the muted ones leave while "Hide muted scenes" is on, except the open one. */
  const visible = (scenes: readonly SceneSummary[], openId: string): SceneSummary[] => (saved.hideMuted ? scenes.filter((s) => s.id === openId || !saved.muted.includes(s.id)) : [...scenes]);
  return { view, muted: saved.muted, change, toggleMute, visible };
}
