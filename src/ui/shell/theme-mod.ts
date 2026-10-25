/**
 * Applies the checked styles and slots of the effective theme, and guards the protected layer while they are on.
 * One owner: the painter calls `paintMod` with every effective-theme change; nothing else writes the mod
 * `<style>` or the slot attribute. The CSS was proven by `checkThemeCss` at install and again in
 * `readEffectiveTheme`; here it is resolved (package urls, protected scope) and injected unlayered and last, so it can
 * override every ordinary host rule while the protected layer's `!important` rules still win.
 */
import { checkThemeCss, scopeThemeCss } from "../../extensions/theme-css";
import type { EffectiveThemeAppearance } from "../../extensions/theme-contract";
import { SLOT_IDS, type SlotId, type ThemeSlots } from "../../extensions/slot-registry";
import { modOffenses, type Probe, type StyleView } from "./protected-watchdog";
import { clearBaselineMotion, isBaselineAnimationStart, preserveCssMotion } from "./theme-mod-baseline";

export const MOD_STYLE_ID = "bk-mod-style";
export const SLOT_ATTRIBUTE = "data-theme-slots";
/** The cheap checks (path styles, size, hit points) run on this tick; they cost well under a millisecond. */
const CHECK_EVERY_MS = 500;
/**
 * The full element scan reads every element (about 100 ms on 7,500), so it has no timer. It runs once on mount and then
 * when the page changes: a DOM or attribute mutation, a resize, an animation or a transition ending. Changes are batched
 * for this long, and scans are spaced at least RESCAN_DUTY times the last scan's cost apart (a 10% duty cycle).
 */
const RESCAN_DEBOUNCE_MS = 250;
const RESCAN_DUTY = 10;
/** Set on the root: the factor that cancels whatever a mod did to html's size (tokens.css applies it as the protected zoom). */
export const TYPE_PIN_PROPERTY = "--host-type-zoom";
const HEALTHY_AFTER_MS = 15_000;

export interface ModBroken { themeId: string; digest: string; reasons: string[] }
export interface ModHandlers { broken(info: ModBroken): void; healthy(info: { themeId: string; digest: string }): void }

/** The root attribute value: slot items, the url of each image asset, and the class names the styles define. */
export function slotPayload(slots: ThemeSlots, assets: readonly { id: string; url: string }[], classes: Iterable<string>): string | null {
  if (!SLOT_IDS.some((id: SlotId) => (slots[id]?.length ?? 0) > 0)) return null;
  return JSON.stringify({ slots, assets: Object.fromEntries(assets.map((a) => [a.id, a.url])), classes: [...classes] });
}

const view = (s: CSSStyleDeclaration): StyleView => ({
  display: s.display, visibility: s.visibility, opacity: s.opacity, filter: s.filter, clipPath: s.clipPath, maskImage: s.maskImage || "none",
  mixBlendMode: s.mixBlendMode, pointerEvents: s.pointerEvents, position: s.position, content: s.content, width: s.width, height: s.height, fontSize: s.fontSize,
});
const domProbe = (): Probe => ({
  surfaces: () => [...document.querySelectorAll(".host-protected")],
  all: () => [...document.querySelectorAll("*")],
  parent: (el) => el.parentElement,
  contains: (outer, inner) => outer.contains(inner),
  style: (el, pseudo) => view(getComputedStyle(el, pseudo)),
  box: (el) => el.getBoundingClientRect(),
  visibleBox: (el) => {
    const own = el.getBoundingClientRect();
    let left = own.left, top = own.top, right = own.right, bottom = own.bottom;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.overflowX === "visible" && s.overflowY === "visible") continue;
      const r = p.getBoundingClientRect();
      left = Math.max(left, r.left); top = Math.max(top, r.top); right = Math.min(right, r.right); bottom = Math.min(bottom, r.bottom);
    }
    return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
  },
  hit: (x, y) => document.elementFromPoint(x, y),
  topLayer: (el) => { try { return el.closest(":modal, :popover-open") !== null; } catch { return false; } },
  viewport: () => ({ width: window.innerWidth, height: window.innerHeight }),
});

let handlers: ModHandlers | null = null;
let probe: Probe = domProbe();
let active: { themeId: string; digest: string } | null = null;
let suppressed: string | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let healthyTimer: ReturnType<typeof setTimeout> | null = null;
let observer: MutationObserver | null = null;
let rescanTimer: ReturnType<typeof setTimeout> | null = null;
let lastScanEnd = 0;
let lastScanMs = 0;
let unwatch: (() => void) | null = null;
/** The root font size and zoom of this page with the mod off: what protected text must keep. */
let baseRootPx = 16;

export const setModHandlers = (next: ModHandlers | null): void => { handlers = next; };
/** Test seam: swap the DOM probe (the unit DOM has no layout). */
export const setModProbe = (next: Probe | null): void => { probe = next ?? domProbe(); };

/** The one mod `<style>` this module owns; kept by reference so removing it never depends on a document query. */
let styleNode: HTMLStyleElement | null = null;

const rootPx = (): number => parseFloat(getComputedStyle(document.documentElement).fontSize) || baseRootPx;
const zoomOf = (el: Element): number => Number(getComputedStyle(el).zoom) || 1;

/**
 * Cancel a mod's scaling of html for protected surfaces: rem follows html's font size and zoom multiplies every length,
 * and neither can be taken out of the cascade, so the inverse is written on the root and tokens.css zooms each protected
 * surface by it. Ancestors of a protected surface other than html and body are not measured (the prompts portal to body).
 */
