/**
 * Settings section: Appearance - theme, house accent, and the chat layout (chat-layout-row.tsx). Both apply LIVE on pick (call and
 * response through ctx.prefs; the shell repaints). The accent uses the shared SwatchRow (the same
 * picker the setup wizard uses; entity accents get their own in the editor).
 */
import { useState } from "react";
import type { JSX } from "react";
import type { AppContext } from "../../../app-contract";
import { SETTING_KEYS } from "../../../../studio/settings-shape";
import { HOUSE_PALETTE, SwatchRow } from "../../../components/swatch-row";
import { SettingsRow, type SettingsSection } from "../section-contract";
import { AccessibilityRows } from "./accessibility-rows";
import { ChatLayoutRow } from "./chat-layout-row";
import { StageLightsRow } from "./stage-lights-row";
import { ThemeManager } from "./theme-manager";

function AppearanceSection({ ctx }: { ctx: AppContext }): JSX.Element {
  const [accent, setAccent] = useState<string | undefined>(() => {
    const a = ctx.prefs.get(SETTING_KEYS.houseAccent);
    return typeof a === "string" ? a : undefined;
  });

  return (
    <>
      <ThemeManager ctx={ctx} />
      <SettingsRow label="Your color" hint="The workspace accent. Entity colors stay independent.">
        <SwatchRow
          palette={HOUSE_PALETTE}
          value={accent}
          allowCustom
          onChange={(hex) => {
            ctx.prefs.set(SETTING_KEYS.houseAccent, hex);
            setAccent(hex);
          }}
        />
      </SettingsRow>
      <ChatLayoutRow prefs={ctx.prefs} />
      <StageLightsRow prefs={ctx.prefs} />
      <AccessibilityRows prefs={ctx.prefs} />
    </>
  );
}

const section: SettingsSection = {
  id: "appearance",
  act: "studio",
  title: "How it looks",
  lede: "Theme, your color, the chat layout, the stage lights and the accessibility knobs. Each one applies live.",
  status: (ctx) => ctx.appearance.get().name ?? "Host default",
  label: "Appearance",
  order: 10,
  Component: AppearanceSection,
};

export default section;
