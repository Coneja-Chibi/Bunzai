/**
 * Mounts one scope of the Messenger's settings layer (frames/settings-window.tsx draws it inside its own Layer) from the content hook (settings/scopes.tsx). The hook needs the open scene's
 * wing arguments, so this component exists only while a scope is open and the scene is loaded; the shell takes it as a render prop and never imports the settings content itself.
 */
import type { JSX } from "react";
import { SettingsWindow } from "../frames/settings-window";
import { useMessengerSettings, type OpenProgram, type SettingsScopeId } from "../settings/scopes";
import type { WingArgs } from "../wing-props";

export function SettingsHost({ args, scope, onClose, onOpen }: { args: WingArgs; scope: SettingsScopeId; onClose(): void; onOpen: OpenProgram }): JSX.Element {
  const settings = useMessengerSettings(args, onOpen);
  return <SettingsWindow scope={settings.scopes[scope]} resolveDeep={settings.resolveDeep} onClose={onClose} />;
}
