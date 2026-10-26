/**
 * Settings - built entirely from DROP-IN SECTIONS (sections/registry): the rail of acts derives from
 * the registry, each tab renders its section's controls under its own page head, and every control is
 * call-and-response against the live settings (the shell applies theme/accent instantly). Adding a
 * settings tab = one file + one registry line; this room names no section.
 */
import { OverlayWidgets } from "./overlay";
import { useEffect, useState } from "react";
import { Tabs } from "../../components/button";
import { Panel } from "../../components/panel";
import { RoomHeader } from "../../components/room-header";
import { ThemeSlot } from "../../_shared/theme-slot";
import type { JSX } from "react";
import type { AppContext, BunrakuApp } from "../../app-contract";
import { parseLaunchTarget } from "../../_shared/launch-target";
import { Ic } from "../../_shared/ic";
import { settingsSections } from "./sections/registry";
import { ProtectedLine, SETTINGS_ACTS, type SettingsSection } from "./section-contract";
import { SETTINGS_AGENT_SURFACE, usePublishSettingsSurface } from "./agent-surface";
import { SETTINGS_VARIANTS_STYLE } from "./variants-style";
import styles from "./styles.module.css";
import { icSvg } from "../../_shared/ic-svg";

/** the locked gear mark (vs-shell-apps) */
const MARK_SVG = icSvg("lucide:settings", 18);

/** One rail entry: the act line above the first tab of an act, the name, its live status and a lock on a protected tab. */
function railLabel(section: SettingsSection, status: string | undefined, firstOfAct: boolean): JSX.Element {
  return (
    <>
      {firstOfAct ? <span className={styles.act} aria-hidden="true">{SETTINGS_ACTS.find((a) => a.id === section.act)?.label}</span> : null}
      <span className={styles.lb}>
        <span className={styles.lbText}>
          <span>{section.label}</span>
          {status ? <small>{status}</small> : null}
        </span>
        {section.protectedNote ? <Ic name="lucide:lock" size={14} /> : null}
      </span>
    </>
  );
}

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
  // the shell hands the room a fresh ctx on every settings write, so each status line re-reads the pref it speaks for
  const items = sections.map((s, i) => {
    const status = s.status?.(ctx);
    return { value: s.id, label: railLabel(s, status, s.act !== sections[i - 1]?.act), title: [s.label, status, s.protectedNote ? "protected" : ""].filter(Boolean).join(", "), "data-part": "settings.tab" };
  });

  return (
    <div className={styles.roomHost} data-part="settings.root">
    <style>{SETTINGS_VARIANTS_STYLE}</style>
    <div className={`${styles.room} scrollThin`} data-sx="room">
      <RoomHeader data-part="settings.header" kicker="Bunraku · Preferences" title="Settings" lede="Every knob for the whole studio. There is no apply button: a change lands the moment you make it, unless its tab says when." />
      <div className={styles.shell}>
        <Panel as="aside" deck="preset" className={styles.rail} data-part="settings.rail">
          <div className={styles.tabs} data-sx="tabs" data-part="settings.tabs">
            <Tabs label="Settings sections" orientation="vertical" items={items} value={active.id} onChange={setActiveId} />
          </div>
        </Panel>
        <div className={styles.body} data-sx="body" data-part="settings.body">
          <ThemeSlot id="settings.header" />
          <header className={styles.pghead} data-part="settings.page-head">
            <span className={styles.kicker}>{SETTINGS_ACTS.find((a) => a.id === active.act)?.label}</span>
            <h2 className={styles.pgtitle}>{active.title}</h2>
            {active.lede ? <p className={styles.lede}>{active.lede}</p> : null}
          </header>
          {active.protectedNote ? <ProtectedLine>{active.protectedNote}</ProtectedLine> : null}
          <ActiveSection ctx={ctx} />
        </div>
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
