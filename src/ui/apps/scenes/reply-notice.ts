/**
 * Reply notices (Messenger backlog slice 22, decision D4). In-app unread is always on (messenger/shell/read-marks.ts); this is the rest: which characters and scenes may notify, the "Hide
 * muted scenes" switch, and the optional desktop notice. The desktop notice is OFF by default, asks the browser for permission only when the person turns it on, fires only for a finished
 * reply while the window is not focused, and its body is "New reply from X": never any message text. Prefs: `messenger.notify` `{ desktop, byCharacter }`, `messenger.mutedScenes` (ids),
 * `messenger.hideMuted`. Every read parses the saved value defensively. The Full Chat and the Messenger both call `replyNotice` from the turn hook, so the notice does not depend on a layout.
 */
import { isRecord, recOr, strArray } from "../../../core/guards";
import type { AppContext } from "../../app-contract";

export const NOTIFY_KEY = "messenger.notify";
export const MUTED_SCENES_KEY = "messenger.mutedScenes";
export const HIDE_MUTED_KEY = "messenger.hideMuted";

type Prefs = AppContext["prefs"];
export type CharacterNotify = "all" | "muted";
interface Notify { desktop: boolean; byCharacter: Record<string, CharacterNotify> }

function readNotify(prefs: Prefs): Notify {
  const raw = prefs.get(NOTIFY_KEY);
  const o = recOr(raw);
  const byCharacter: Record<string, CharacterNotify> = {};
  const saved = o["byCharacter"];
  if (isRecord(saved)) for (const [id, v] of Object.entries(saved)) if (v === "muted") byCharacter[id] = "muted";
  return { desktop: o["desktop"] === true, byCharacter };
}
const writeNotify = (prefs: Prefs, n: Notify): void => prefs.set(NOTIFY_KEY, n);

export const desktopOn = (prefs: Prefs): boolean => readNotify(prefs).desktop;
export const characterNotify = (prefs: Prefs, characterId: string): CharacterNotify => readNotify(prefs).byCharacter[characterId] ?? "all";
export const setDesktop = (prefs: Prefs, on: boolean): void => writeNotify(prefs, { ...readNotify(prefs), desktop: on });
/** "all" is the default, so choosing it removes the entry. */
export function setCharacterNotify(prefs: Prefs, characterId: string, value: CharacterNotify): void {
  const n = readNotify(prefs);
  const { [characterId]: _drop, ...rest } = n.byCharacter;
  writeNotify(prefs, { ...n, byCharacter: value === "muted" ? { ...rest, [characterId]: "muted" } : rest });
}

export function mutedScenes(prefs: Prefs): string[] {
  const raw = prefs.get(MUTED_SCENES_KEY);
  return strArray(raw);
}
/** Mutes the scene or unmutes it; returns the list now saved. */
export function toggleMutedScene(prefs: Prefs, chatId: string): string[] {
  const now = mutedScenes(prefs);
  const next = now.includes(chatId) ? now.filter((id) => id !== chatId) : [...now, chatId];
  prefs.set(MUTED_SCENES_KEY, next);
  return next;
}
export const hideMutedOn = (prefs: Prefs): boolean => prefs.get(HIDE_MUTED_KEY) === true;
export const setHideMuted = (prefs: Prefs, on: boolean): void => prefs.set(HIDE_MUTED_KEY, on);

/** What the notice needs of the browser, so tests can stand in for it. */
export interface NoticeEnv {
  permission(): NotificationPermission | "unsupported";
  focused(): boolean;
  show(title: string, body: string, tag: string): void;
  request(): Promise<NotificationPermission>;
}

export const browserEnv: NoticeEnv = {
  permission: () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission),
  focused: () => typeof document === "undefined" || document.hasFocus(),
  show: (title, body, tag) => { try { new Notification(title, { body, tag }); } catch { /* a blocked notice is only a missed notice */ } },
  request: () => Notification.requestPermission(),
};

/** A finished reply: shows the notice when it is on, allowed, the scene and character are not muted, and the window is not focused. `who` is the character that wrote it. */
export function replyNotice(prefs: Prefs, chatId: string, who: { characterId: string; name: string } | null, env: NoticeEnv = browserEnv): void {
  if (!who || !desktopOn(prefs)) return;
  if (characterNotify(prefs, who.characterId) === "muted" || mutedScenes(prefs).includes(chatId)) return;
  if (env.permission() !== "granted" || env.focused()) return;
  env.show("Bunzai", `New reply from ${who.name}`, chatId);
}

/** The switch turned on: asks for permission now (a user gesture) unless it is already granted, and saves the pref only when it is. */
export async function enableDesktop(prefs: Prefs, env: NoticeEnv = browserEnv): Promise<"on" | "denied" | "unsupported"> {
  let permission = env.permission();
  if (permission === "unsupported") return "unsupported";
  if (permission === "default") permission = await env.request();
  if (permission !== "granted") return "denied";
  setDesktop(prefs, true);
  return "on";
}
