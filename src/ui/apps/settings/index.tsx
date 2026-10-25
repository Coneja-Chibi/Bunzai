/**
 * Settings - built entirely from DROP-IN SECTIONS (sections/registry): the tab bar derives from
 * the registry, each tab renders its section's controls, and every control is call-and-response
 * against the live settings (the shell applies theme/accent instantly). Adding a settings tab =
 * one file + one registry line; this room names no section.
 */
import { OverlayWidgets } from "./overlay";
import { useEffect, useState } from "react";
import { ThemeSlot } from "../../_shared/theme-slot";
import type { JSX } from "react";
import type { AppContext, BunrakuApp } from "../../app-contract";
import { parseLaunchTarget } from "../../_shared/launch-target";
import { settingsSections } from "./sections/registry";
import { SETTINGS_AGENT_SURFACE, usePublishSettingsSurface } from "./agent-surface";
import { SETTINGS_VARIANTS_STYLE } from "./variants-style";
import styles from "./styles.module.css";
import { icSvg } from "../../_shared/ic-svg";

/** the locked gear mark (vs-shell-apps) */
const MARK_SVG = icSvg("lucide:settings", 18);

function SettingsRoom({ ctx }: { ctx: AppContext }): JSX.Element | null {
  const sections = settingsSections();
  const launch = parseLaunchTarget(window.location.hash);
  const requestedId = launch?.appId === "settings" ? launch.sectionId : undefined;
  const initialId = sections.some((section) => section.id === requestedId)
    ? requestedId!
    : sections[0]?.id ?? "";
  const [activeId, setActiveId] = useState<string>(initialId);
  const active = sections.find((s) => s.id === activeId) ?? sections[0];

  useEffect(() => {
    const section = sections.find((s) => s.id === activeId) ?? sections[0];
    if (section) ctx.setStatus(section.label.toLowerCase());
  }, [ctx, activeId, sections]);

  // the agent window's live half: which tab is open and what is configured - never any secret on it
  usePublishSettingsSurface(ctx, {
    tabs: sections.map((s) => ({ id: s.id, label: s.label })),
    activeId: active?.id ?? "",
  });

  if (!active) return null;
  const ActiveSection = active.Component;

  return (
    <div className={styles.roomHost} data-part="settings.root">
    <style>{SETTINGS_VARIANTS_STYLE}</style>
    <div className={`${styles.room} scrollThin`} data-sx="room">
      <div className={styles.tabs} data-sx="tabs" data-part="settings.tabs">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            className={s.id === active.id ? `${styles.tab} ${styles.on}` : styles.tab}
            data-sx="tab"
            data-part="settings.tab"
            aria-current={s.id === active.id ? "page" : undefined}
            onClick={() => setActiveId(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className={styles.body} data-sx="body" data-part="settings.body">
        <ThemeSlot id="settings.header" />
        <ActiveSection ctx={ctx} />
      </div>
    </div>
    </div>
  );
}

const app: BunrakuApp = {
  OverlayWidgets,
  manifest: {
    id: "settings",
    title: "Settings",
    markSvg: MARK_SVG,
    accent: "#8a8496", // hardcode-ok: app identity accent, not theming
    order: 100,
    subtitle: "Preferences",
    dockFoot: true,
    agentSurface: SETTINGS_AGENT_SURFACE,
  },
  Component: SettingsRoom,
};

export default app;