function pinProtectedType(): void {
  const factor = baseRootPx / rootPx() / (zoomOf(document.documentElement) * zoomOf(document.body));
  const root = document.documentElement.style;
  const next = Math.abs(factor - 1) < 0.001 ? "" : String(factor);
  if (root.getPropertyValue(TYPE_PIN_PROPERTY) === next) return; // an unchanged write would still wake the mutation watcher
  if (next === "") root.removeProperty(TYPE_PIN_PROPERTY); else root.setProperty(TYPE_PIN_PROPERTY, next);
}

/** Run one watchdog pass; on a mod-caused offense, drop the mod at once and report it. Returns whether the mod was dropped. */
export function checkProtectedNow(full = true): boolean {
  const el = styleNode;
  if (!el || !active) return false;
  pinProtectedType();
  const started = performance.now();
  let resume = (): void => {};
  const found = modOffenses(probe, (on) => {
    if (!on) resume = preserveCssMotion(document);
    el.disabled = !on;
    if (on) resume();
  }, full);
  // The check's own writes (the style toggle, the motion pins) are not page changes: drop them before the watcher wakes on them.
  observer?.takeRecords();
  if (full) { lastScanEnd = performance.now(); lastScanMs = lastScanEnd - started; }
  if (found.length === 0) return false;
  const info = { ...active, reasons: [...new Set(found.map((o) => o.kind))] };
  suppressed = info.digest;
  removeMod();
  handlers?.broken(info);
  return true;
}

function stopWatching(): void {
  if (timer) clearInterval(timer);
  if (healthyTimer) clearTimeout(healthyTimer);
  if (rescanTimer) clearTimeout(rescanTimer);
  timer = healthyTimer = rescanTimer = null;
  observer?.disconnect();
  observer = null;
  unwatch?.();
  unwatch = null;
}
function startWatching(): void {
  stopWatching();
  const mounted = (): boolean => document.querySelector(".host-protected") !== null;
  const rescan = (event?: Event): void => {
    if (event && isBaselineAnimationStart(event)) return;
    if (rescanTimer) return;
    const wait = Math.max(RESCAN_DEBOUNCE_MS, lastScanEnd + lastScanMs * RESCAN_DUTY - performance.now());
    rescanTimer = setTimeout(() => { rescanTimer = null; if (active && !document.hidden && mounted()) checkProtectedNow(true); }, wait);
  };
  timer = setInterval(() => { if (!document.hidden && mounted()) checkProtectedNow(false); }, CHECK_EVERY_MS); // interval-ok: only while a mod style is active, cheap checks only, and it does nothing in a hidden tab
  observer = new MutationObserver(() => rescan());
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden", "open"] });
  // CSS can change a page without touching the DOM: a resize flips a media query, an animation or a transition ends
  const events = ["resize", "animationstart", "animationend", "transitionend"] as const;
  for (const name of events) window.addEventListener(name, rescan, true);
  unwatch = () => { for (const name of events) window.removeEventListener(name, rescan, true); };
  const now = active;
  healthyTimer = setTimeout(() => { if (now && active === now) handlers?.healthy(now); }, HEALTHY_AFTER_MS);
}

/** Remove every mod effect: the style, the slot attribute and the watchers. */
export function removeMod(): void {
  clearBaselineMotion();
  styleNode?.remove();
  styleNode = null;
  document.documentElement.removeAttribute(SLOT_ATTRIBUTE);
  document.documentElement.style.removeProperty(TYPE_PIN_PROPERTY);
  stopWatching();
  active = null;
}

/** Make the document match the effective theme's styles and slots. `assetUrls` maps ids to blob URLs in static browser mode. */
export function paintMod(theme: EffectiveThemeAppearance, assetUrls: Record<string, string> = {}): void {
  if (theme.themeId === null || theme.digest === null || (theme.styles === null && Object.keys(theme.slots).length === 0) || theme.digest === suppressed) { removeMod(); return; }
  const urls = new Map([...theme.assets, ...theme.fonts].map((f) => [f.id, assetUrls[f.id] ?? f.url]));
  const classes = theme.styles === null ? new Set<string>() : checkThemeCss(theme.styles, { images: new Set(theme.assets.map((a) => a.id)), fonts: new Set(theme.fonts.map((f) => f.id)) }).classes;
  const payload = slotPayload(theme.slots, theme.assets.map((a) => ({ id: a.id, url: urls.get(a.id)! })), classes);
  const css = theme.styles === null ? null : scopeThemeCss(theme.styles, (id) => urls.get(id) ?? "about:blank");
  const root = document.documentElement;
  if (active?.themeId === theme.themeId && active.digest === theme.digest && (styleNode?.textContent ?? null) === css && root.getAttribute(SLOT_ATTRIBUTE) === payload && (!styleNode || styleNode.isConnected)) return;
  if (root.getAttribute(SLOT_ATTRIBUTE) !== payload) {
    if (payload === null) root.removeAttribute(SLOT_ATTRIBUTE); else root.setAttribute(SLOT_ATTRIBUTE, payload);
  }
  styleNode?.remove();
  styleNode = null;
  if (theme.styles !== null) {
    const style = document.createElement("style");
    style.id = MOD_STYLE_ID;
    style.textContent = css;
    document.head.append(style);
    styleNode = style;
    style.disabled = true;
    baseRootPx = rootPx();
    style.disabled = false;
  }
  active = { themeId: theme.themeId, digest: theme.digest };
  startWatching();
  if (theme.styles !== null) requestAnimationFrame(() => { checkProtectedNow(); }); // the mount scan
}

/** Forget a suppression (a new page load or a changed digest makes the theme eligible again). */
export const clearModSuppression = (): void => { suppressed = null; };
