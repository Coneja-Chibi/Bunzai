/**
 * The tool-shaped section bodies of the Messenger settings pages: each is a component that already exists, placed and never copied. A scene tool is a wing's `single` body (the same
 * `wingPanels` and `WingPanel` the Messenger programs draw, one tab with no tab bar); a studio tool is a Settings-app section component; a Prop's own panel is the pop-out slot.
 */
import type { JSX } from "react";
import { SamplerHistoryContext } from "../../sampler-history";
import { WingPanel } from "../../scene-wings";
import { PopoutSlot } from "../../popout/popout-host";
import { settingsSections } from "../../../settings/sections/registry";
import { ThemeManager } from "../../../settings/sections/theme-manager";
import type { SceneProp } from "../../props/prop-contract";
import { wingPanels, type WingArgs } from "../wing-props";

/** One tab of one wing, drawn alone. `tab` is a Messenger program's tab (messenger/programs.ts); a wing with a single body takes none. */
export function SceneTool({ a, wing, tab }: { a: WingArgs; wing: string; tab?: string }): JSX.Element {
  const history = { messages: a.scene.messages, total: a.scene.messageCount };
  return (
    <div data-part="scene.messenger.settings.tool" data-tool={tab ? `${wing}.${tab}` : wing}>
      <SamplerHistoryContext.Provider value={history}>
        <WingPanel id={wing} {...(tab ? { tab } : {})} bare single {...wingPanels(a, tab, true)} />
      </SamplerHistoryContext.Provider>
    </div>
  );
}

/** One Settings-app section (models, backups, security...) as it stands there. Nothing renders if the registry has no such section. */
export function StudioTool({ a, id }: { a: WingArgs; id: string }): JSX.Element | null {
  const section = settingsSections().find((s) => s.id === id);
  return section ? <div data-part="scene.messenger.settings.studio" data-tool={id}><section.Component ctx={a.ctx} /></div> : null;
}

export function ThemeTool({ a }: { a: WingArgs }): JSX.Element {
  return <div data-part="scene.messenger.settings.studio" data-tool="theme"><ThemeManager ctx={a.ctx} /></div>;
}

/** A Prop's own panel while the Prop is on (Story Director, the trackers). */
export function PropTool({ a, prop }: { a: WingArgs; prop: SceneProp }): JSX.Element | null {
  if (!prop.panel) return null;
  return <div data-part="scene.messenger.settings.tool" data-tool={`prop-${prop.id}`}><PopoutSlot kind={prop.panel} ctx={a.ctx} chat={a.scene.chat} onChat={(chat) => a.setScene((s) => (s ? { ...s, chat } : s))} /></div>;
}
