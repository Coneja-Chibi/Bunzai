/**
 * The Compendium's one switch for the scene. RoleCall has none on its Settings page (its `tv_enabled` is flipped by slash commands and
 * loadouts only, 04b F19); here it is the first row, and off until the person turns it on. While it is off nothing is read or sent.
 */
import type { JSX } from "react";
import { SettingsSection, SettingsToggle } from "./parts";
import type { SectionProps } from "./deps";

export function MasterSection({ compendium, set }: SectionProps): JSX.Element {
  return (
    <SettingsSection id="master" title="Compendium" blurb="Turn the Compendium on for this scene. It is off until you do.">
      <SettingsToggle on={compendium.resolved.on} onChange={(on) => void set({ on })} label="Use Compendium in this scene"
        hint="Reads the books below before each reply. Nothing is read or sent while this is off." />
    </SettingsSection>
  );
}
