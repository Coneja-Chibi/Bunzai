/**
 * The Messenger settings layer's content (approved wireframe messenger-discord/settings.html): three scopes, You, the
 * character and the scene, each a list of categories whose sections are the existing editors and rows, filed by where
 * each value is stored today. The shell opens one scope in the SettingsWindow (frames/settings-window.tsx).
 */
import type { SettingsDeepPage, SettingsScope } from "../frames/settings-window";
import type { WingArgs } from "../wing-props";
import { characterScope } from "./character-scope";
import { sceneScope } from "./scene-scope";
import { userDeep } from "./user/deep";
import { withSearchWords } from "./search-words";
import { userScope } from "./user-scope";

export type SettingsScopeId = "user" | "character" | "scene";

/** Opens a Messenger program (the shell opener: side panel, wide panel or workshop layer by its surface kind). */
export type OpenProgram = (programId: string) => void;

export interface MessengerSettings {
  scopes: Record<SettingsScopeId, SettingsScope>;
  resolveDeep(id: string): SettingsDeepPage | null;
}

export function useMessengerSettings(a: WingArgs, open: OpenProgram = () => undefined): MessengerSettings {
  const env = { ctx: a.ctx, repaint: a.repaint };
  return {
    scopes: { user: withSearchWords(userScope(a, env, open)), character: withSearchWords(characterScope(a, open)), scene: withSearchWords(sceneScope(a, open)) },
    resolveDeep: (id) => userDeep(a, id),
  };
}
