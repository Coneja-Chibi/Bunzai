/**
 * The Stage look: every Appearance setting of the Stage wing (RoleCall's StageSettings, StepYourStage.tsx:87-277, shown by
 * StageSettingsPanel.tsx) in one place: the preference keys, the one set of defaults (RoleCall had three that disagreed, F2),
 * each value parsed once at this boundary (a missing, malformed or out-of-range value reads as unset, never a clamp or a
 * throw), and what each paints on the scene root. A setting at its default paints nothing, so a theme's own variant shows
 * until the person chooses. Display settings are per-user app preferences like Show timestamps (ctx.prefs); Reset writes null.
 */
import type { CSSProperties } from "react";
import { boolOr } from "../../../core/guards";
import { normalizeHex } from "../../_shared/color-math";

export const LOOK_KEYS = {
  chatTheme: "scenes.chatTheme", opacity: "scenes.bubbleOpacity", gap: "scenes.messageSpacing", avatars: "scenes.showAvatars",
  size: "scenes.textSize", font: "scenes.textFont", colorChar: "scenes.textColor", colorUser: "scenes.textColorUser", colorDialogue: "scenes.dialogueColor", lineHeight: "scenes.lineHeight",
  autoScroll: "scenes.autoScroll", typing: "scenes.typingIndicator", fadeIn: "scenes.streamingFadeIn", chime: "scenes.responseChime",
  compact: "scenes.compactMode", collapse: "scenes.collapseWings", collapseStyle: "scenes.collapseWingsStyle", labels: "scenes.wingLabels", acts: "scenes.stageActs",
} as const;

export const CHAT_THEMES = ["basic", "stage", "immersive"] as const;
export type ChatTheme = (typeof CHAT_THEMES)[number];
export const AUTO_SCROLLS = ["always", "smart", "never"] as const;
export type AutoScroll = (typeof AUTO_SCROLLS)[number];
export const EDGE_STYLES = ["single", "segmented"] as const;
export type EdgeStyle = (typeof EDGE_STYLES)[number];

/** RoleCall's message-fonts.ts:31-40, each with the face Bunraku bundles (src/ui/theme/fonts). "default" is the theme's own font. */
export const LOOK_FONTS = [
  { id: "default", label: "Sans (Default)", stack: undefined },
  { id: "dyslexic", label: "OpenDyslexic", stack: '"OpenDyslexic", sans-serif', note: "Dyslexia-friendly" },
  { id: "lexend", label: "Lexend", stack: '"Lexend", sans-serif', note: "Easy reading" },
  { id: "hyperlegible", label: "Atkinson Hyperlegible", stack: '"Atkinson Hyperlegible", sans-serif', note: "High legibility" },
  { id: "serif", label: "Serif", stack: '"Crimson Pro", Georgia, serif' },
  { id: "editorial", label: "Editorial", stack: '"Playfair Display", Georgia, serif' },
  { id: "mono", label: "Monospace", stack: '"JetBrains Mono", "IBM Plex Mono", monospace' },
] as const;
export type FontId = (typeof LOOK_FONTS)[number]["id"];

/** [min, max, step] of each slider (StageSettingsPanel.tsx; the Phone-size and Max-height sliders are not ported). */
export const LIMITS = { size: [10, 24, 1], lineHeight: [1, 2.5, 0.1], opacity: [0, 2, 0.05], gap: [0, 48, 4] } as const;

export interface StageLook {
  chatTheme: ChatTheme; opacity: number; gap: number; avatars: boolean;
  size: number; font: FontId; colorChar: string | null; colorUser: string | null; colorDialogue: string | null; lineHeight: number;
  autoScroll: AutoScroll; typing: boolean; fadeIn: boolean; chime: boolean;
  compact: boolean; collapse: boolean; collapseStyle: EdgeStyle; labels: boolean;
}

/** The one default source. `size` and `lineHeight` are RoleCall's 16px and 1.6. */
export const LOOK_DEFAULTS: StageLook = {
  chatTheme: "stage", opacity: 1, gap: 0, avatars: true, size: 16, font: "default", colorChar: null, colorUser: null, colorDialogue: null, lineHeight: 1.6,
  autoScroll: "smart", typing: true, fadeIn: true, chime: false, compact: false, collapse: false, collapseStyle: "single", labels: true,
};

const pick = <T extends string>(all: readonly T[], v: unknown, fallback: T): T => all.find((a) => a === v) ?? fallback;
const ranged = ([min, max]: readonly [number, number, number], v: unknown, fallback: number): number => (typeof v === "number" && v >= min && v <= max ? v : fallback);
const color = (v: unknown): string | null => (typeof v === "string" ? normalizeHex(v) : null);

