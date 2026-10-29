/** The rows of the You scope that read and write one app preference the Settings app already owns (the same keys and spellings), in the row-table shape of ../rows.ts. */
import { SETTING_KEYS } from "../../../../../../studio/settings-shape";
import { knownDecks } from "../../../../../_shared/decks";
import { UI_TEXT, highContrastOf, reduceMotionOf, uiTextSizeOf } from "../../../../../_shared/accessibility-prefs";
import { AUTOPLAY_KEY, MUSIC_TAB_PREF, autoplayOn, musicTabShown } from "../../../stage-music-core";
import type { ChoiceDef, NumberDef, RowDef, RowEnv, ToggleDef } from "../rows";

const setPref = (env: RowEnv, key: string, value: unknown): void => { env.ctx.prefs.set(key, value); env.repaint(); };
const PREF_LAYOUT = "editor.layout";
const PREF_MODE = "editor.mode";
const PREF_AUTOSAVE = "workbench.autosave";
const PREF_RESTORE = "workbench.restoreSession";

export const MUSIC_ROWS: readonly RowDef[] = [
  { id: "musicTab", label: "Show the Music tab", description: "Hide the tab and keep the music playing.", control: "toggle",
    read: (env) => musicTabShown(env.ctx.prefs), write: (env, v) => setPref(env, MUSIC_TAB_PREF, v) } satisfies ToggleDef,
  { id: "autoplay", label: "Play on scene open", description: "Starts the last track you played when a scene with Mood Music opens.", control: "toggle",
    read: (env) => autoplayOn(env.ctx.prefs.get(AUTOPLAY_KEY)), write: (env, v) => setPref(env, AUTOPLAY_KEY, v) } satisfies ToggleDef,
];

export const WORKBENCH_ROWS: readonly RowDef[] = [
  { id: "autosave", label: "Autosave", description: "Save half a second after you stop typing. Ctrl+S still saves at once.", control: "toggle",
    read: (env) => env.ctx.prefs.get(PREF_AUTOSAVE) === true, write: (env, v) => setPref(env, PREF_AUTOSAVE, v) } satisfies ToggleDef,
  { id: "restoreSession", label: "Reopen where you left off", description: "Restore the pieces you had open after a restart or a crash.", control: "toggle",
    read: (env) => env.ctx.prefs.get(PREF_RESTORE) === true, write: (env, v) => setPref(env, PREF_RESTORE, v) } satisfies ToggleDef,
  { id: "editorLayout", label: "Editor layout", description: "Bento shows every field at once; Playbill turns them into acts you page through.", control: "select",
    options: [{ value: "bento", label: "Bento" }, { value: "playbill", label: "Playbill" }],
    read: (env) => (env.ctx.prefs.get(PREF_LAYOUT) === "playbill" ? "playbill" : "bento"), write: (env, v) => setPref(env, PREF_LAYOUT, v) } satisfies ChoiceDef,
  { id: "editorMode", label: "How you fill it in", description: "Grid shows every field; Steps walks you through like a quiz.", control: "select",
    options: [{ value: "grid", label: "Grid" }, { value: "interview", label: "Steps" }],
    read: (env) => (env.ctx.prefs.get(PREF_MODE) === "interview" ? "interview" : "grid"), write: (env, v) => setPref(env, PREF_MODE, v) } satisfies ChoiceDef,
  { id: "workbenchFollow", label: "After sending a piece", description: "Follow it to the Workbench, stay where you are, or ask every time.", control: "select",
    options: [{ value: "ask", label: "Ask me" }, { value: "always", label: "Always follow" }, { value: "never", label: "Stay" }],
    read: (env) => { const f = env.ctx.prefs.get(SETTING_KEYS.workbenchFollow); return f === "always" || f === "never" ? f : "ask"; }, write: (env, v) => setPref(env, SETTING_KEYS.workbenchFollow, v) } satisfies ChoiceDef,
];

/** Home app and first deck: their option lists come from the open studio, so they are built from the context. */
export function studioRows(env: RowEnv): RowDef[] {
  const apps = env.ctx.apps().filter((m) => !m.comingSoon && !m.dockFoot && !m.catalogOnly);
  const decks = knownDecks();
  const pref = (key: string, fallback: string, valid: readonly string[]): string => { const v = env.ctx.prefs.get(key); return typeof v === "string" && valid.includes(v) ? v : fallback; };
  return [
    { id: "homeApp", label: "Home", description: "The room Bunzai opens in when you start it.", control: "select", options: apps.map((m) => ({ value: m.id, label: m.title.replace(/^The /, "") })),
      read: () => pref(SETTING_KEYS.homeApp, apps[0]?.id ?? "", apps.map((m) => m.id)), write: (e, v) => setPref(e, SETTING_KEYS.homeApp, v) } satisfies ChoiceDef,
    { id: "firstDeck", label: "Library opens on", description: "The deck you see first when you visit the shelves.", control: "select", options: decks.map((d) => ({ value: d.kind, label: d.plural })),
      read: () => pref(SETTING_KEYS.firstDeck, "character", decks.map((d) => d.kind)), write: (e, v) => setPref(e, SETTING_KEYS.firstDeck, v) } satisfies ChoiceDef,
  ];
}

/** Accessibility: the same three keys the Settings app Appearance page writes (shell/accessibility.ts reads them and paints the page). */
export const ACCESS_ROWS: readonly RowDef[] = [
  { id: "uiTextSize", label: "Interface text size", description: "Never below 12 px.", control: "slider", min: UI_TEXT.min, max: UI_TEXT.max, step: UI_TEXT.step, unit: " px",
    read: (env) => uiTextSizeOf(env.ctx.prefs.get(SETTING_KEYS.uiTextSize)), write: (env, v) => setPref(env, SETTING_KEYS.uiTextSize, uiTextSizeOf(v)) } satisfies NumberDef,
  { id: "reduceMotion", label: "Reduce motion", description: "Turns off slides and the lift on buttons.", control: "toggle",
    read: (env) => reduceMotionOf(env.ctx.prefs.get(SETTING_KEYS.uiReduceMotion)), write: (env, v) => setPref(env, SETTING_KEYS.uiReduceMotion, v) } satisfies ToggleDef,
  { id: "highContrast", label: "High contrast edges", description: "Stronger borders on rows and controls.", control: "toggle",
    read: (env) => highContrastOf(env.ctx.prefs.get(SETTING_KEYS.uiHighContrast)), write: (env, v) => setPref(env, SETTING_KEYS.uiHighContrast, v) } satisfies ToggleDef,
];
