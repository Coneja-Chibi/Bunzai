/** RoleCall's persistent bottom-dock interaction, backed by Bunraku's discovered apps and host navigation. */
import { useLayoutEffect, useMemo, useRef, type JSX, type KeyboardEvent } from "react";
import type { AppManifestEntry } from "../app-contract";
import { AppMark } from "../components/app-mark";
import { Ic } from "../_shared/ic";
import { ThemeSlot } from "../_shared/theme-slot";
import { appRoster, chordFor, isMacLike } from "./app-keys";
import { dockManifestGroups } from "./dock-core";
import { useContextMenu, useShellStore } from "./store";
import styles from "./bottom-dock.module.css";

function DockTile({ app, chord, collapsed, pending, onNavigate }: { app: AppManifestEntry; chord: string | null; collapsed: boolean; pending: boolean; onNavigate?(): void }): JSX.Element {
  const active = useShellStore(state => state.activeAppId === app.id);
  const menuRef = useContextMenu(() => ({ type: "app", label: app.title, data: app }));
  return <button ref={menuRef} className={styles.app} data-app-id={app.id} data-part="shell.nav.tile" data-pending={pending} aria-busy={pending || undefined}
    tabIndex={collapsed ? -1 : 0} aria-label={app.title} aria-current={active ? "page" : undefined} title={chord ? `${app.title} (${chord})` : app.title}
    onClick={() => { useShellStore.getState().mountApp(app.id); onNavigate?.(); }}>
    {pending && <i className={styles.pending} aria-hidden="true" />}<AppMark markSvg={app.markSvg} className={styles.mark} /><span>{app.title}</span>
  </button>;
}

export function Dock({ onNavigate, pendingAppId }: { onNavigate?: () => void; pendingAppId?: string } = {}): JSX.Element {
  const manifests = useShellStore(state => state.manifests);
  const collapsed = useShellStore(state => state.dockSlim);
  const toggle = useShellStore(state => state.toggleDockSlim);
  const lane = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLElement>(null);
  const restoreFocus = useRef(false);
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
        <div className={styles.apps}>{groups.present.map(tile)}{groups.foot.length > 0 && <span className={styles.divider} aria-hidden="true" />}{groups.foot.map(tile)}</div>
        <ThemeSlot id="shell.nav.end" />
        <button className={styles.collapse} tabIndex={collapsed ? -1 : 0} data-part="shell.nav.toggle" aria-label="Hide dock" title="Hide dock" aria-expanded={!collapsed} onClick={toggleDock}>
          <Ic name="lucide:chevron-down" size={16} />
        </button>
      </nav>
      <button className={styles.handle} aria-label="Show dock" title="Show dock" aria-hidden={!collapsed} tabIndex={collapsed ? 0 : -1} onClick={toggleDock}><span aria-hidden="true" /></button>
  </div>;
}
