/** Temporary game-style app launcher over the mounted workspace, using host-owned navigation and import. */
import { useEffect, useRef, useState, type JSX } from "react";
import type { AppContext, BunrakuApp } from "../app-contract";
import { Button, Chip, IconButton, ListRow } from "../components/button";
import { DialogCore } from "../components/dialog-core";
import { AppMark } from "../components/app-mark";
import { AnimatedThemeToggler } from "../components/animated-theme-toggler";
import { requestImport } from "../_shared/import-signal";
import { isTopDialog } from "../_shared/use-escape-key";
import { TabStrip } from "./TabStrip";
import { StudioUpdate } from "./StudioUpdate";
import { effectiveThemeLabel } from "./status-bar-label";
import { useShellStore } from "./store";
import { presentedAppId } from "./store-navigation";
import styles from "./navigation-overlay.module.css";

function Overlay({ onClose, onNavigate, ctx, Widgets, onSurfaceTarget }: { onClose(): void; onNavigate(): void; ctx?: AppContext; Widgets?: BunrakuApp["OverlayWidgets"]; onSurfaceTarget?: (node: HTMLDivElement | null) => void }): JSX.Element {
  const manifests = useShellStore((s) => s.manifests);
  const activeAppId = useShellStore(presentedAppId);
  const mountApp = useShellStore((s) => s.mountApp);
  const theme = useShellStore((s) => s.theme);
  const appearance = useShellStore((s) => s.appearance);
  const studioCount = useShellStore((s) => s.studioCount);
  const toggleTheme = useShellStore((s) => s.toggleTheme);
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState<"app" | "import" | null>("app");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const importAction = useRef<HTMLButtonElement>(null);
  const apps = manifests.filter((m) => !m.comingSoon && `${m.title} ${m.subtitle ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const navigate = (id: string): void => { mountApp(id); setPanel("app"); };
  const activeApp = manifests.find((m) => m.id === activeAppId);
  const landing = manifests.find((m) => m.firstRunLanding && !m.comingSoon);
  const preferences = manifests.find((m) => m.dockFoot && !m.comingSoon);
  useEffect(() => { search.current?.focus(); }, []);
  return <DialogCore placement="fullscreen" ariaLabel="Studio overlay" onDismiss={onClose} portal
    overlayClassName={styles.scrim} className={styles.sheet} dismissOnScrim={false}>
    <div data-part="shell.overlay" className={styles.layout}>
      <header className={styles.header}><div><h2>Bunraku</h2><p>Overlay menu <kbd>Ctrl+K / Cmd+K</kbd></p></div>
        <StudioUpdate /><Button variant="quiet" onClick={onClose}>Close overlay <kbd>Esc</kbd> <span aria-hidden="true">&times;</span></Button></header>
      <section className={`${styles.panel} ${styles.quick}`} aria-label="Quick actions" data-part="shell.overlay.quick">
        <Chip onClick={() => setPanel("app")} pressed={panel === "app"}>Current app</Chip>
        <Chip ref={importAction} onClick={() => setPanel("import")} pressed={panel === "import"}>Import files</Chip>
        {preferences && <Chip onClick={() => navigate(preferences.id)}>Preferences</Chip>}
        <AnimatedThemeToggler theme={theme} onToggle={toggleTheme} />
      </section>
      <div className={styles.body}>
        <nav className={`${styles.panel} ${styles.launcher}`} aria-label="Launch an app" data-part="shell.overlay.apps">
          <header><h3>Apps</h3><p>Open a floating app</p></header>
          <input ref={search} type="search" aria-label="Find an app" placeholder="Find an app" value={query}
            onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter" && apps[0]) { e.preventDefault(); navigate(apps[0].id); }
              if (e.key === "ArrowDown") { e.preventDefault(); list.current?.querySelector("button")?.focus(); }
            }} />
          <div ref={list} className={styles.apps} onKeyDown={(e) => {
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
            const buttons = [...e.currentTarget.querySelectorAll("button")];
            const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
            e.preventDefault(); buttons[(at + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
          }}>
            {apps.map((m) => <ListRow key={m.id} label={m.title} subtitle={m.subtitle ?? "App"} leading={<AppMark markSvg={m.markSvg} className={styles.mark} />}
              selected={activeAppId === m.id} aria-current={activeAppId === m.id ? "page" : undefined} onClick={() => navigate(m.id)} />)}
          </div>
          {!apps.length && <p>No matching apps</p>}
        </nav>
        <div className={styles.floating}>
          <section hidden={panel !== "app"} className={`${styles.panel} ${styles.appWindow}`} data-part="shell.overlay.widget" data-overlay-app={activeAppId} aria-label={`${activeApp?.title ?? "App"} widget`}>
            <header className={styles.windowHeader}><h3>{activeApp?.title ?? "App"}</h3><Button size="sm" onClick={() => { useShellStore.getState().promoteOverlay(); onNavigate(); }}>Open full workspace</Button></header>
            <div ref={onSurfaceTarget} className={styles.appSurface} />
            {Widgets && ctx && <details className={styles.shortcuts} onToggle={(event) => setShortcutsOpen(event.currentTarget.open)}><summary>App shortcuts</summary>{panel === "app" && shortcutsOpen && <div className={styles.widgets} data-part="shell.overlay.widgets"><Widgets ctx={ctx} onActivate={() => setPanel("app")} /></div>}</details>}
          </section>
          {panel === "import" && <section className={`${styles.panel} ${styles.import}`} data-part="shell.overlay.import" aria-labelledby="overlay-import-title">
            <header><div><p>Quick actions</p><h3 id="overlay-import-title">Bring something into your library</h3></div><IconButton variant="quiet" size="sm" icon="lucide:x" label="Hide import panel" onClick={() => { setPanel(null); importAction.current?.focus(); }} /></header>
            <div className={styles.intake}><p>Choose files to inspect in the Library. Review the results before saving.</p>
              <Button variant="primary" disabled={!landing} onClick={() => {
                if (!landing) return;
                navigate(landing.id); requestImport();
              }}>Choose files</Button></div>
          </section>}
          {panel !== "app" && <p className={styles.note}>Your workspace stays beneath the overlay.</p>}
        </div>
      </div>
      <footer>Apps open here. Esc closes the overlay. <span aria-label="Studio summary">Theme {effectiveThemeLabel(appearance)} · Pieces {studioCount ?? "loading"}</span></footer>
    </div>
  </DialogCore>;
}

export function NavigationOverlay({ onNavigate, ctx, Widgets, onSurfaceTarget }: { onNavigate(): void; ctx?: AppContext; Widgets?: BunrakuApp["OverlayWidgets"]; onSurfaceTarget?: (node: HTMLDivElement | null) => void }): JSX.Element {
  const open = useShellStore((s) => s.overlayOpen);
  const openOverlay = useShellStore((s) => s.openOverlay);
  const closeOverlay = useShellStore((s) => s.closeOverlay);
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey || event.shiftKey ||
        event.ctrlKey === event.metaKey || event.key.toLowerCase() !== "k") return;
      if (document.querySelector("dialog[open]")) return;
      const modal = document.querySelector<HTMLElement>('[aria-label="Studio overlay"]');
      if (open ? !modal || !isTopDialog(modal) : document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      event.preventDefault(); if (open) closeOverlay(); else openOverlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, openOverlay, closeOverlay]);
  return <><TabStrip />{open && <Overlay onClose={closeOverlay} onNavigate={onNavigate} onSurfaceTarget={onSurfaceTarget} ctx={ctx} Widgets={Widgets} />}</>;
}
