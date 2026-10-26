/**
 * App - the shell's React root (CONTRACT V2). Boots settings-first (gates the first-run wizard;
 * the rest of the boot sequence, including the landing-app and title-screen decision, is
 * use-boot.ts), and renders the chrome (NavigationOverlay, open-piece tabs, the active app's canvas,
 * StatusBar) plus the follow dialog. The shell-owned context-menu providers live in
 * use-shell-menus.ts. Owns the loaded-app-module cache - the module itself is NOT store state
 * (not serializable), so it lives in a ref here.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { AGENT_APP_ID, liveSurface } from "../agent/live-state";
import type { AppContext, BunrakuApp } from "../app-contract";
import { SetupWizard } from "../setup/wizard";
import "./variant-styles";
import { NavigationOverlay } from "./NavigationOverlay";
import { Dock } from "./Dock";
import { AppRooms } from "./AppRooms";
import { presentedAppId, presentedPanes } from "./store-navigation";
import { DialogDepth } from "../components/dialog-core";
import { StatusBar } from "./StatusBar";
import { DropVeil } from "./DropVeil";
import { FollowDialog } from "./FollowDialog";
import { ClosePieceDialog } from "./ClosePieceDialog";
import { Menu } from "./Menu";
import { IconButton } from "../components/button";
import { LeavingGate } from "../components/leaving-gate";
import { TourGuide } from "../components/tour-guide";
import type { Tour } from "../tours/tour-contract";
import { hasSeenTour, isRunnable, tourIdCandidates, tourSeenKey } from "../tours/tour-core";
import { menus, useShellStore, workbenchRecents } from "./store";
import { paneKeyOf } from "./store-core";
import { useAppKeys } from "./use-app-keys";
import { useShellMenus } from "./use-shell-menus";
import { useRememberWorkspace } from "./use-workspace";
import { useBoot } from "./use-boot";
import { FloatingAgent } from "../agent/floating-agent";
import { BootErrorScreen } from "./BootErrorScreen";
import { TitleScreen } from "./TitleScreen";
import { assetUrl } from "../_shared/asset-url";
import { api } from "../api";
import { PieceStore } from "../_shared/piece-store";
import premiere from "./premiere-shell.module.css";
import { useThemeChangeStream } from "./use-theme-events";
import { installModGuard } from "./store-mod-guard";

installModGuard();

export interface AppProps {
  pieces?: PieceStore;
  /** Tests that mount App directly, headless: skips the title screen the same way navigator.webdriver
   * does, without weakening the real boot rule (title-core.ts) itself. Unused in production. */
  forceSkipTitle?: boolean;
  /** Test-only: shrinks use-boot.ts's piece-list retry backoff from real seconds (LIST_RETRY_DELAYS_MS)
   * to whatever a test passes, so it can prove the retry path without a real ~22 s wait. Unused in
   * production. */
  testListRetryDelaysMs?: readonly number[];
}

