/**
 * The You scope of the Messenger settings (approved wireframe messenger-discord/settings.html, SCOPES.user): what belongs to the person across every scene, as rows only. Preference rows are the
 * table in rows.ts and user/pref-rows.ts; the persona, the scene's model, the track library and the player are drill rows that open their Messenger program; the keys, connections, security,
 * copies and Restore, the Spotify link and the theme packages are protected forms on their own deep pages (user/deep.tsx). Rows the wireframe drew that nothing backs yet (the backup schedule) are left out until their own feature slice.
 */
import type { JSX } from "react";
import { STAGE_TABS } from "../../scene-stage-wing";
import type { SettingsCategory, SettingsScope } from "../frames/settings-window";
import type { WingArgs } from "../wing-props";
import type { OpenProgram } from "./scopes";
import { RowList } from "./row-view";
import { USER_ROWS as R, type RowDef, type RowEnv } from "./rows";
import { ColourRows, ThemeRows } from "./user/appearance";
import { ConnectionRows } from "./user/connection";
import { DataRows } from "./user/data";
import { DesktopNoticeRow } from "./user/desktop-notice";
import { MusicDrills, SpotifyRows } from "./user/music";
import { ACCESS_ROWS, MUSIC_ROWS } from "./user/pref-rows";
import { ProfileRows } from "./user/profile";
import { BudgetRows } from "./user/budget-rows";
import { MachineRows, PublishRows, StudioRows, SummaryRows, WorkbenchRows } from "./user/studio";

const rows = (env: RowEnv, ...defs: RowDef[]): JSX.Element => <RowList rows={defs} env={env} />;

export function userScope(a: WingArgs, env: RowEnv, open: OpenProgram): SettingsScope {
  const shown = (id: string): boolean => STAGE_TABS.some((t) => t.id === id && t.visible({ scene: a.scene, propsOn: a.propsOn, prefs: a.ctx.prefs }));
  const categories: SettingsCategory[] = [
    { id: "profile", label: "My profile", icon: "lucide:user-round", sections: [
      { id: "persona", title: "Persona", description: "Who you play across every scene.", body: <ProfileRows a={a} open={open} /> },
    ] },
    { id: "connection", label: "AI connection", icon: "lucide:plug", sections: [
      { id: "providers", title: "Provider", description: "Where requests are sent.", body: <ConnectionRows open={open} /> },
    ] },
    { id: "notifications", label: "Notifications", icon: "mdi:bell-outline", sections: [
      { id: "away", title: "While you are away", body: <>{rows(env, R.chime, R.typing)}<DesktopNoticeRow a={a} /></> },
    ] },
    { id: "data", label: "Data and backups", icon: "lucide:save", sections: [
      { id: "backups", title: "Backups", description: "Your library is stored on this computer.", body: <DataRows /> },
    ] },
    { id: "appearance", label: "Appearance", icon: "lucide:palette", group: "Experience", sections: [
      { id: "layout", title: "Chat layout", body: rows(env, R.layout) },
      { id: "message", title: "The message", description: "How each message is drawn.", body: rows(env, R.avatars, R.timestamps, R.opacity, R.gap) },
      { id: "type", title: "The type", description: "Font, size, spacing and colour of message text.", body: <>{rows(env, R.font, R.size, R.lineHeight)}<ColourRows a={a} env={env} part="text" /></> },
      { id: "motion", title: "Motion and signals", description: "Auto-scroll and reasoning.", body: rows(env, R.autoScroll, R.fadeIn, R.autoOpenReasoning, R.capReasoning) },
      { id: "chrome", title: "Chrome", body: rows(env, R.compact) },
      { id: "accent", title: "Colour", body: <ColourRows a={a} env={env} part="accent" /> },
      { id: "theme", title: "Theme", body: <ThemeRows env={env} /> },
    ] },
    { id: "access", label: "Accessibility", icon: "lucide:eye", group: "Experience", sections: [
      { id: "reading", title: "Reading", description: "Applies across the whole studio.", body: rows(env, ...ACCESS_ROWS) },
    ] },
    { id: "music", label: "Music and Spotify", icon: "lucide:music", group: "Experience", sections: [
      { id: "mood", title: "Music", description: "Mood music for scenes.", body: <>{rows(env, R.volume, ...MUSIC_ROWS)}<MusicDrills open={open} library={shown("music")} /></> },
      { id: "spotify", title: "Spotify", body: <SpotifyRows ctx={a.ctx} open={open} player={shown("spotify")} /> },
    ] },
    { id: "studio", label: "Studio", icon: "lucide:settings", group: "Studio", sections: [
      { id: "studio", title: "Studio", description: "Your home app and where the Library opens.", body: <StudioRows env={env} /> },
      { id: "publish", title: "You publish to", description: "Pick any that fit. Every format stays ready either way.", body: <PublishRows ctx={a.ctx} /> },
      { id: "workbench", title: "Workbench", body: <WorkbenchRows env={env} /> },
      { id: "memory", title: "Memory and summaries", description: "The summary settings new scenes start with.", body: <SummaryRows ctx={a.ctx} /> },
      { id: "budgets", title: "Time budgets", description: "How long a reply's tools and a prompt build's macros may take.", body: <BudgetRows ctx={a.ctx} /> },
      { id: "machine", title: "This computer", description: "Opens in the Settings app.", body: <MachineRows ctx={a.ctx} /> },
    ] },
  ];
  return { id: "user", title: "You", categories };
}
