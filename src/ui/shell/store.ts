/** Own serializable shell state and actions; app-contract selectors and App.tsx adapt this store. */
import { create } from "zustand";
import { isRecord } from "../../core/guards";
import type { MenuItem, MenuTarget, OpenMenu } from "./menus";
import { DEFAULT_STUDIO_THEME, nextStudioTheme, parseSettings, SETTING_KEYS, type StudioSettings, type StudioTheme } from "../../studio/settings-shape";
import { decideFollow } from "../follow-core";
import type { AppManifestEntry, StudioEntitySummary } from "../app-contract";
import { apiFetchJson } from "../_shared/api-fetch";
import { toErrorMessage } from "../_shared/error-message";
import { CORE_THEME_APPEARANCE, initialTheme, paintTheme } from "./theme";
import type { EffectiveThemeAppearance } from "../../extensions/theme-contract";
import { createAppearanceRequests } from "./appearance-requests";
import { createSettingsRequestQueue } from "./settings-request-queue";
import { isBrowserStudio } from "../_shared/asset-url";
import {
  besideKeys,
  focusKeys,
  keyOf,
  paneKeyOf,
  parseRecents,
  recentsPatch,
  removePieceState,
  stagePressBatch,
  unstagePressPiece,
} from "./store-core";
import { createBootStatusSlice, type BootStatusSlice } from "./store-boot-status";
import { createDevUpdateSlice, type DevUpdateSlice } from "./store-dev-update";
import { createNavigationSlice, presentedAppId, presentedPanes, type NavigationSlice } from "./store-navigation";
export { nextStudioCountRequest } from "./store-boot-status";

export type Theme = StudioTheme;

const RECENTS_CAP = 60;
let settingsMutationVersion = 0;
const settingsRequests = createSettingsRequestQueue();
const appearanceRequests = createAppearanceRequests(settingsRequests.wait, () => apiFetchJson<unknown>("/api/themes/effective"), isBrowserStudio());
export {
  menus,
  findMenuTarget,
  menuSectionsFor,
  useContextMenu,
} from "./menus";
export type { ContextMenus, MenuItem, MenuProvider, MenuTarget, OpenMenu } from "./menus";

export interface FollowPrompt {
  count: number;
  /** pane key of the newest sent piece; YES focuses it (a follow that lands on the OLD tab lies) */
  followKey: string;
}

interface ShellState extends BootStatusSlice, DevUpdateSlice, NavigationSlice {
  settings: StudioSettings;
  /** Verified host resolver output; null package means only the neutral core appearance is active. */
  appearance: EffectiveThemeAppearance;
  appearanceAssetUrls: Record<string, string>;
  theme: Theme;
  manifests: AppManifestEntry[];
  openPieces: StudioEntitySummary[];
  activeKey: string;
  /** a second piece pinned beside the active one ("" = single pane); NEVER equals activeKey */
  splitKey: string;
  statusNote: string;
  dockSlim: boolean;
  followPrompt: FollowPrompt | null;
  pendingClose: StudioEntitySummary | null;
  openMenu: OpenMenu | null;
  /** "kind:id" -> has unsaved edits; the shell tab wears the dot (the ONE dirty indicator) */
  dirtyPieces: Record<string, boolean>;
  /** the Press's staged queue (the staging grammar: pieces arrive from the Library, the room only
   * works this set). Survives app switches like openPieces; in-memory, not persisted. */
  pressQueue: StudioEntitySummary[];

  applySettings(next: StudioSettings): void;
  invalidateAppearance(): void;
  refreshAppearance(): Promise<void>;
  saveSettings(next: StudioSettings): Promise<void>;
  patchSettings(patch: Record<string, unknown>): void;
  /** Put a remembered bench back in ONE write (use-workspace.ts). */
  restoreBench(b: { pieces: StudioEntitySummary[]; activeKey: string; splitKey: string }): void;
  toggleTheme(): void;
  toggleDockSlim(): void;