/** Every setting, resolved: an unset, null or malformed pref reads as its default. */
export function readLook(prefs: { get(key: string): unknown }): StageLook {
  const g = (k: keyof typeof LOOK_KEYS): unknown => prefs.get(LOOK_KEYS[k]);
  const d = LOOK_DEFAULTS;
  return {
    chatTheme: pick(CHAT_THEMES, g("chatTheme"), d.chatTheme), opacity: ranged(LIMITS.opacity, g("opacity"), d.opacity), gap: ranged(LIMITS.gap, g("gap"), d.gap), avatars: boolOr(g("avatars"), d.avatars),
    size: ranged(LIMITS.size, g("size"), d.size), font: pick(LOOK_FONTS.map((f) => f.id), g("font"), d.font), colorChar: color(g("colorChar")), colorUser: color(g("colorUser")), colorDialogue: color(g("colorDialogue")),
    lineHeight: ranged(LIMITS.lineHeight, g("lineHeight"), d.lineHeight),
    autoScroll: pick(AUTO_SCROLLS, g("autoScroll"), d.autoScroll), typing: boolOr(g("typing"), d.typing), fadeIn: boolOr(g("fadeIn"), d.fadeIn), chime: boolOr(g("chime"), d.chime),
    compact: boolOr(g("compact"), d.compact), collapse: boolOr(g("collapse"), d.collapse), collapseStyle: pick(EDGE_STYLES, g("collapseStyle"), d.collapseStyle), labels: boolOr(g("labels"), d.labels),
  };
}

/** RoleCall's immersive line height (message-layouts.css:207): the Immersive theme reads looser until a height is chosen. */
const IMMERSIVE_LINE_HEIGHT = 1.85;

/**
 * What the look paints on the scene root: variables for the values that differ from the default, and `data-look` flags the
 * stylesheet (stage-style.ts) reads. Immersive is its own theme flag. At the defaults nothing is painted, so a theme's own
 * variant shows until the person chooses.
 */
export function lookRoot(look: StageLook): { style: CSSProperties | undefined; attrs: { "data-chat-theme": ChatTheme; "data-look": string } } {
  const d = LOOK_DEFAULTS;
  const style: Record<string, string> = {};
  const flags: string[] = [];
  const set = (name: string, vars: Record<string, string>): void => { flags.push(name); Object.assign(style, vars); };
  if (look.size !== d.size) set("size", { "--bk-msg-size": `${look.size}px` });
  if (look.lineHeight !== d.lineHeight) set("lh", { "--bk-msg-lh": String(look.lineHeight) });
  else if (look.chatTheme === "immersive") set("lh", { "--bk-msg-lh": String(IMMERSIVE_LINE_HEIGHT) });
  const stack = LOOK_FONTS.find((f) => f.id === look.font)?.stack;
  if (stack) set("font", { "--bk-msg-font": stack });
  if (look.opacity !== d.opacity) set("opacity", { "--bk-msg-opacity": String(look.opacity) });
  if (look.gap !== d.gap) set("gap", { "--bk-msg-gap": `${look.gap}px` });
  if (look.colorChar) set("color", { "--bk-msg-color": look.colorChar });
  if (look.colorUser) set("color-user", { "--bk-msg-color-user": look.colorUser });
  if (look.colorDialogue) set("dialogue", { "--bk-msg-dialogue": look.colorDialogue });
  if (!look.avatars) flags.push("noavatar");
  if (look.compact) flags.push("compact");
  if (look.collapse) flags.push("collapse");
  if (look.collapse && look.collapseStyle === "segmented") flags.push("segmented");
  if (!look.labels) flags.push("nolabels");
  if (!look.fadeIn) flags.push("nofade");
  return { style: Object.keys(style).length ? (style as CSSProperties) : undefined, attrs: { "data-chat-theme": look.chatTheme, "data-look": flags.join(" ") } };
}

/** Whether the scroller follows a change: Always every one, Smart a reader still at the bottom, Never only a scene opening (RoleCall page.tsx:2221-2307). */
export const autoScrolls = (mode: AutoScroll, following: boolean, opened: boolean): boolean => mode === "always" || (mode === "smart" ? following : opened);

/** RoleCall chimes when a generation finishes while the tab is not in front (page.tsx:1556). */
export const chimeDue = (wasBusy: boolean, busy: boolean, away: boolean, enabled: boolean): boolean => enabled && wasBusy && !busy && away;

export const ACTS = ["message", "type", "stage", "motion", "chrome"] as const;
export type ActId = (typeof ACTS)[number];
/** The acts the person folded; RoleCall starts all five open (StageSettingsPanel.tsx:1472). */
export const closedActs = (pref: unknown): ReadonlySet<ActId> => new Set(Array.isArray(pref) ? ACTS.filter((a) => pref.includes(a)) : []);
/** The closed list after a click on `act`. */
export const toggleAct = (closed: ReadonlySet<ActId>, act: ActId): ActId[] => ACTS.filter((a) => (a === act ? !closed.has(a) : closed.has(a)));

const SCROLL_WORDS: Record<AutoScroll, string> = { always: "Always scroll", smart: "Smart scroll", never: "Never scroll" };
/** What a closed act says (StageSettingsPanel.tsx:1485-1534). The Message and Stage acts name the theme's variants and the backdrop, which the caller knows. */
export function actStatus(act: "type" | "motion" | "chrome", look: StageLook): string {
  if (act === "type") return `${look.size}px · ${LOOK_FONTS.find((f) => f.id === look.font)!.label}`;
  if (act === "motion") return SCROLL_WORDS[look.autoScroll];
  return look.collapse ? "Wings collapsed" : "Wings pinned";
}
