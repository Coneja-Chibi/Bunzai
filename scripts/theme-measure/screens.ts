/**
 * Every reachable screen and major state of the app, as data: an id, the weight group it belongs to, the steps that
 * reach it from a fresh page on the seeded throwaway studio, and text that must be on screen when it was reached.
 * Steps use Playwright selectors, so they are written to survive all four themes (no dock clicks: apps open by hash).
 * An app with no row here is not measured, so a new app or editor belongs in this list.
 */
import type { Group } from "./metric.ts";

export type Step =
  | { go: string; settle?: number }
  | { click: string; settle?: number; optional?: boolean }
  | { fill: [selector: string, text: string] }
  | { key: string }
  | { wait: number }
  | { upload: [clickSelector: string, name: string, text: string] }
  | { eval: string }
  | { api: [method: string, path: string, body?: unknown] }
  | { mock: [path: string, json: unknown] }
  | { clearSession: true }
  | { park: true }
  | { tour: true };

export interface Screen { id: string; app: string; group: Group; steps: Step[]; expect: string }

/** Protected host UI (lock, recovery words, load-in): a theme cannot restyle it, so the measure lists it and does not score it. */
export const isProtected = (s: Screen): boolean => s.id.startsWith("gate.");
export const PROTECTED_NOTE = "protected by design: host UI no theme can restyle, so it is not scored";

const sc = (id: string, app: string, group: Group, expect: string, ...steps: Step[]): Screen => ({ id, app, group, expect, steps });
const btn = (name: string) => `role=button[name=/${name}/i]`;
const label = (name: string) => `button[aria-label="${name}"]`;
const IN_SCENE = 'css:textarea[aria-label="Message"]';
const OPEN_SCENE: Step[] = [{ go: "#scenes" }, { click: "text=Continue Your Story", settle: 2500 }, { tour: true }, { park: true }];
const wing = (id: string, name: string) => sc(`scene.wing.${id}`, "scenes", "scene", IN_SCENE, ...OPEN_SCENE, { click: label(name), settle: 1200 }, { park: true });
const EDIT_FIELD = '[data-editor="frame"] :is(input:not([type]),input[type=text],textarea) >> visible=true >> nth=0';
const BENCH: Step = { go: "#workbench" };
const piece = (id: string, name: string, expect: string, ...more: Step[]) =>
  sc(`editor.${id}`, "workbench", "editor", expect, BENCH, { click: btn(name), settle: 3500 }, { tour: true }, ...more);
const LIB: Step = { go: "#library", settle: 4500 };
/** A small SillyTavern card: dropping it on the library opens the import sheet. */
const CARD = JSON.stringify({ spec: "chara_card_v2", spec_version: "2.0", data: { name: "Imported Guest", description: "A guest from another app.", first_mes: "Hello." } });
const SCENES: Step = { go: "#scenes", settle: 3000 };
const gate = (phase: Record<string, unknown>): Step => ({ mock: ["/api/library/status", phase] });
const settingsTab = (id: string, expect: string) => sc(`settings.${id}`, "settings", "settings", expect, { go: `#settings/${id}` });

