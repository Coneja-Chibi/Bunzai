/** The protected pages of the You scope: each holds one existing Settings-app form unchanged (keys, connections, security and health, copies and Restore, the Spotify link, theme packages), reached only by a drill row. */
import type { SettingsDeepPage } from "../../frames/settings-window";
import type { WingArgs } from "../../wing-props";
import { StudioTool, ThemeTool } from "../bodies";

const PAGES: Readonly<Record<string, { title: string; section: string; description?: string }>> = {
  "user.models": { title: "Providers and keys", section: "models", description: "A saved key is never shown again." },
  "user.connections": { title: "Connections", section: "connections" },
  "user.security": { title: "Security and health", section: "security" },
  "user.backups": { title: "Copies", section: "backups", description: "Your library is stored on this computer." },
  "user.spotify": { title: "Spotify link", section: "spotify" },
};

export function userDeep(a: WingArgs, id: string): SettingsDeepPage | null {
  if (id === "user.themes") return { title: "Theme packages", sections: [{ id: "themes", title: "Theme packages", body: <ThemeTool a={a} /> }] };
  const page = PAGES[id];
  if (!page) return null;
  return { title: page.title, sections: [{ id: page.section, title: page.title, ...(page.description ? { description: page.description } : {}), body: <StudioTool a={a} id={page.section} /> }] };
}
