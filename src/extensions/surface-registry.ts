/**
 * The host's surface and variant ids: the one list a theme manifest is validated against. A variant is a
 * host-built component or style beside its surface (src/ui/<owner>/variants/<surface-id>/<variant>.tsx);
 * a theme only SELECTS one. surface-registry.test.ts fails when a variants folder names an id missing here.
 * Variant order is the four bundled identities: Theater, Encore, GirliePop, Paper.
 * A surface a theme leaves out, or a variant not built yet, renders as "core": the current rendering.
 */
export const SURFACES = {
  "shell.nav": ["playbill-rail", "hud-bar", "tab-bar", "index-rail"],
  "shell.overlay": ["gilt-widgets", "hud-widgets", "sticker-widgets", "ink-widgets"],
  "shell.title": ["proscenium", "attract", "sticker-splash", "title-page"],
  "shell.status": ["footer-line", "hud-strip", "chip", "margin-note"],
  "library.grid": ["covers", "inventory-slots", "sticker-wall", "catalog-list"],
  "library.card": ["playbill-cover", "item-card", "sticker-card", "index-card"],
  "scenes.list": ["marquee-hero", "save-file-slots", "chat-list", "table-of-contents"],
  "ui.dialog": ["curtain-card", "menu-window", "pop-card", "margin-sheet"],
  "ui.toast": ["program-slip", "hud-ticker", "bubble", "footnote"],
  "ui.empty": ["spotlight", "no-data-panel", "doodle", "blank-page"],
  "ui.panel": ["gilt-frame", "bracket-frame", "slab-frame", "ruled-frame"],
  "ui.meter": ["thin-rule", "segmented", "chunky-pill-bar", "ink-tally"],
  "ui.icons": ["engraved", "pixel-crisp", "filled-cute", "line-ink"],
  "ui.toolbar": ["playbill-bar", "hud-command-bar", "sticker-shelf", "margin-ruler"],
  "library.decks": ["program-list", "inventory-tabs", "sticker-stack", "chapter-index"],
  "ui.section-header": ["engraved-title", "slot-header", "banner-tag", "chapter-heading"],
  "ui.tabs": ["rule-tabs", "menu-cursor", "pill-row", "underline-ink"],
  "ui.label-type": ["small-caps-serif", "caps-mono", "rounded-sentence", "italic-serif"],
  "scene.layout": ["stage-column", "vn-stage", "chat-thread", "manuscript"],
  "scene.message": ["prose", "vn-box", "bubble", "screenplay"],
  "scene.composer": ["prompt-line", "command-box", "chat-input", "typewriter-line"],
  "scene.swipes": ["arrows-count", "key-chips", "dots", "margin-numbers"],
  "scene.wings": ["side-curtain", "pause-menu", "drawer", "marginalia"],
  "scene.hud": ["quiet-line", "full-hud", "chips", "footnotes"],
  "scene.reasoning": ["program-note", "slot-tab", "slab-note", "footnote"],
  "editor.frame": ["two-pane", "tabbed-menu", "card-stack", "long-form"],
  "editor.fields": ["labeled-rows", "stat-sheet", "cards", "form-on-paper"],
  "settings.shape": ["program-sections", "options-menu", "big-toggles", "contents-page"],
  "app.room": ["ledger-rail", "hud-console", "sticker-tray", "manuscript-column"],
  "ui.controls": ["quiet", "game", "sticker", "ink"],
} as const;

export type SurfaceId = keyof typeof SURFACES;
export type SurfaceVariants = { [S in SurfaceId]?: (typeof SURFACES)[S][number] };
/** What a surface renders when the theme names no variant for it, or names one the host has not built. */
export const CORE_VARIANT = "core";

export const isSurfaceId = (id: string): id is SurfaceId => Object.hasOwn(SURFACES, id);
export const isSurfaceVariant = (id: SurfaceId, variant: unknown): boolean => (SURFACES[id] as readonly unknown[]).includes(variant);
/** The attribute the painter sets for a surface, e.g. `data-surface-shell-nav`; CSS selects on it. */
export const surfaceAttribute = (id: SurfaceId): string => "data-surface-" + id.replace(".", "-");
