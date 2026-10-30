/** RoleCall's persistent bottom-dock interaction, backed by Bunzai's discovered apps and host navigation. */
import { useLayoutEffect, useMemo, useRef, type JSX, type KeyboardEvent } from "react";
import type { AppManifestEntry } from "../app-contract";
import { AppMark } from "../components/app-mark";
import { IconButton, Tile } from "../components/button";
import { Ic } from "../_shared/ic";
import { ThemeSlot } from "../_shared/theme-slot";
import { appRoster, chordFor, isMacLike } from "./app-keys";
import { dockManifestGroups } from "./dock-core";
import { useContextMenu, useShellStore } from "./store";
import styles from "./bottom-dock.module.css";

function DockTile({ app, chord, collapsed, pending, onNavigate }: { app: AppManifestEntry; chord: string | null; collapsed: boolean; pending: boolean; onNavigate?(): void }): JSX.Element {
  const active = useShellStore(state => state.activeAppId === app.id);
  const menuRef = useContextMenu(() => ({ type: "app", label: app.title, data: app }));
  return <Tile ref={menuRef} kind="app" label={app.title} icon={<AppMark markSvg={app.markSvg} className={styles.mark} />} data-app-id={app.id} data-part="shell.nav.tile" data-pending={pending}
    aria-busy={pending || undefined} tabIndex={collapsed ? -1 : 0} aria-current={active ? "page" : undefined} title={chord ? `${app.title} (${chord})` : app.title}
    onClick={() => { useShellStore.getState().mountApp(app.id); onNavigate?.(); }} />;
}

export function Dock({ onNavigate, pendingAppId }: { onNavigate?: () => void; pendingAppId?: string } = {}): JSX.Element {
  const manifests = useShellStore(state => state.manifests);
  const activeAppId = useShellStore(state => state.activeAppId);
  const collapsed = useShellStore(state => state.dockSlim);
  const toggle = useShellStore(state => state.toggleDockSlim);
  const openOverlay = useShellStore(state => state.openOverlay);
  const lane = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLElement>(null);
  const restoreFocus = useRef(false);
  useLayoutEffect(() => {
    if (!collapsed) nav.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [activeAppId, collapsed]);
  const toggleDock = (): void => { restoreFocus.current = true; toggle(); };
  useLayoutEffect(() => {
    if (!restoreFocus.current) return;
    restoreFocus.current = false;
    const target = collapsed ? lane.current?.querySelector<HTMLButtonElement>('[aria-label="Show dock"]')
      : lane.current?.querySelector<HTMLButtonElement>('[aria-current="page"]') ?? lane.current?.querySelector<HTMLButtonElement>('[data-app-id]');
    target?.focus();
  }, [collapsed]);
  useLayoutEffect(() => {
    const shell = lane.current?.closest<HTMLElement>("#shell");
    const bar = nav.current;
    if (!shell || !bar) return;
    const reserve = (): void => { shell.style.setProperty("--bk-dock-reserve", collapsed || !bar.offsetHeight ? "0px" : `${bar.offsetHeight + Number.parseFloat(bar.ownerDocument.defaultView!.getComputedStyle(bar).bottom) + 8}px`); };
    reserve();
    const observer = new ResizeObserver(reserve);
    observer.observe(bar);
    window.addEventListener("resize", reserve);
    return () => { observer.disconnect(); window.removeEventListener("resize", reserve); shell.style.removeProperty("--bk-dock-reserve"); };
  }, [collapsed]);
  const groups = useMemo(() => dockManifestGroups(manifests), [manifests]);
  const roster = useMemo(() => appRoster(manifests), [manifests]);
  const mac = isMacLike(typeof navigator === "undefined" ? "" : navigator.platform);
  const tile = (app: AppManifestEntry) => {
    return <DockTile key={app.id} app={app} chord={chordFor(app.id, roster, mac)} collapsed={collapsed} pending={app.id === pendingAppId} onNavigate={onNavigate} />;
  };
  const moveFocus = (event: KeyboardEvent<HTMLElement>): void => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };
  return <div ref={lane} className={styles.lane} data-part="shell.nav" data-collapsed={collapsed}>
      <nav ref={nav} className={styles.bar} aria-label="Apps" aria-hidden={collapsed} inert={collapsed} onKeyDown={moveFocus}>
        <ThemeSlot id="shell.nav.start" />
        <div className={styles.apps}>{groups.present.map(tile)}{groups.foot.length > 0 && <span className={styles.divider} aria-hidden="true" />}{groups.foot.map(tile)}
          <Tile kind="app" label="Overlay" icon={<span className={styles.mark}><Ic name="lucide:layers" size={20} /></span>} data-part="shell.nav.overlay" tabIndex={collapsed ? -1 : 0}
            title="Overlay (Ctrl+K)" onClick={openOverlay} />
        </div>
        <ThemeSlot id="shell.nav.end" />
        <IconButton variant="quiet" size="sm" icon="lucide:chevron-down" label="Hide dock" tabIndex={collapsed ? -1 : 0} data-part="shell.nav.toggle" aria-expanded={!collapsed} onClick={toggleDock} />
      </nav>
      <IconButton variant="quiet" icon={<span aria-hidden="true" />} label="Show dock" data-part="shell.nav.handle" aria-hidden={!collapsed} tabIndex={collapsed ? 0 : -1} onClick={toggleDock} />
  </div>;
}
