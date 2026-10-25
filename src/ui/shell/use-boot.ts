/**
 * use-boot - the shell's boot sequence (CONTRACT V2, perf plan Phase 2 / R4), split out of App.tsx.
 * Settings load first (gates the first-run wizard); then the app roster loads and the landing
 * decision - which app to mount, and whether the title screen shows - is made and painted WITHOUT
 * waiting on the studio's piece list. The list itself (the status bar's piece count, and which of a
 * restored bench's pieces survive) loads afterward, in the background, and applies when it lands.
 *
 * WHICH APP TO LAND ON NEEDS NO PIECE LIST. A saved workspace names its app right in settings.json
 * (`peekWorkspace`, use-workspace.ts), so the landing choice below never has to wait for a decrypt
 * of every piece just to learn which app a remembered bench was on.
 *
 * WHICH OF ITS PIECES SURVIVED DOES. A piece deleted since must be dropped, not restored as a tab
 * that cannot open (`resolveWorkspace`'s liveRefs) - so that half runs once the list lands, in
 * `finishBoot`. Until then the bench stays PROVISIONAL, not merely empty: the shell store's
 * `restoringWorkspace` flag (true from boot, read by apps via `ctx.workbench.restoring()`) says so, so
 * the Workbench can show "Restoring your bench..." instead of claiming there is nothing open - the
 * "show it as loading" the plan's R4 risk note asks for, never a tab for a piece not yet confirmed
 * live, and never a bare empty room either.
 *
 * ONE CASE NEEDS A LATE CORRECTION: every piece a saved bench named is gone. Nothing before the
 * list lands can tell that from a live bench, so the fast landing choice treats "there was a saved
 * bench" as "restore it" - which can wrongly suppress the title screen and land on the bench's own
 * app. Once the list comes back empty-handed, `finishBoot` replays `chooseLanding` with no restored
 * app, exactly the choice today's list-first boot would have made from the start, and corrects the
 * mount and the title if either was wrong - but only if the user is still exactly where boot
 * provisionally left them (untouched bench, still on the provisional app); otherwise it leaves them
 * alone rather than yanking them off a screen they moved to themselves. Every other outcome needs
 * no correction.
 *
 * THE INITIAL LIST READ CAN FAIL, AND RETRIES. `finishBoot` tries the shared inventory/list request up to
 * `LIST_RETRY_DELAYS_MS.length` more times, backing off 2s / 5s / 15s, before giving up - a network
 * blip or a slow-opening library should not permanently strand the bench empty. `restoringWorkspace`
 * (the write-gate use-workspace.ts reads) stays true the entire time, including on final failure: a
 * saved bench never confirmed one way or the other must never let the still-empty in-memory bench
 * PATCH over it. On final failure the shell store's `bootListFailed` carries the message (sticky over
 * routine status writes; see StatusBar.tsx) naming that it could not be read and that a reload is the
 * way to retry.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { AppManifestEntry, StudioEntitySummary } from "../app-contract";
import { parseSettings, type StudioSettings } from "../../studio/settings-shape";
import { nextStudioCountRequest, useShellStore } from "./store";
import { genericBootProblem, settingsBootProblem, type BootProblem } from "./boot-error";
import { parseLaunchTarget } from "../_shared/launch-target";
import { ACTIVE_APP_KEY } from "../_shared/window-memory";
import { SCENES_APP } from "../_shared/scene-handoff";
import { FORCE_TITLE_QUERY_PARAM, shouldShowTitle } from "./title-core";
import { webStorage } from "../_shared/web-storage";
import { peekWorkspace, resolveWorkspace } from "./use-workspace";
import type { Workspace } from "./workspace-core";
import { LIBRARY_LOCKED_EVENT } from "../_shared/api-fetch";
import { isRecord } from "../../core/guards";
import type { PieceStore } from "../_shared/piece-store";

export type BootPhase = "loading" | "setup" | "ready" | "boot-error";

/** Backoff between the piece list's retries after a failed inventory/list read (3 retries, 4 tries
 * total): a network blip should not permanently strand the bench empty, but nothing here should spin
 * forever either. Exported so a test can shrink it (App.tsx's `testListRetryDelaysMs`) instead of
 * waiting out ~22 real seconds. */
export const LIST_RETRY_DELAYS_MS: readonly number[] = [2000, 5000, 15000];

/** A `retryDelaysMs[attempt]` wait that a caller can actually cancel: `signal.abort()` clears the
 * pending `setTimeout` immediately (not merely ignored once it fires later), so an unmounted hook or
 * a library that just locked leaves no stray timer running down in the background. */
function cancelableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("aborted", "AbortError"));
      return;
    }
    const id = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(id);
        reject(new DOMException("aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/** Tries one inventory/list read, then again after each of `retryDelaysMs` on failure. Null means
 * every try failed, OR `signal` fired first - the hook unmounted (App.tsx's own cleanup) or the
 * library locked mid-retry (LIBRARY_LOCKED_EVENT): retrying a read the library will refuse anyway,
 * against a component that may no longer even be mounted, serves nobody. */
async function fetchEntitiesWithRetry(retryDelaysMs: readonly number[], signal: AbortSignal, pieces?: PieceStore): Promise<StudioEntitySummary[] | null> {
  const lifetime = pieces?.captureLifetime();
  for (let attempt = 0; ; attempt++) {
    if (signal.aborted || pieces && !pieces.isCurrentLifetime(lifetime!)) return null;
    try {
      const rows = pieces
        ? [...(await pieces.loadInitial(async () => {
          if (signal.aborted || !pieces.isCurrentLifetime(lifetime!)) throw new DOMException("boot expired", "AbortError");
          const inventory = await api.studioInventory();
          if (signal.aborted || !pieces.isCurrentLifetime(lifetime!)) throw new DOMException("boot expired", "AbortError");
          return inventory;
        }, (inventory) => inventory.entities)).entities]
        : await api.listEntities();
      return signal.aborted || pieces && !pieces.isCurrentLifetime(lifetime!) ? null : rows;
    } catch {
      if (signal.aborted || pieces && !pieces.isCurrentLifetime(lifetime!)) return null;
      if (attempt >= retryDelaysMs.length) return null;
      try {
        await cancelableDelay(retryDelaysMs[attempt]!, signal);
      } catch {
        return null; // aborted while waiting between retries
      }
    }
  }
}

export interface UseBootResult {
  phase: BootPhase;
  bootError: BootProblem | null;
  showTitle: boolean;
  setShowTitle: (v: boolean) => void;
  /**
   * True once the bench has reached its list-confirmed final shape - or immediately, when there was
   * nothing to restore in the first place. use-workspace.ts's write-gate and App.tsx's tour launch
   * both wait on this, so neither acts on a bench that is still provisional.
   */
  restoreSettled: boolean;
  onSetupComplete: (chosen: StudioSettings) => void;
  /**
   * App.tsx calls this once the landing app's OWN component is actually on the canvas (from an
   * effect keyed on ActiveComponent), or once its load has failed outright. Only the first call
   * does anything: it starts the deferred piece-list fetch. Later than "the landing app painted" on
   * purpose - the server is single-threaded (plan R4's caveat), so starting the list's own decrypt
   * before the landing app's own first requests have gone out queues them behind it. Measured
   * against a realistic 1.3 GB sandbox library: first paint and Scenes' own content both landed
   * well under a second, but the piece list itself (`studioCount`) still took about 90 s to settle
   * either way - B4 (the Library's per-portrait decrypt storm) is the likelier bottleneck there,
   * not request order; see the perf plan and the doer's live-check report. `mountLanding` calls this
   * directly when there is no app to mount at all, so nothing besides App.tsx's genuine load
   * outcomes needs to reach here.
   */
  onLandingMounted: () => void;
}

interface LandingArgs {
  manifestList: AppManifestEntry[];
  scenesApp: AppManifestEntry | undefined;
  requested: AppManifestEntry | undefined;
  landing: AppManifestEntry | undefined;
  remembered: AppManifestEntry | undefined;
  reload: boolean;
  freshFromSetup: boolean;
  webdriver: boolean;
}

interface LandingChoice {
  wantsTitle: boolean;
  first: AppManifestEntry | undefined;
}

/**
 * The one formula for "which app, and does the title screen show" - shared by the fast landing
 * decision and the late correction, so the two can never drift into different rules for the same
 * inputs (AGENTS rule 7).
 */
function chooseLanding(args: LandingArgs & { restoredAppId: string }): LandingChoice {
  const wantsTitle = shouldShowTitle({
    reload: args.reload,
    requested: !!args.requested,
    freshFromSetup: args.freshFromSetup,
    restoredApp: !!args.restoredAppId,
    webdriver: args.webdriver,
  });
  const restoredMatch = args.restoredAppId
    ? args.manifestList.find((m) => m.id === args.restoredAppId && !m.comingSoon)
    : undefined;
  const first =
    (wantsTitle && args.scenesApp) ||
    args.requested ||
    restoredMatch ||
    args.landing ||
    args.remembered ||
    useShellStore.getState().homeApp();
  return { wantsTitle, first };
}

export function useBoot(forceSkipTitle: boolean, listRetryDelaysMs: readonly number[] = LIST_RETRY_DELAYS_MS, pieces?: PieceStore): UseBootResult {
  const [phase, setPhase] = useState<BootPhase>("loading");
  const [bootError, setBootError] = useState<BootProblem | null>(null);
  const [showTitle, setShowTitle] = useState(false);
  // The shell store, not local state: ctx.workbench.restoring() (App.tsx) reads the same flag, so
  // apps and this hook can never disagree about whether the bench is still provisional.
  const restoringWorkspace = useShellStore((s) => s.restoringWorkspace);
  const restoreSettled = !restoringWorkspace;
  // Captured once: a test-only escape hatch, never expected to change after mount (App.tsx's own
  // note on the prop applies here unchanged).
  const forceSkipTitleRef = useRef(forceSkipTitle);
  /** Background work `mountLanding` queues; armed once the landing app's load has settled AND the
   * shell chrome itself has committed - never sooner, so the piece list is never requested before. */
  const bgWorkRef = useRef<(() => Promise<void>) | null>(null);
  /** One controller for this hook's whole life: aborted on unmount AND the moment the library locks
   * (LIBRARY_LOCKED_EVENT - the same signal _shared/caches.ts's registry already listens for),
   * so a pending list retry never keeps a timer running past either. */
  const listAbortRef = useRef<AbortController | null>(null);
  listAbortRef.current ??= new AbortController();
  useEffect(() => {
    const controller = listAbortRef.current!;
    const onLocked = (): void => controller.abort();
    window.addEventListener(LIBRARY_LOCKED_EVENT, onLocked);
    return () => {
      window.removeEventListener(LIBRARY_LOCKED_EVENT, onLocked);
      controller.abort();
    };
  }, []);

  // Runs `bgWorkRef`'s queued work exactly once, one tick later still (never in the same task as
  // whatever called it).
  const armBackgroundList = useCallback((): void => {
    if (!bgWorkRef.current) return;
    const work = bgWorkRef.current;
    bgWorkRef.current = null;
    window.setTimeout(() => void work(), 0);
  }, []);

  // BOTH SIGNALS ARE NEEDED, AND NEITHER IS SAFE ALONE. `mountApp` (inside mountLanding, before
  // `setPhase("ready")`) and the phase flip are two separate zustand/React state changes with a
  // microtask between them (`await mountLanding(...)`), so React can - and, in a jsdom boot test,
  // does - commit `activeAppId` a render before `phase` becomes "ready". App.tsx's module-load
  // effect fires on that EARLIER commit, before `#shell` exists. `phaseRef` (read fresh, never
  // stale, because it is written during render rather than in an effect) is what makes waiting for
  // both signals - in whichever order they actually arrive - correct.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const loadAttemptedRef = useRef(false);
  const tryArmBackgroundList = useCallback((): void => {
    if (phaseRef.current === "ready" && loadAttemptedRef.current) armBackgroundList();
  }, [armBackgroundList]);
  /**
   * App.tsx calls this once the landing app's OWN component is actually on the canvas (a cache
   * hit, a fresh module load, or a failed one - any outcome). `mountLanding` below also calls it
   * directly when there is no app to mount at all, so this is the one place that starts the
   * deferred piece-list fetch, on every path. Later than "the landing app painted" on purpose -
   * the server is single-threaded (plan R4's caveat), so starting the list's own decrypt before
   * the landing app's own first requests have a chance to run queues them behind it.
   */
  const onLandingMounted = useCallback((): void => {
    loadAttemptedRef.current = true;
    tryArmBackgroundList();
  }, [tryArmBackgroundList]);
  // Re-checks once phase itself flips to "ready", covering the order above: the load attempt may
  // already have finished on the earlier commit, in which case this is what actually arms it.
  useEffect(() => {
    if (phase === "ready") tryArmBackgroundList();
  }, [phase, tryArmBackgroundList]);

  // -- the studio's piece list: the count, and which of a restored bench's pieces survived --------
  async function finishBoot(
    requested: AppManifestEntry | undefined,
    pendingWorkspace: Workspace | null,
    correctionArgs: LandingArgs,
    provisionalAppId: string | undefined,
    navigationRevision: number,
  ): Promise<void> {
    const token = nextStudioCountRequest();
    const signal = listAbortRef.current!.signal;
    const lifetime = pieces?.captureLifetime();
    const fetched = pieces?.isSeeded() ? null : await fetchEntitiesWithRetry(listRetryDelaysMs, signal, pieces);
    if (signal.aborted || pieces && !pieces.isCurrentLifetime(lifetime!)) return;
    if (fetched === null && !pieces?.isSeeded()) {
      // NEVER arms the write-gate either way: the saved bench in settings.json was never actually
      // confirmed one way or the other, so opening the gate now would let the still-empty
      // (never-restored) in-memory bench PATCH straight over the real saved one.
      if (signal.aborted) {
        // The hook unmounted, or the library locked mid-retry: not a failure to REPORT - the shell
        // this status bar belongs to is either gone or about to be replaced by the lock screen, and
        // "could not read the piece list after N tries" would be a false reason either way.
        return;
      }
      // Genuinely exhausted every try. bootListFailed (not setStatus) so a routine status write can
      // never bury this; a reload gets a fresh, unpoisoned attempt.
      const tries = listRetryDelaysMs.length + 1;
      useShellStore.getState().setBootListFailed(`could not read the piece list after ${String(tries)} tries · reload and try again`);
      return;
    }
    if (pieces && !pieces.isSeeded()) {
      useShellStore.getState().setBootListFailed("could not settle the piece list while it was changing · reload and try again");
      return;
    }
    const entities = pieces ? [...pieces.listSnapshot()] : fetched ?? [];
    // A successful read, on this attempt or a retry, supersedes any earlier failure note - the same
    // rule StatusBar.tsx's own studio-changes reload follows for the exact same field.
    useShellStore.getState().setBootListFailed(null);
    try {
      useShellStore.getState().setStudioCount(entities.length, token);
      if (requested || !pendingWorkspace) {
        // A link target never restores, but the list DID resolve - the saved bench (never touched
        // this boot) is exactly as settings.json left it, so remember-writes are safe to arm.
        if (pendingWorkspace) useShellStore.getState().setRestoringWorkspace(false);
        return;
      }
      const resolved = resolveWorkspace(pendingWorkspace, entities);
      if (resolved) {
        const live = useShellStore.getState();
        // Never stomp a bench the user already built by hand in the gap before the list landed.
        // The tab strip is shared chrome, not app-scoped, so which app is on screen right now does
        // not gate this - only whether its tabs are still exactly as boot left them.
        if (live.openPieces.length === 0 && live.activeKey === "") live.restoreBench(resolved);
        useShellStore.getState().setRestoringWorkspace(false);
        return;
      }
      // Every named piece is gone: replay the choice with nothing restored - what a list-first boot
      // would have decided from the start. UNLIKE restoreBench above, this can change what is ON
      // SCREEN (the mounted app, the title overlay) - so it only fires if the user is still exactly
      // where boot provisionally left them; otherwise correcting now would yank them out of
      // whatever they moved on to, or drop the title over live work.
      const live = useShellStore.getState();
      const untouched = live.openPieces.length === 0 && live.activeKey === "";
      if (untouched && live.activeAppId === provisionalAppId && live.navigationRevision === navigationRevision) {
        const corrected = chooseLanding({ ...correctionArgs, restoredAppId: "" });
        if (corrected.wantsTitle) setShowTitle(true);
        if (corrected.first && corrected.first.id !== provisionalAppId) {
          live.mountApp(corrected.first.id);
        }
      }
      useShellStore.getState().setRestoringWorkspace(false);
    } catch {
      // The list itself was read fine (retried above already); this is an unexpected bug in applying
      // it (resolveWorkspace, restoreBench, or the correction's own mountApp/chooseLanding throwing).
      // Unlike a failed fetch, nothing will fix this on a retry - so UNLIKE that branch, the gate DOES
      // open here: leaving restoringWorkspace stuck true would strand the Workbench showing "Restoring
      // your bench..." with its create CTAs hidden forever, with no way for the person to do anything
      // at all. bootListFailed (sticky) still names the trouble, exactly as the failed-fetch branch
      // does, so it is never silently swallowed either.
      useShellStore.getState().setRestoringWorkspace(false);
      useShellStore.getState().setBootListFailed("the saved bench could not be restored · reload and try again");
    }
  }

  // -- settings-first (CONTRACT V2): the app roster + a landing app that needs no piece list -------
  async function mountLanding(
    freshFromSetup: boolean,
    stored: StudioSettings,
  ): Promise<void> {
    const signal = listAbortRef.current!.signal;
    const lifetime = pieces?.captureLifetime();
    const appsRes = await fetch("/api/apps");
    if (signal.aborted || pieces && !pieces.isCurrentLifetime(lifetime!)) return;
    if (!appsRes.ok) throw new Error("could not load app roster");
    const manifestList = ((await appsRes.json()) as AppManifestEntry[]).sort(
      (a, b) => a.order - b.order,
    );
    if (signal.aborted || pieces && !pieces.isCurrentLifetime(lifetime!)) return;
    useShellStore.getState().setManifests(manifestList);

    const landing = freshFromSetup ? useShellStore.getState().firstLandingApp() : undefined;
    // A reload (dev live-reload included) returns to the app you were ON, not home: without this,
    // every source save while the studio is open dumped the user back on the workbench. The raw id
    // (not just a successful manifest match) is also the title screen's "this is a reload" signal.
    let storedActiveId: string | null = null;
    try {
      storedActiveId = webStorage("session")?.getItem(ACTIVE_APP_KEY) ?? null;
    } catch {
      storedActiveId = null;
    }
    const remembered = storedActiveId
      ? manifestList.find((m) => m.id === storedActiveId && !m.comingSoon)
      : undefined;
    const launch = parseLaunchTarget(window.location.hash);
    const requested = launch
      ? manifestList.find((manifest) => manifest.id === launch.appId && !manifest.comingSoon)
      : undefined;

    // Which app a saved bench names, straight from THIS fetch's settings - never a later read of
    // the live store, which use-workspace.ts's write-gate keeps untouched until restore settles,
    // but which is safer still read from the value already in hand (use-workspace.ts docblock).
    const pendingWorkspace = peekWorkspace(stored as unknown as Record<string, unknown>);

    const autoWebdriver = typeof navigator !== "undefined" && navigator.webdriver === true;
    const forceTitle = new URLSearchParams(window.location.search).get(FORCE_TITLE_QUERY_PARAM) === "1";
    const webdriver = forceSkipTitleRef.current || (autoWebdriver && !forceTitle);
    const scenesApp = manifestList.find((m) => m.id === SCENES_APP && !m.comingSoon);

    const correctionArgs: LandingArgs = {
      manifestList, scenesApp, requested, landing, remembered,
      reload: storedActiveId !== null, freshFromSetup, webdriver,
    };
    const choice = chooseLanding({ ...correctionArgs, restoredAppId: pendingWorkspace?.appId ?? "" });
    setShowTitle(choice.wantsTitle);
    if (choice.first) {
      useShellStore.getState().mountApp(choice.first.id);
    } else {
      // Nothing to mount (an empty roster): App.tsx's module-load effect never fires for this, so
      // nothing else will ever call onLandingMounted - this is the one path that must call it itself.
      onLandingMounted();
    }

    if (!pendingWorkspace) {
      // Nothing to restore: the bench is already in its final (empty) shape, so remember-writes and
      // the tour can act right away instead of waiting on a list that has nothing left to confirm.
      useShellStore.getState().setRestoringWorkspace(false);
    }
    const navigationRevision = useShellStore.getState().navigationRevision;
    bgWorkRef.current = () => finishBoot(requested, pendingWorkspace, correctionArgs, choice.first?.id, navigationRevision);
  }

  useEffect(() => {
    void (async () => {
      const signal = listAbortRef.current!.signal;
      try {
        const res = await fetch("/api/settings");
        if (signal.aborted) return;
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          setBootError(settingsBootProblem(res.status, body?.error, { port: window.location.port }));
          setPhase("boot-error");
          return;
        }
        const raw = await res.json();
        if (signal.aborted) return;
        if (!isRecord(raw)) {
          throw new Error("could not read settings");
        }
        const stored = parseSettings(raw);
        useShellStore.getState().applySettings(stored);
        await useShellStore.getState().refreshAppearance();
        if (signal.aborted) return;
        if (!stored.setupComplete) {
          setPhase("setup");
          return;
        }
        await mountLanding(false, stored);
        if (signal.aborted) return;
        setPhase("ready");
      } catch (e) {
        if (signal.aborted) return;
        setBootError(genericBootProblem(e));
        setPhase("boot-error");
      }
    })();
    // boot runs exactly once; mountLanding is stable for the component's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSetupComplete = (chosen: StudioSettings): void => {
    void (async () => {
      const signal = listAbortRef.current!.signal;
      await useShellStore.getState().saveSettings(chosen);
      if (signal.aborted) return;
      await mountLanding(true, useShellStore.getState().settings);
      if (signal.aborted) return;
      setPhase("ready");
    })();
  };

  return { phase, bootError, showTitle, setShowTitle, restoreSettled, onSetupComplete, onLandingMounted };
}