  setManifests(manifests: AppManifestEntry[]): void;
  homeApp(): AppManifestEntry | undefined;
  benchApp(): AppManifestEntry | undefined;
  firstLandingApp(): AppManifestEntry | undefined;
  goHome(): void;

  // -- status bar -----------------------------------------------------------------------------------
  setStatus(text: string): void;
  // bootListFailed/studioCount/restoringWorkspace's setters come from BootStatusSlice above.

  // -- the Workbench's open pieces ------------------------------------------------------------------
  isOpen(id: string, kind: string): boolean;
  activePiece(): StudioEntitySummary | null;
  /** the piece pinned beside the active one, or null when the stage is a single pane */
  besidePiece(): StudioEntitySummary | null;
  sendMany(pieces: StudioEntitySummary[]): void;
  /** open a piece AND land on it, no follow prompt (create/"open" flows: the click IS the steering,
   * the openBeside precedent). Idempotent: an already-open piece is focused, never duplicated. */
  openPiece(piece: StudioEntitySummary): void;
  /** open a piece in the second pane, beside whatever is active (opens it first if needed) */
  openBeside(piece: StudioEntitySummary): void;
  /** collapse back to a single pane (the pinned piece stays open as a tab) */
  closeSplit(): void;

  // -- the Press's staged queue ---------------------------------------------------------------------
  stageForPress(batch: StudioEntitySummary[]): void;
  unstagePress(id: string, kind: string): void;
  clearPress(): void;
  requestPieceClose(id: string, kind: string, focusEntry?: string): void;
  answerPieceClose(discard: boolean): void;
  removePiece(id: string, kind: string, focusEntry?: string): void;
  focusPiece(id: string, kind: string, focusEntry?: string): void;
  setPieceDirty(id: string, kind: string, dirty: boolean): void;
  answerFollow(follow: boolean, remember: boolean): void;

  // -- context menu ---------------------------------------------------------------------------------
  /** the caller (Menu.tsx) already resolved the target and its non-empty sections */
  showMenu(x: number, y: number, target: MenuTarget, sections: MenuItem[][]): void;
  closeMenu(): void;
}

