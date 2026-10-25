/**
 * useShellMenus - registers the shell-owned context-menu providers (entity/app/shell), identical in
 * every room. Extracted out of App.tsx (Scenes P4, the title screen) purely to keep the shell root
 * under the 500-line cap; the registration logic itself is unchanged, only which file it lives in.
 */
import { useEffect } from "react";
import type { AppManifestEntry, StudioEntitySummary } from "../app-contract";
import { requestImport } from "../_shared/import-signal";
import { seenTourKeys } from "../tours/tour-core";
import { menus, useShellStore } from "./store";
import { presentedPanes } from "./store-navigation";

export function useShellMenus(): void {
  useEffect(() => {
    const unregisterEntity = menus.register("entity", (t) => {
      const e = t.data as StudioEntitySummary;
      const wb = useShellStore.getState();
      const panes = presentedPanes(wb);
      const key = `${e.kind}:${e.id}`;
      if (wb.isOpen(e.id, e.kind)) {
        const items = [{ label: "Show on the Workbench", onPick: () => wb.focusPiece(e.id, e.kind) }];
        // the split slots: pin beside the active piece, or unpin if this IS the pinned piece
        if (key === panes.splitKey) {
          items.push({ label: "Close the split", onPick: () => wb.closeSplit() });
        } else if (panes.activeKey && key !== panes.activeKey) {
          items.push({ label: "Open beside", onPick: () => wb.openBeside(e) });
        }
        items.push({ label: "Stage for the Press", onPick: () => wb.stageForPress([e]) });
        items.push({ label: "Remove from the Workbench", onPick: () => wb.requestPieceClose(e.id, e.kind) });
        return items;
      }
      const items = [{ label: "Send to the Workbench", onPick: () => wb.sendMany([e]) }];
      if (panes.activeKey) items.push({ label: "Open beside", onPick: () => wb.openBeside(e) });
      items.push({ label: "Stage for the Press", onPick: () => wb.stageForPress([e]) });
      return items;
    });

    const unregisterApp = menus.register("app", (t) => {
      const m = t.data as AppManifestEntry;
      if (m.comingSoon) return [{ label: "Installs later", disabled: true, onPick: () => undefined }];
      return [{ label: `Open ${m.title}`, onPick: () => useShellStore.getState().mountApp(m.id) }];
    });

    const unregisterShell = menus.register("shell", () => [
      { label: "Go home", onPick: () => useShellStore.getState().goHome() },
      {
        label: "Import files",
        onPick: () => {
          const state = useShellStore.getState();
          const shelves = state.firstLandingApp();
          if (shelves) state.mountApp(shelves.id);
          requestImport();
          state.setStatus("pick files to import · or drop them anywhere");
        },
      },
      { label: "Switch theme", onPick: () => useShellStore.getState().toggleTheme() },
      {
        label: "Replay tutorials",
        onPick: () => {
          // clear every tour's seen flag so each app's tour auto-launches again on its next visit
          const s = useShellStore.getState();
          const cleared: Record<string, unknown> = {};
          for (const k of seenTourKeys(s.settings)) cleared[k] = false;
          s.patchSettings(cleared);
          s.setStatus("tutorials will show again");
        },
      },
    ]);

    const detachShellTarget = menus.attach(document.body, () => ({ type: "shell", label: "Bunraku." }));

    return () => {
      unregisterEntity();
      unregisterApp();
      unregisterShell();
      detachShellTarget();
    };
  }, []);
}
