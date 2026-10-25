/** Workspace and temporary overlay destinations share app implementations, never navigation state. */
import type { StateCreator } from "zustand";
import type { AppManifestEntry } from "../app-contract";
import { ACTIVE_APP_KEY } from "../_shared/window-memory";
import { webStorage } from "../_shared/web-storage";

interface Panes { activeKey: string; splitKey: string }
interface NavigationHost extends Panes { manifests: AppManifestEntry[]; statusNote: string }
export interface NavigationSlice {
  activeAppId: string;
  overlayOpen: boolean;
  overlayAppId: string;
  overlayPanes: Panes | null;
  navigationRevision: number;
  mountApp(id: string): void;
  openOverlay(): void;
  closeOverlay(): void;
  promoteOverlay(): void;
  selectPanes(panes: Partial<Panes>): void;
}
export const presentedAppId = (state: Pick<NavigationSlice, "activeAppId" | "overlayOpen" | "overlayAppId">): string =>
  state.overlayOpen ? state.overlayAppId : state.activeAppId;
export const presentedPanes = (state: Panes & Pick<NavigationSlice, "overlayOpen" | "overlayPanes">): Panes =>
  state.overlayOpen && state.overlayPanes ? state.overlayPanes : state;

function rememberApp(id: string): void {
  try { webStorage("session")?.setItem(ACTIVE_APP_KEY, id); } catch { /* unavailable storage leaves boot's normal fallback */ }
}

export const createNavigationSlice: StateCreator<NavigationHost & NavigationSlice, [], [], NavigationSlice> = (set, get) => ({
  activeAppId: "", overlayOpen: false, overlayAppId: "", overlayPanes: null, navigationRevision: 0,
  mountApp(id) {
    const state = get();
    if (!state.manifests.some((app) => app.id === id && !app.comingSoon) || id === presentedAppId(state)) return;
    if (state.overlayOpen) set({ overlayAppId: id, statusNote: "", navigationRevision: state.navigationRevision + 1 });
    else { set({ activeAppId: id, statusNote: "", navigationRevision: state.navigationRevision + 1 }); rememberApp(id); }
  },
  openOverlay() {
    const state = get();
    if (state.overlayOpen) return;
    const remembered = state.manifests.some((app) => app.id === state.overlayAppId && !app.comingSoon);
    set({ overlayOpen: true, navigationRevision: state.navigationRevision + 1, overlayAppId: remembered ? state.overlayAppId : state.activeAppId,
      overlayPanes: state.overlayPanes ?? { activeKey: state.activeKey, splitKey: state.splitKey } });
  },
  closeOverlay() { set({ overlayOpen: false }); },
  promoteOverlay() {
    const state = get();
    if (!state.overlayOpen) return;
    set({ overlayOpen: false, activeAppId: state.overlayAppId, ...state.overlayPanes });
    rememberApp(state.overlayAppId);
  },
  selectPanes(panes) {
    const state = get();
    set(state.overlayOpen ? { overlayPanes: { ...presentedPanes(state), ...panes } } : panes);
  },
});