export const useShellStore = create<ShellState>((set, get, api) => ({
  ...createBootStatusSlice(set, get, api),
  ...createDevUpdateSlice(set, get, api),
  ...createNavigationSlice(set, get, api),
  settings: parseSettings(null),
  // guarded: this initializer runs at module eval, which also happens in DOM-less contexts (the
  // desktop bake imports app modules to read manifests, the cache misses) - dark is the first-run default
  appearance: CORE_THEME_APPEARANCE,
  appearanceAssetUrls: {},
  theme: initialTheme(),
  manifests: [],
  openPieces: [],
  activeKey: "",
  splitKey: "",
  pressQueue: [],
  statusNote: "",
  dockSlim: false,
  followPrompt: null,
  pendingClose: null,
  openMenu: null,
  dirtyPieces: {},

  applySettings(next) {
    const theme = next.theme ?? DEFAULT_STUDIO_THEME;
    const changedTheme = theme !== get().theme;
    if (changedTheme) get().invalidateAppearance();
    else if (next.houseAccent !== get().settings.houseAccent) paintTheme(get().appearance, next.houseAccent, get().appearanceAssetUrls);
    set({ settings: next, theme, dockSlim: next[SETTING_KEYS.dockSlim] === true });
  },

  invalidateAppearance() {
    appearanceRequests.invalidate();
    set({ appearance: CORE_THEME_APPEARANCE, appearanceAssetUrls: {} });
    paintTheme(CORE_THEME_APPEARANCE);
  },

  async refreshAppearance() {
    await appearanceRequests.refresh((appearance, appearanceAssetUrls) => {
      set({ appearance, appearanceAssetUrls });
      paintTheme(appearance, get().settings.houseAccent, appearanceAssetUrls);
    });
  },

  async saveSettings(next) {
    const prior = get().settings;
    const version = ++settingsMutationVersion;
    try {
      get().applySettings(parseSettings(next));
      const saved = await settingsRequests.enqueue(() =>
        apiFetchJson<StudioSettings>("/api/settings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(next),
        }),
      );
      if (!isRecord(saved)) {
        throw new Error("settings save failed");
      }
      if (version === settingsMutationVersion) {
        get().applySettings(saved);
        if (appearanceRequests.needsVerification()) await get().refreshAppearance();
      }
    } catch (e) {
      if (version === settingsMutationVersion) {
        get().applySettings(prior);
        if (appearanceRequests.needsVerification()) await get().refreshAppearance();
      }
      const msg = toErrorMessage(e, "settings save failed");
      set({ statusNote: msg });
      throw e;
    }
  },

  // One write, not a loop of send() calls; use-workspace.ts records why.
  restoreBench(bench) {
    const panes = { activeKey: bench.activeKey, splitKey: bench.splitKey };
    const seedOverlay = get().overlayPanes && !get().overlayPanes?.activeKey && get().openPieces.length === 0;
    set({ openPieces: bench.pieces, ...panes, ...(seedOverlay ? { overlayPanes: panes } : {}) });
  },
  patchSettings(patch) {
    const version = ++settingsMutationVersion;
    get().applySettings(parseSettings({ ...get().settings, ...patch }));
    void settingsRequests.enqueue(() =>
      apiFetchJson<StudioSettings>("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      }),
    ).then(
      (saved) => {
        if (version === settingsMutationVersion) {
          get().applySettings(saved);
          if (appearanceRequests.needsVerification()) void get().refreshAppearance();
        }
      },
      (e: unknown) => {
        const msg = toErrorMessage(e, "settings save failed");
        set({ statusNote: msg });
        if (version !== settingsMutationVersion) return;
        void apiFetchJson<StudioSettings>("/api/settings").then(
          async (saved) => {
            get().applySettings(saved);
            if (appearanceRequests.needsVerification()) await get().refreshAppearance();
          },
          () => undefined,
        );
      },
    );
  },

  toggleTheme() {
    const next = nextStudioTheme(get().theme);
    get().patchSettings({ [SETTING_KEYS.theme]: next });
  },

  toggleDockSlim() {
    const slim = !get().dockSlim;
    get().patchSettings({ [SETTING_KEYS.dockSlim]: slim });
  },

  setManifests(manifests) {
    set({ manifests });
  },

  homeApp() {
    const { manifests, settings } = get();
    const chosen = settings[SETTING_KEYS.homeApp];
    return (
      manifests.find((m) => m.id === chosen && !m.comingSoon && !m.dockFoot && !m.catalogOnly) ??
      manifests.find((m) => !m.comingSoon && !m.dockFoot && !m.catalogOnly)
    );
  },

  benchApp() {
    return get().manifests.find((m) => m.editsPieces && !m.comingSoon);
  },

  firstLandingApp() {
    return get().manifests.find((m) => m.firstRunLanding && !m.comingSoon);
  },

  goHome() {
    const home = get().homeApp();
    if (home) get().mountApp(home.id);
  },

  setStatus(text) {
    if (get().statusNote === text) return; // idempotent: same-value writes no-op, so any
    set({ statusNote: text });             // effect-echo loop settles in one pass instead of spinning
  },

  isOpen(id, kind) {
    return get().openPieces.some((p) => p.id === id && p.kind === kind);
  },

  activePiece() {
    const { openPieces } = get(); const { activeKey } = presentedPanes(get());
    return openPieces.find((p) => paneKeyOf(p) === activeKey) ?? null;
  },

  besidePiece() {
    const { openPieces } = get(); const { splitKey } = presentedPanes(get());
    if (!splitKey) return null;
    return openPieces.find((p) => paneKeyOf(p) === splitKey) ?? null;
  },

  sendMany(batch) {
    const { openPieces, settings } = get(); const activeAppId = presentedAppId(get());
    const fresh = batch.filter((p) => !get().isOpen(p.id, p.kind));
    if (fresh.length === 0) {
      const only = batch[0];
      set({
        statusNote: only && batch.length === 1 ? `${only.name} is already on the Workbench` : "already on the Workbench",
      });
      return;
    }

    const onWorkbench = activeAppId !== "" && activeAppId === get().benchApp()?.id;
    const freshKeys = fresh.map((p) => keyOf(p.id, p.kind));
    get().patchSettings(
      recentsPatch(settings[SETTING_KEYS.workbenchRecents], SETTING_KEYS.workbenchRecents, freshKeys, Date.now(), RECENTS_CAP),
    );

    const last = fresh[fresh.length - 1]!;
    const action = decideFollow(onWorkbench, settings[SETTING_KEYS.workbenchFollow]);
    const nextOpenPieces = [...openPieces, ...fresh];
    // surface/navigate land the view on the newest piece; note/ask keep the current active piece
    const nextActiveKey =
      action === "surface" || action === "navigate"
        ? paneKeyOf(last)
        : presentedPanes(get()).activeKey || paneKeyOf(fresh[0]!);
    set({ openPieces: nextOpenPieces });
    get().selectPanes({ activeKey: nextActiveKey });

    if (action === "navigate") {
      const bench = get().benchApp();
      if (bench) get().mountApp(bench.id);
    } else if (action === "note") {
      set({
        statusNote:
          fresh.length === 1 ? `${fresh[0]!.name} sent to the Workbench` : `${fresh.length} pieces sent to the Workbench`,
      });
    } else if (action === "ask") {
      set({ followPrompt: { count: fresh.length, followKey: paneKeyOf(last) } });
    }
  },

  openPiece(piece) {
    const { settings } = get();
    if (!get().isOpen(piece.id, piece.kind)) {
      get().patchSettings(
        recentsPatch(settings[SETTING_KEYS.workbenchRecents], SETTING_KEYS.workbenchRecents, [keyOf(piece.id, piece.kind)], Date.now(), RECENTS_CAP),
      );
      set({ openPieces: [...get().openPieces, piece] });
    }
    get().selectPanes({ activeKey: paneKeyOf(piece) });
    const bench = get().benchApp();
    if (bench) get().mountApp(bench.id);
  },

  setPieceDirty(id, kind, dirty) {
    const key = keyOf(id, kind);
    const cur = get().dirtyPieces;
    if ((cur[key] === true) === dirty) return; // idempotent (the loop-killing store rule)
    const next = { ...cur };
    if (dirty) next[key] = true;
    else delete next[key];
    set({ dirtyPieces: next });
  },

  openBeside(piece) {
    const { settings, openPieces } = get(); const { activeKey, splitKey } = presentedPanes(get());
    const key = paneKeyOf(piece);
    // Pane identity includes focusEntry so the same lorebook can sit beside itself.
    const already = openPieces.some((p) => paneKeyOf(p) === key);
    if (!already) {
      // an explicit "open beside" skips the follow prompt: the user is already steering the bench
      set({ openPieces: [...get().openPieces, piece] });
      get().patchSettings(
        recentsPatch(settings[SETTING_KEYS.workbenchRecents], SETTING_KEYS.workbenchRecents, [keyOf(piece.id, piece.kind)], Date.now(), RECENTS_CAP),
      );
    }
    get().selectPanes(besideKeys({ activeKey, splitKey }, key));
    const bench = get().benchApp();
    if (bench) get().mountApp(bench.id);
  },

  closeSplit() {
    if (presentedPanes(get()).splitKey) get().selectPanes({ splitKey: "" });
  },

  removePiece(id, kind, focusEntry) {
    const next = removePieceState({ ...get(), id, kind, focusEntry });
    const overlay = get().overlayPanes;
    const overlayNext = overlay && removePieceState({ ...get(), ...overlay, id, kind, focusEntry });
    if (next) set({ ...next, ...(overlayNext ? { overlayPanes: { activeKey: overlayNext.activeKey, splitKey: overlayNext.splitKey } } : {}) });
  },

  requestPieceClose(id, kind, focusEntry) {
    const { openPieces, dirtyPieces } = get();
    const want = paneKeyOf({ id, kind, params: focusEntry ? { focusEntry } : undefined });
    const piece =
      openPieces.find((candidate) => paneKeyOf(candidate) === want) ??
      openPieces.find((candidate) => candidate.id === id && candidate.kind === kind);
    if (!piece) return;
    if (dirtyPieces[keyOf(id, kind)] === true) {
      set({ pendingClose: piece });
      return;
    }
    get().removePiece(id, kind, piece.params?.focusEntry);
  },

  answerPieceClose(discard) {
    const pending = get().pendingClose;
    if (!pending) return;
    set({ pendingClose: null });
    if (discard) get().removePiece(pending.id, pending.kind, pending.params?.focusEntry);
  },

  focusPiece(id, kind, focusEntry) {
    const { openPieces, settings } = get(); const { activeKey, splitKey } = presentedPanes(get());
    const want = paneKeyOf({ id, kind, params: focusEntry ? { focusEntry } : undefined });
    const hit =
      openPieces.find((p) => paneKeyOf(p) === want) ??
      openPieces.find((p) => p.id === id && p.kind === kind);
    if (!hit) return;
    const key = paneKeyOf(hit);
    get().patchSettings(
      recentsPatch(settings[SETTING_KEYS.workbenchRecents], SETTING_KEYS.workbenchRecents, [keyOf(id, kind)], Date.now(), RECENTS_CAP),
    );
    get().selectPanes(focusKeys({ activeKey, splitKey }, key));
    const bench = get().benchApp();
    if (bench) get().mountApp(bench.id);
  },

  stageForPress(batch) {
    const before = get().pressQueue;
    const next = stagePressBatch(before, batch);
    if (next.length === before.length) {
      set({ statusNote: batch.length === 1 ? `${batch[0]!.name} is already staged for the Press` : "already staged for the Press" });
      return;
    }
    set({ pressQueue: next, statusNote: `staged for the Press · ${next.length} in the queue` });
  },

  unstagePress(id, kind) {
    set({ pressQueue: unstagePressPiece(get().pressQueue, id, kind) });
  },

  clearPress() {
    set({ pressQueue: [] });
  },

  answerFollow(follow, remember) {
    const prompt = get().followPrompt;
    set({ followPrompt: null });
    if (remember) {
      get().patchSettings({ [SETTING_KEYS.workbenchFollow]: follow ? "always" : "never" });
    }
    if (follow) {
      if (prompt?.followKey) get().selectPanes({ activeKey: prompt.followKey });
      const bench = get().benchApp();
      if (bench) get().mountApp(bench.id);
    }
  },

  showMenu(x, y, target, sections) {
    set({ openMenu: { x, y, target, sections } });
  },

  closeMenu() {
    if (get().openMenu) set({ openMenu: null });
  },
}));

/** Read the persisted recents map straight off current settings (the recents rail's data source). */
export function workbenchRecents(): Record<string, number> {
  return parseRecents(useShellStore.getState().settings[SETTING_KEYS.workbenchRecents]);
}

// -- write-storm tripwire ---------------------------------------------------------------------------
// A burst of store writes inside one task is ALWAYS a bug (a render-phase write or an effect echo
// loop). React's own failure mode is a frozen app with "Maximum update depth exceeded" pointing at
// its internals; this converts the storm into a loud, NAMED error at the write site instead. The
// idempotent-setter rule above prevents the common class; this catches whatever invents a new one.
const WRITE_STORM_LIMIT = 150;
let writesThisTask = 0;
let resetQueued = false;
useShellStore.subscribe(() => {
  writesThisTask++;
  if (!resetQueued) {
    resetQueued = true;
    setTimeout(() => {
      writesThisTask = 0;
      resetQueued = false;
    }, 0);
  }
  if (writesThisTask > WRITE_STORM_LIMIT) {
    writesThisTask = 0;
    throw new Error(
      "shell-store: write storm - more than 150 store writes in one task. Almost certainly a " +
        "render-phase store write or an effect that writes what it subscribes to. Check the stack.",
    );
  }
});