export function App({ forceSkipTitle = false, testListRetryDelaysMs, pieces: injectedPieces }: AppProps = {}): JSX.Element | null {
  const [pieces] = useState(() => injectedPieces ?? new PieceStore());
  const { phase, bootError, showTitle, setShowTitle, restoreSettled, onSetupComplete, onLandingMounted } =
    useBoot(forceSkipTitle, testListRetryDelaysMs, pieces);
  const modulesRef = useRef(new Map<string, BunrakuApp>());
  /**
   * Which app's Component is actually on the canvas right now.
   *
   * Not the same as `activeAppId`, which the dock sets immediately while the old app is still
   * mounted. `ctx.agent.publish` stamps with this so a publish arriving during the swap is
   * attributed to whoever actually made it.
   */
  const mountedAppId = useRef("");
  const [activeModule, setActiveModule] = useState<BunrakuApp | null>(null);
  const [loadingAppId, setLoadingAppId] = useState<string>();
  const [workspaceTarget, setWorkspaceTarget] = useState<HTMLDivElement | null>(null);
  const [overlayTarget, setOverlayTarget] = useState<HTMLDivElement | null>(null);
  const activeAppId = useShellStore(presentedAppId);
  const workspaceAppId = useShellStore((s) => s.activeAppId);
  const overlayAppId = useShellStore((s) => s.overlayAppId);
  const overlayOpen = useShellStore((s) => s.overlayOpen);
  // The app on the canvas, decided during render: a module already in the cache (the idle prefetch below loads every app) goes up
  // in the same commit that moves the dock, so the loading canvas never paints between two loaded apps. The load effect still
  // records what is mounted and fetches a module that is not cached yet.
  const presentedModule = !activeAppId ? null
    : activeModule?.manifest.id === activeAppId ? activeModule : modulesRef.current.get(activeAppId) ?? null;
  // the active app's tour (folders-as-schema, loaded like an app module); null = this app has none
  const toursRef = useRef(new Map<string, Tour | null>());
  /** the tour identity currently resolved for the view; auto-open re-evaluates ONLY when this
   * changes - a piece change mid-tour must never close a rail the user replayed (the act that
   * opens a piece re-fires this effect, and closing on "seen" killed every replay at step 2) */
  const tourIdRef = useRef<string | null>(null);
  const [tour, setTour] = useState<Tour | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  // ctrl+1..9 / ctrl+comma / ctrl+alt+arrows -> mountApp. One listener, mounted here for the shell's
  // whole life; the chords themselves live in app-keys.ts and the dock prints them off the same table.
  const dismissTitle = useCallback(() => setShowTitle(false), [setShowTitle]);
  useAppKeys(dismissTitle);
  useShellMenus();
  useThemeChangeStream(phase === "ready");
  // Writes the bench down whenever it changes, so killing the server loses nothing. No-op
  // while the setting is off, in both directions - and gated on restoreSettled (use-boot.ts,
  // use-workspace.ts) so it never overwrites a saved bench while restore is still pending.
  useRememberWorkspace(restoreSettled);
  /**
   * The agent, floating over whatever app is mounted. It lives here rather than inside an app
   * because the shell owns the one canvas slot: an agent mounted INTO that slot would unmount the
   * screen it exists to describe, which is the whole reason this panel is not a page.
   */
  const [agentOpen, setAgentOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      // ctrl/cmd + slash: near the other shell chords and not claimed by a text box.
      if ((e.ctrlKey || e.metaKey) && e.key === "/") { e.preventDefault(); setAgentOpen((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); };
  }, []);

  /** A mounted screen is a screen you are standing on; agent/live-state.ts records why. */
  const standOn = useCallback((appId: string): void => {
    if (appId === AGENT_APP_ID) return;
    const title = useShellStore.getState().manifests.find((m) => m.id === appId)?.title ?? appId;
    liveSurface.publish(appId, { headline: `${title} is open.` });
  }, []);

  // -- load the active app's module fresh, cache it (module identity is not store state) ------------
  useEffect(() => {
    if (!activeAppId) {
      // Also true before boot has decided anything (the very first render, activeAppId still ""):
      // mountLanding (use-boot.ts) calls onLandingMounted itself for the genuine "nothing to mount"
      // case, so this branch never needs to.
      mountedAppId.current = "";
      setActiveModule(null);
      setLoadingAppId(undefined);
      return;
    }
    const cached = modulesRef.current.get(activeAppId);
    if (cached) {
      setLoadingAppId(undefined);
      mountedAppId.current = activeAppId;
      standOn(activeAppId);
      setActiveModule(cached);
      return;
    }
    // The old app must leave the canvas NOW: dev bundles an uncached app on demand (seconds), and
    // keeping the previous component rendered while the dock highlights the new one reads as "it
    // forced me back to the workbench". Null renders the loading canvas until the module lands.
    setActiveModule(null);
    setLoadingAppId(activeAppId);
    let cancelled = false;
    void (async () => {
      // A failed chunk load (stale hash, network blip) must say so: unguarded, the dock highlights
      // the new app while the canvas sits empty.
      try {
        const mod = (await import(assetUrl(`apps/${activeAppId}.js`))) as { default: BunrakuApp };
        modulesRef.current.set(activeAppId, mod.default);
        if (!cancelled) {
          mountedAppId.current = activeAppId;
          standOn(activeAppId);
          setActiveModule(mod.default);
        }
      } catch {
        if (!cancelled) {
          useShellStore.getState().setStatus(`could not load ${activeAppId} · reload and try again`);
          // A failed load leaves no ActiveComponent, so the effect below never fires for this
          // attempt - this is the one branch that has to start the piece list itself.
          onLandingMounted();
        }
      } finally { if (!cancelled) setLoadingAppId(undefined); }
    })();
    return () => {
      cancelled = true;
    };
    // standOn is a stable useCallback with no deps; listing it would not change when this runs.
  }, [activeAppId, standOn, onLandingMounted]);

  // Starts the piece list only once the landing app's component is ACTUALLY ON THE CANVAS (a cache
  // hit above, or a fresh module load) - not merely once App.tsx's own effect resolves. React runs
  // a child's effects before its parent's from the same commit, so by the time this (a parent
  // effect) fires, the just-mounted app has already had a chance to run its own first effects
  // (plan R4's caveat: the server is single-threaded, so ordering matters when it can). Measured
  // against a realistic 1.3 GB sandbox library, this ordering change did not visibly move the
  // piece list's own ~90 s settle time one way or the other - B4 (the per-portrait decrypt storm)
  // is the likelier dominant cost there, not request order; kept because it is still the correct
  // priority in principle and measured no worse. See the doer's live-check report.
  useEffect(() => {
    if (activeModule) onLandingMounted();
  }, [activeModule, onLandingMounted]);

  // -- idle-prefetch the whole roster so a FIRST click on any app is instant, not a dev-bundle wait --
  const manifests = useShellStore((s) => s.manifests);
  useEffect(() => {
    if (manifests.length === 0) return;
    let cancelled = false;
    void (async () => {
      for (const m of manifests) {
        if (cancelled || m.comingSoon || modulesRef.current.has(m.id)) continue;
        try {
          const mod = (await import(assetUrl(`apps/${m.id}.js`))) as { default: BunrakuApp };
          modulesRef.current.set(m.id, mod.default);
        } catch {
          // prefetch is best-effort; the on-demand path above still owns the honest failure story
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [manifests]);

  // -- load the view's tour (if any) and auto-launch it once, on first visit ------------------------
  // On the Workbench, the "?" serves the ACTIVE PIECE'S KIND (workbench-lorebook, workbench-regex,
  // ...), falling back to the base workbench tour; each kind carries its own seen-flag via its
  // manifest.appId, so first-opening a lorebook can auto-offer its walkthrough.
  const activePieceKind = useShellStore((s) => {
    const p = s.openPieces.find((pp) => paneKeyOf(pp) === presentedPanes(s).activeKey);
    return p?.kind ?? null;
  });
  useEffect(() => {
    if (!activeAppId) {
      setTour(null);
      setTourOpen(false);
      return;
    }
    // Wait for the bench to reach its list-confirmed final shape (use-boot.ts): otherwise a
    // restored bench populating in the background changes activePieceKind out from under this
    // effect, and an unseen base tour can auto-open only to be swapped for the kind tour a moment
    // later. restoreSettled is true immediately when there was nothing to restore.
    if (!restoreSettled) return;
    let cancelled = false;
    void (async () => {
      const benchId = useShellStore.getState().benchApp()?.id;
      let t: Tour | null = null;
      for (const id of tourIdCandidates(activeAppId, benchId, activePieceKind)) {
        let cachedTour = toursRef.current.get(id);
        if (cachedTour === undefined) {
          try {
            const mod = (await import(assetUrl(`tours/${id}.js`))) as { default: Tour };
            cachedTour = isRunnable(mod.default) ? mod.default : null;
          } catch {
            cachedTour = null; // no tour under this id (a 404) - the common case, not an error
          }
          toursRef.current.set(id, cachedTour);
        }
        if (cachedTour) {
          t = cachedTour;
          break;
        }
      }
      if (cancelled) return;
      setTour(t);
      const id = t ? t.manifest.appId : null;
      const surfaceChanged = tourIdRef.current !== id;
      tourIdRef.current = id;
      if (surfaceChanged) {
        const seen = t ? hasSeenTour(useShellStore.getState().settings[tourSeenKey(t.manifest.appId)]) : true;
        setTourOpen(!!t && !seen); // first visit with an unseen tour wants to open
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeAppId, activePieceKind, restoreSettled]);

  // -- the AppContext handed to every app; methods read live state via getState() (thin adapters) ---
  // Subscribed to the WHOLE store ON PURPOSE (owner's rule: staleness is a structural impossibility,
  // not a per-slice bugfix). Every store action produces a fresh state object, so any change
  // rebuilds ctx and repaints the active app. If a surface ever measures hot, IT narrows to a
  // selector deliberately; the default is always-correct, never quietly stale.
  const storeState = useShellStore((s) => s);
  const contextApi: AppContext["api"] = useMemo(() => ({
    ...api,
    async saveEntity(entity, opts) { const lifetime = pieces.captureLifetime(); const saved = await api.saveEntity(entity, opts); pieces.accept(saved, lifetime); return saved; },
    async saveEditedEntity(entity, revision) {
      const lifetime = pieces.captureLifetime();
      const saved = await api.saveEditedEntity(entity, revision);
      pieces.accept({ ...saved.summary, revision: saved.revision }, lifetime);
      return saved;
    },
    async patchEditedEntity(kind, id, revision, patch, uploads, intent) {
      const lifetime = pieces.captureLifetime();
      const saved = await api.patchEditedEntity(kind, id, revision, patch, uploads, intent);
      pieces.accept({ ...saved.summary, revision: saved.revision }, lifetime);
      return saved;
    },
    async deleteEntity(kind, id) {
      const lifetime = pieces.captureLifetime();
      const result = await api.deleteEntity(kind, id);
      if (result.deleted && result.receipt) pieces.removeReceipt(result.receipt.kind, result.receipt.id, result.receipt.version, result.receipt.writeId, lifetime, "local", result.receipt.revision);
      else if (result.deleted && pieces.isCurrentLifetime(lifetime)) {
        try {
          await pieces.reloadInitial(async () => {
            if (!pieces.isCurrentLifetime(lifetime)) throw new DOMException("library changed", "AbortError");
            const inventory = await api.studioInventory();
            if (!pieces.isCurrentLifetime(lifetime)) throw new DOMException("library changed", "AbortError");
            return inventory;
          }, (inventory) => inventory.entities);
        } catch (error) { if (pieces.isCurrentLifetime(lifetime)) throw error; }
      }
      return result;
    },
    async restoreFromTrash(graveId) { const lifetime = pieces.captureLifetime(); const saved = await api.restoreFromTrash(graveId); pieces.restoreReceipt(saved, lifetime); return saved; },
    async saveBundle(payload) {
      const lifetime = pieces.captureLifetime();
      const saved = await api.saveBundle(payload);
      for (const row of [...saved.related, ...(saved.primary ? [saved.primary] : [])]) pieces.accept(row, lifetime);
      return saved;
    },
    async saveStaged(payload) {
      const lifetime = pieces.captureLifetime();
      const saved = await api.saveStaged(payload);
      for (const row of [...saved.related, ...(saved.primary ? [saved.primary] : [])]) pieces.accept(row, lifetime);
      return saved;
    },
  }), [pieces]);
  const ctx: AppContext = useMemo(
    () => ({
      api: contextApi,
      pieces,
      appearance: {
        get: () => useShellStore.getState().appearance,
        assetUrl: (id) => {
          const state = useShellStore.getState();
          return state.appearance.assets.some((asset) => asset.id === id)
            ? state.appearanceAssetUrls[id] ?? state.appearance.assets.find((asset) => asset.id === id)?.url
            : undefined;
        },
        invalidate: () => useShellStore.getState().invalidateAppearance(),
        refresh: () => useShellStore.getState().refreshAppearance(),
        onChange: (cb) => useShellStore.subscribe((state, previous) => {
          if (state.appearance !== previous.appearance || state.appearanceAssetUrls !== previous.appearanceAssetUrls) cb();
        }),
      },
      setStatus: (text) => useShellStore.getState().setStatus(text),
      apps: () => [...useShellStore.getState().manifests],
      openApp: (id) => useShellStore.getState().mountApp(id),
      menus,
      prefs: {
        get: (key) => useShellStore.getState().settings[key],
        set: (key, value) => {
          useShellStore.getState().patchSettings({ [key]: value });
        },
      },
      workbench: {
        pieces: () => [...useShellStore.getState().openPieces],
        active: () => useShellStore.getState().activePiece(),
        beside: () => useShellStore.getState().besidePiece(),
        send: (s) => useShellStore.getState().sendMany([s]),
        open: (s) => useShellStore.getState().openPiece(s),
        sendMany: (pieces) => useShellStore.getState().sendMany(pieces),
        openBeside: (s) => useShellStore.getState().openBeside(s),
        closeSplit: () => useShellStore.getState().closeSplit(),
        remove: (id, kind) => useShellStore.getState().requestPieceClose(id, kind),
        isOpen: (id, kind) => useShellStore.getState().isOpen(id, kind),
        dirty: () => ({ ...useShellStore.getState().dirtyPieces }),
        setDirty: (id, kind, dirty) => useShellStore.getState().setPieceDirty(id, kind, dirty),
        recents: () => workbenchRecents(),
        focus: (id, kind, focusEntry) => useShellStore.getState().focusPiece(id, kind, focusEntry),
        restoring: () => useShellStore.getState().restoringWorkspace,
        restoreFailure: () => useShellStore.getState().bootListFailed,
        onChange: (cb) =>
          useShellStore.subscribe((state, prev) => {
            if (
              state.openPieces !== prev.openPieces ||
              state.activeKey !== prev.activeKey ||
              state.splitKey !== prev.splitKey ||
              state.overlayPanes !== prev.overlayPanes || state.overlayOpen !== prev.overlayOpen ||
              state.restoringWorkspace !== prev.restoringWorkspace ||
              state.bootListFailed !== prev.bootListFailed
            )
              cb();
          }),
      },
      press: {
        queue: () => [...useShellStore.getState().pressQueue],
        stage: (batch) => useShellStore.getState().stageForPress(batch),
        unstage: (id, kind) => useShellStore.getState().unstagePress(id, kind),
        clear: () => useShellStore.getState().clearPress(),
        onChange: (cb) =>
          useShellStore.subscribe((state, prev) => {
            if (state.pressQueue !== prev.pressQueue) cb();
          }),
      },
      /**
       * The live half of agentSurface. Deliberately NOT in the shell store: this snapshot changes as
       * fast as a selection does, and every store write rebuilds ctx and repaints the whole app (see
       * the note on storeState above). An app publishing its state on each render would drive an
       * infinite repaint. It lives in a module of its own; both directions go through here, because
       * an app that imported that module would get its own empty copy (agent/live-state.ts).
       */
      agent: {
        /**
         * Stamped with the MOUNTED app, not the one the dock has selected. `activeAppId` flips the
         * instant the dock is clicked while the outgoing app stays mounted for a commit or two and
         * can publish once more on the way out - stamping that with the incoming id made the Library
         * publish itself as "agent", and the window then described ITSELF using the Library's
         * contents. Apps never learn which app is active; one that could name itself could name a
         * different screen.
         */
        publish: (state) => liveSurface.publish(mountedAppId.current, state),
        current: () => liveSurface.current(),
        onChange: (cb) => liveSurface.onChange(cb),
      },
    }),
    // storeState is an identity TRIGGER, not a consumed value: its whole job is invalidating ctx on
    // any store change (the anti-staleness rule above); eslint correctly notes it is unused inside
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storeState, pieces, contextApi],
  );

  if (phase === "loading") return null; // chrome renders only from real state; nothing to paint yet

  if (phase === "boot-error") {
    return <BootErrorScreen problem={bootError} />;
  }

  if (phase === "setup") {
    return (
      <SetupWizard
        ctx={{ formats: api.formats }}
        existing={useShellStore.getState().settings}
        onComplete={onSetupComplete}
      />
    );
  }

  return (
    <div id="shell" data-navigation="dock" data-part="shell.root" className={`${premiere.shellContainer}${showTitle ? ` ${premiere.shell}` : ""}`}>
      <div id="main">
        <NavigationOverlay onNavigate={dismissTitle} ctx={ctx} Widgets={presentedModule?.OverlayWidgets} onSurfaceTarget={setOverlayTarget} />
        <StatusBar pieces={pieces} />
        <main id="canvas" data-part="shell.canvas">
          {showTitle && <TitleScreen pieces={pieces} onDone={(appId) => {
            if (appId) useShellStore.getState().mountApp(appId);
            setShowTitle(false);
          }} />}
          <div ref={setWorkspaceTarget} hidden={showTitle} className={premiere.appContents} />
        </main>
        <AppRooms app={presentedModule} activeAppId={activeAppId} workspaceAppId={workspaceAppId} overlayAppId={overlayAppId}
          workspace={workspaceTarget} overlay={overlayTarget} overlayOpen={overlayOpen} ctx={ctx} />
      </div>
      <Dock onNavigate={dismissTitle} pendingAppId={overlayOpen ? undefined : loadingAppId} />
      <DropVeil />
      <DialogDepth.Provider value={overlayTarget ? 1 : 0}>
      <FollowDialog />
      <ClosePieceDialog />
      <Menu />
      <LeavingGate />
      {tour && isRunnable(tour) && !tourOpen && !overlayTarget && (
        <div className={premiere.tourHelp}>
          <IconButton variant="quiet" size="sm" icon={<span aria-hidden="true">?</span>} label="Replay the tour" onClick={() => setTourOpen(true)} />
        </div>
      )}
      {/* !showTitle: the tour never mounts over the title screen; it opens the instant the title
          screen unmounts (below), since tourOpen was already set true underneath it. */}
      {tour && tourOpen && !showTitle && !overlayTarget && <TourGuide tour={tour} ctx={ctx} onClose={() => setTourOpen(false)} />}
      <FloatingAgent ctx={ctx} open={agentOpen} onClose={() => { setAgentOpen(false); }} />
      </DialogDepth.Provider>
    </div>
  );
}