export const SCREENS: Screen[] = [
  // shell: the title, first-run setup, lock and load-in gates, dialogs
  sc("shell.title", "shell", "other", "bunraku", { clearSession: true }, { go: "/?forceTitle=1", settle: 4500 }),
  sc("setup.theme", "shell", "other", "Choose your theme", { api: ["PATCH", "/api/settings", { setupComplete: false }] }, { go: "/" }),
  sc("setup.makes", "shell", "other", "What do you want to make", { api: ["PATCH", "/api/settings", { setupComplete: false }] }, { go: "/" }, { click: btn("^next") }),
  sc("setup.publish", "shell", "other", "Where do you publish", { api: ["PATCH", "/api/settings", { setupComplete: false }] }, { go: "/" }, { click: btn("^next") }, { click: btn("^next") }),
  sc("setup.accent", "shell", "other", "Pick your color", { api: ["PATCH", "/api/settings", { setupComplete: false }] }, { go: "/" }, { click: btn("^next") }, { click: btn("^next") }, { click: btn("^next") }),
  sc("gate.locked", "shell", "other", "Speak the password", gate({ phase: "locked", hasPassword: true, hasWords: true }), { go: "/" }),
  sc("gate.lines", "shell", "other", "Recite your", gate({ phase: "locked", hasPassword: true, hasWords: true }), { go: "/" }, { click: "text=I forgot it" }),
  sc("gate.loadin", "shell", "other", "Load-in", gate({ phase: "loading-in", done: 12, total: 40, recent: ["characters/marguerite.json", "lorebooks/atlas.json", "presets/house.json"] }), { go: "/" }),
  sc("gate.allaboard", "shell", "other", "pieces carried in", gate({ phase: "unlocked", copied: { files: 8, renamed: [], leftInFolder: 3 } }), { clearSession: true }, { go: "/" }),
  sc("gate.failed", "shell", "other", "did not answer", gate({ phase: "failed", reason: "the studio server did not answer" }), { go: "/" }),
  sc("dialog.rename", "library", "other", "Rename", LIB, { click: label("More for Chi") }, { click: "role=menuitem[name=/^rename/i]" }),
  sc("dialog.delete", "library", "other", "Delete", LIB, { click: label("More for Chi") }, { click: "role=menuitem[name=/^delete/i]" }),
  sc("dialog.close-piece", "workbench", "other", "unsaved changes", BENCH, { click: btn("Chi"), settle: 3000 }, { tour: true }, { fill: [EDIT_FIELD, "Chi Two"] }, { eval: "document.querySelector('#tabstrip button.tab')?.focus()" }, { key: "Delete" }),
  sc("dialog.follow", "library", "other", "Follow", LIB, { click: btn("^Marguerite Vane$") }, { click: btn("send (it|all)") }),

  // scene play: the reading page, every wing, streaming, and the editing states of a message
  sc("scene.play", "scenes", "scene", IN_SCENE, ...OPEN_SCENE),
  wing("cast", "Cast"),
  wing("prompting", "Prompting"),
  wing("world", "World"),
  wing("props", "Props"),
  wing("ai", "AI"),
  wing("stage", "Stage"),
  wing("context", "Context"),
  sc("scene.booth", "scenes", "scene", IN_SCENE, ...OPEN_SCENE, { click: label("Control Booth"), settle: 1200 }, { park: true }),
  sc("scene.streaming", "scenes", "scene", IN_SCENE, ...OPEN_SCENE, { fill: ['textarea[aria-label="Message"]', "Tell me slow, please."] }, { key: "Enter" }, { park: true }, { wait: 4200 }),
  sc("scene.edit", "scenes", "scene", "Save|Cancel", ...OPEN_SCENE, { click: "role=button[name=/^Edit$/] >> nth=-1", settle: 1200 }),
  sc("scene.msg-menu", "scenes", "scene", IN_SCENE, ...OPEN_SCENE, { click: label("More message actions") + " >> nth=-1", settle: 900 }),

  // scenes list
  sc("scenes.list", "scenes", "scenes-list", "Continue", SCENES),
  sc("scenes.list-view", "scenes", "scenes-list", "Marguerite", SCENES, { click: btn("list$") }),
  sc("scenes.select", "scenes", "scenes-list", "Marguerite", SCENES, { click: btn("^select$") }),
  sc("scenes.trash", "scenes", "scenes-list", "Trash", SCENES, { click: btn("^trash$") }),
  sc("scenes.search", "scenes", "scenes-list", "Marguerite", SCENES, { fill: ['input[placeholder*="earch"]', "lamp"] }),
  sc("scenes.messages", "scenes", "scenes-list", "Marguerite", SCENES, { click: btn("^messages$") }),

  // library
  sc("library.carousel", "library", "library", "Your Collection", LIB),
  sc("library.grid", "library", "library", "Your Collection", LIB, { click: btn("grid$") }),
  sc("library.list", "library", "library", "Marguerite", LIB, { click: btn("list$") }),
  sc("library.tiles", "library", "library", "Marguerite", LIB, { click: btn("^tiles$") }),
  sc("library.shelf", "library", "library", "Marguerite", LIB, { click: btn("^shelf$") }),
  sc("library.select", "library", "library", "Marguerite", LIB, { click: btn("^select all$") }),
  sc("library.trash", "library", "library", "Trash", LIB, { click: btn("^trash") }),
  sc("library.import", "library", "library", "what we read", LIB, { upload: [btn("^import$"), "card.json", CARD] }),
  sc("library.menu", "library", "library", "Rename", LIB, { click: label("More for Chi") }),
  sc("library.search", "library", "library", "Marguerite", LIB, { fill: ['input[placeholder*="kind:"]', "mar"] }),

  // editors: one per piece kind, plus the tabs and benches that change the page
  sc("editor.empty", "workbench", "editor", "workbench is empty", BENCH),
  piece("character", "Marguerite Vane", "Marguerite"),
  piece("persona", "Chi", "Chi"),
  piece("pack", "Marguerite Faces", "Faces"),
  piece("htmldoc", "Lamp Room Sketch", "Sketch"),
  piece("preset", "House Style", "House Style"),
  piece("preset.settings", "House Style", "Temperature|Settings", { click: "role=tab[name=/settings/i]", optional: true }),
  piece("lorebook", "Lighthouse Atlas", "Atlas"),
  piece("lorebook.contents", "Lighthouse Atlas", "Atlas", { click: "role=tab[name=/contents/i]", optional: true }),
  piece("regex", "Prose Cleanup", "Cleanup"),
  piece("regex.bench", "Prose Cleanup", "Cleanup", { click: btn("open the full test bench") }),
  piece("quickreply", "Scene Commands", "Commands"),

  // settings: every section
  settingsTab("appearance", "Appearance|Theme"),
  settingsTab("models", "Model|Provider"),
  settingsTab("connections", "Connection|MCP"),
  settingsTab("studio", "Studio"),
  settingsTab("security", "Security|Password"),
  settingsTab("workbench", "Workbench"),
  settingsTab("remote-access", "Remote access"),
  settingsTab("updates", "Update"),
  settingsTab("about", "About|Bunraku"),

  // the other apps
  sc("press.home", "press", "other", "run the press", { go: "#press" }),
  sc("press.staged", "press", "other", "Marguerite", { go: "#press" }, { click: btn("Marguerite Vane") }),
  sc("agent.room", "agent", "other", "The Agent", { go: "#agent" }),
  sc("app-catalog.grid", "app-catalog", "other", "Official Bunraku apps", { go: "#app-catalog" }),
  sc("docs.home", "docs", "other", "User Docs", { go: "#docs" }),
  sc("docs.page", "docs", "other", "short version", { go: "#docs" }, { click: btn("Troubleshoot common problems") }),
  sc("docs.dev", "docs", "other", "Developer", { go: "#docs" }, { click: btn("Developer Docs") }),
  sc("css-workshop.simple", "css-workshop", "other", "CSS Workshop", { go: "#css-workshop" }),
  sc("css-workshop.advanced", "css-workshop", "other", "CSS Workshop", { go: "#css-workshop" }, { click: "role=button[name=/^Advanced$/] >> nth=0" }),
  sc("macro-lab.reading", "macro-lab", "other", "MACRO LAB", { go: "#macro-lab" }),
  sc("macro-lab.bible", "macro-lab", "other", "MACRO LAB", { go: "#macro-lab" }, { click: "text=Macro bible >> nth=0" }),
  sc("macro-lab.ops", "macro-lab", "other", "MACRO LAB", { go: "#macro-lab" }, { click: "text=Operations >> nth=0" }),
  sc("html-view.empty", "html-view", "other", "Nothing to draw", { go: "#html-view" }),
];
// company is declared coming soon and mounts as html-view, so it has no row of its own.
