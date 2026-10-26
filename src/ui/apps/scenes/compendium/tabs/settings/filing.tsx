/**
 * "After a reply" (RoleCall `CompendiumSettings.tsx` after-a-reply card, rc-world-comp-settings.png) and, under Advanced, "What
 * Compendium may file" (`lib/lorebook/setting-options.ts:2-14`): the switch for filing, what it should preserve (inline guidance and a
 * Guide), how often (every N of the person's turns), when (RoleCall's "Wait before filing", here a plain choice whose default is the
 * person's next message and whose other end is right away), and the eleven entry types it may write.
 * Every control writes the field `resolveCompendium` hands the filing pass (`studio/compendium-filing.ts`, `compendium-hooks.ts`), so
 * what is shown is what is read.
 */
import type { JSX } from "react";
import { ENTRY_TYPES, ENTRY_TYPE_INFO, RANGES, type EntryType } from "../../../../../../core/compendium";
import { Guidance } from "./recall";
import { SettingsField, SettingsSection, SettingsStepper, SettingsSwitch, SettingsToggle } from "./parts";
import type { SectionProps } from "./deps";

const COPY = { title: "What should it preserve?", hint: "Optional guidance for filing, such as tracking relationships, promises, or injuries. It cannot widen what Compendium may write.", id: "cps-filing-guide" };
const WHEN = ["Right away", "On your next message", ...[2, 3, 4, 5].map((n) => `After ${n} more messages`)];

export function FilingSection({ compendium, guides, set }: SectionProps): JSX.Element {
  const f = compendium.resolved.filing;
  return (
    <SettingsSection id="filing" title="After a reply" blurb="Record lasting changes in the books you allowed it to write to, after the reply." dot="var(--bk-role-warn)">
      <SettingsToggle on={f.on} onChange={(on) => void set({ filing: { on } })} label="File lasting changes" hint="Add what lasted from a reply to the books that allow writing. It never removes an entry, and every filing can be undone from Activity." />
      <Guidance value={f.guidance} guide={f.guide} guides={guides} copy={COPY}
        onText={(text) => set({ filing: { guidance: text.trim() === "" ? null : text } })}
        onGuide={(id) => void set({ filing: { guide: id } })} />
      <SettingsStepper label="How often (every N of your turns)" hint="1 files after every turn of yours." value={f.everyN} min={RANGES.everyN[0]} max={RANGES.everyN[1]} onChange={(n) => void set({ filing: { everyN: n } })} />
      <SettingsField label="When to file" hint="Filing on your next message means the reply you are most likely to regenerate has nothing to undo. Cutting or regenerating a filed reply takes its filings back.">
        <select className="cps-sel" aria-label="When to file" value={f.wait} onChange={(e) => void set({ filing: { wait: Number(e.target.value) } })}>
          {WHEN.map(/* bounded-ok: fields of one entry card, one run's summary, or capped by a SHOWN/LIMIT constant */ (label, wait) => <option key={wait} value={wait}>{label}</option>)}
        </select>
      </SettingsField>
    </SettingsSection>
  );
}

export function AllowSection({ compendium, set }: SectionProps): JSX.Element {
  const allowed = new Set<EntryType>(compendium.resolved.filing.allow);
  const flip = (type: EntryType) => (on: boolean) => {
    const next = ENTRY_TYPES.filter((t) => (t === type ? on : allowed.has(t)));
    void set({ filing: { allow: next } });
  };
  return (
    <SettingsSection id="allow" title="What Compendium may file" blurb="Choose which kinds of entry it is allowed to create or add to." dot="var(--bk-role-warn)">
      {ENTRY_TYPES.map((type) => <SettingsSwitch key={type} on={allowed.has(type)} onChange={flip(type)} label={ENTRY_TYPE_INFO[type].label} />)}
    </SettingsSection>
  );
}
