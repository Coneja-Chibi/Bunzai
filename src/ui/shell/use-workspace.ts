/**
 * Remembering the bench across a restart, and putting it back.
 *
 * TWO HALVES THAT MUST NOT FIGHT. The snapshot writes whenever the bench changes; the restore runs
 * once at boot. Without the guard below they chase each other: restore opens the pieces, opening
 * them changes the bench, the change writes a snapshot, and a half-restored bench overwrites the
 * record that was still being read from.
 *
 * RESTORING IS ONE STORE WRITE, never a loop of send() calls: each of those fires the follow
 * prompt, stamps recents, and triggers a snapshot - so putting twenty tabs back would ask twenty
 * questions and overwrite the record it was still reading from halfway through.
 *
 * THE SETTING IS CHECKED IN BOTH DIRECTIONS. Off means nothing is written and nothing is restored,
 * so turning it on does not silently reopen a bench from whenever it was last on.
 *
 * WHICH APP NEEDS NO PIECE LIST; WHICH PIECES SURVIVED DOES (perf plan Phase 2 / R4). peekWorkspace
 * reads only settings.json, already in memory at boot - so use-boot.ts can decide which app to land
 * on, and whether to suppress the title screen, before the studio's piece list has even been asked
 * for. resolveWorkspace does the other half once the list lands: liveRefs drops any piece deleted
 * since, so a bench never restores as a tab that cannot open.
 *
 * ARMED, NOT ALWAYS ON. `useRememberWorkspace` takes an `armed` flag so it writes nothing until
 * use-boot.ts says the bench has reached its list-confirmed shape. Unarmed, right after boot, the
 * bench is provisionally empty while the real one is still being read back from settings.json; an
 * unguarded write here would see that empty bench, encode it, and PATCH it over the very record
 * restore is about to read - the two halves above fighting for real, not hypothetically. A kill
 * during that window would then lose the saved bench for good.
 */
import { useEffect, useRef } from "react";
import { useShellStore } from "./store";
import { paneKeyOf } from "./store-core";
import { liveRefs, readWorkspace, snapshotWorkspace, workspaceKey, type Workspace } from "./workspace-core";
import type { StudioEntitySummary } from "../app-contract";

/** Same key the Settings toggle writes. */
export const RESTORE_PREF = "workbench.restoreSession";
const WORKSPACE_KEY = "workbench.workspace";

/** Write the bench down whenever it changes, so a kill loses nothing. */
export function useRememberWorkspace(armed: boolean): void {
  const settings = useShellStore((s) => s.settings);
  const openPieces = useShellStore((s) => s.openPieces);
  const activeKey = useShellStore((s) => s.activeKey);
  const splitKey = useShellStore((s) => s.splitKey);
  const activeAppId = useShellStore((s) => s.activeAppId);
  /** The last thing written, so an unchanged bench does not rewrite the settings file. */
  const written = useRef("");

  useEffect(() => {
    if (!armed) return; // the bench is still provisional - see the file docblock
    if (settings[RESTORE_PREF] !== true) return;
    const snap = snapshotWorkspace({
      pieces: openPieces,
      activeKey,
      splitKey,
      appId: activeAppId,
    });
    const key = workspaceKey(snap);
    /**
     * Compared by VALUE. The store rebuilds these arrays on every write - a status-bar message
     * included - so identity would have this writing the settings file continuously.
     */
    if (key === written.current) return;
    written.current = key;
    useShellStore.getState().patchSettings({ [WORKSPACE_KEY]: snap });
  }, [armed, settings, openPieces, activeKey, splitKey, activeAppId]);
}

/**
 * Which app a saved bench names, straight from settings - no piece list needed. Null when restore
 * is off, or the setting is on but nothing was ever saved open.
 */
export function peekWorkspace(settings: Record<string, unknown>): Workspace | null {
  if (settings[RESTORE_PREF] !== true) return null;
  const stored = readWorkspace(settings[WORKSPACE_KEY]);
  if (!stored || stored.open.length === 0) return null;
  return stored;
}

/**
 * Resolve a peeked workspace against the studio's piece list: this is what lets a piece deleted
 * since be dropped instead of restored as a tab that cannot open (workspace-core.ts's liveRefs).
 * Null when every named piece is gone.
 */
export function resolveWorkspace(
  stored: Workspace,
  studio: readonly StudioEntitySummary[],
): { pieces: StudioEntitySummary[]; activeKey: string; splitKey: string; appId: string } | null {
  // By id, never by position: liveRefs drops dead refs, so a survivor's index into the FILTERED
  // list does not match its own ref's index in `stored.open` once anything before it was dropped.
  const focusById = new Map(stored.open.map((r) => [`${r.kind}:${r.id}`, r.focusEntry]));
  const pieces = liveRefs(stored, studio).map((p) => {
    const focusEntry = focusById.get(`${p.kind}:${p.id}`);
    // The entry a lorebook was open on is part of its pane identity, not decoration.
    return focusEntry ? { ...p, params: { focusEntry } } : p;
  });
  if (pieces.length === 0) return null;

  /**
   * A REMEMBERED ACTIVE PIECE THAT IS GONE FALLS BACK to the first surviving one rather than to
   * nothing. Restoring four tabs and focusing none of them looks like the restore half-failed.
   */
  const keys = new Set(pieces.map(paneKeyOf));
  const activeKey = keys.has(stored.activeKey) ? stored.activeKey : paneKeyOf(pieces[0]!);
  const splitKey = keys.has(stored.splitKey) && stored.splitKey !== activeKey ? stored.splitKey : "";

  return { pieces, activeKey, splitKey, appId: stored.appId };
}
