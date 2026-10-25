/**
 * "Historian summaries" under Advanced (RoleCall `CompendiumSettings.tsx:1470-1505`): Interval (every N of your turns, 0 is off) and
 * Context overlap (messages of lookback from where the last summary ended), the two numbers the Historian pass reads
 * (`studio/compendium-historian.ts`), and "Summary-aware context truncation" (off by default), which the assembler reads to send the recaps in
 * place of the oldest messages they cover (`core/assembly/summary-cut.ts`).
 */
import type { JSX } from "react";
import { RANGES } from "../../../../../../core/compendium";
import { SettingsSection, SettingsStepper, SettingsToggle } from "./parts";
import type { SectionProps } from "./deps";

export function HistorianSection({ compendium, set }: SectionProps): JSX.Element {
  const h = compendium.resolved.historian;
  return (
    <SettingsSection id="historian" title="Historian summaries" blurb="Periodically writes recaps of what happened, each belonging to a plot, with the plot's [Arc] overview. The recall pass picks which recaps are relevant per scene." dot="var(--bk-role-info)">
      <SettingsStepper label="Interval (your turns)" hint="Every N of your turns, the historian summarizes. 0 = disabled." value={h.interval} min={RANGES.interval[0]} max={RANGES.interval[1]} onChange={(n) => void set({ historian: { interval: n } })} />
      <SettingsStepper label="Context overlap" hint="Messages of lookback from the previous window. Helps the historian bridge events that span summary boundaries." value={h.overlap} min={RANGES.overlap[0]} max={RANGES.overlap[1]} onChange={(n) => void set({ historian: { overlap: n } })} />
      <SettingsToggle label="Summary-aware context truncation" hint="Drop older messages from the narrator's context once they've been summarized, freeing tokens for newer content" on={h.smartContext} onChange={(on) => void set({ historian: { smartContext: on } })} />
    </SettingsSection>
  );
}
