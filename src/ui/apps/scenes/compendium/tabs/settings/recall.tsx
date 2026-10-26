/**
 * "Before a reply" and, under Advanced, "Retrieval tuning" (RoleCall `CompendiumSettings.tsx:1283-1397`): the switch for recall, what it should
 * prioritize (inline guidance, and a Guide from the Guides list in the place of RoleCall's Saved Prompt, 04b section 9), and the rows the recall
 * pass reads: how many entries, the least, how much of each entry the selector sees, how many recent messages, how deep its index groups, and how
 * several books are laid out. Every control writes the field `resolveCompendium` hands the pass, so what is shown is what is read.
 * Not drawn, because nothing reads it yet: Keyword hint matching, Condition evaluation reasoning, Search mode (recall is Collapsed only)
 * and reasoning effort.
 */
import { useEffect, useState, type JSX } from "react";
import { MAX_GUIDANCE, RANGES } from "../../../../../../core/compendium/defaults";
import { useDebouncedSave } from "../../../../../_shared/use-debounced-value";
import { SettingsSection, SettingsSegmented, SettingsStepper, SettingsToggle } from "./parts";
import type { SectionProps } from "./deps";

const DETAIL = [{ value: "names", label: "Names Only" }, { value: "taglines", label: "Names + Taglines" }, { value: "preview", label: "Names + Taglines + Preview" }] as const;
const DISPLAY = [{ value: "unified", label: "Unified" }, { value: "per_book", label: "Per-Book" }] as const;

export interface GuidanceCopy { title: string; hint: string; id: string }
const RECALL_COPY: GuidanceCopy = { title: "What should it prioritize?", hint: "Optional guidance for retrieval, such as prioritizing relationships, unresolved threats, or a particular setting.", id: "cps-recall-guide" };

/** RoleCall's PhaseGuidanceEditor (`:433-493`): inline guidance, and the Guide whose current text is sent first. Typing is saved once it rests, and when the tab closes. */
export function Guidance({ value, guide, guides, onText, onGuide, copy = RECALL_COPY }: { value: string; guide: string | undefined; guides: SectionProps["guides"]; onText(text: string): Promise<void>; onGuide(id: string | null): void; copy?: GuidanceCopy }): JSX.Element {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const save = useDebouncedSave<string>((t) => onText(t), 700, () => undefined);
  const usable = (guides ?? []).filter((g) => g.type === "guide" && g.visible);
  return (
    <div className="cps-box">
      <div>
        <span className="cps-lab">{copy.title}</span>
        <p className="cps-hint">{copy.hint}</p>
      </div>
      <textarea className="cps-ta" aria-label={copy.title} placeholder="Optional instructions for this phase" maxLength={MAX_GUIDANCE} value={text}
        onChange={(e) => { setText(e.target.value); save.push(e.target.value); }} onBlur={() => save.flush()} />
      <div>
        <label className="cps-lab" htmlFor={copy.id}>Saved Guide instructions</label>
        <select id={copy.id} className="cps-sel" value={guide ?? ""} onChange={(e) => onGuide(e.target.value || null)}>
          <option value="">None</option>
          {guide !== undefined && !usable.some((g) => g.id === guide) && <option value={guide}>A Guide that is no longer in your library</option>}
          {usable.map(/* bounded-ok: fields of one entry card, one run's summary, or capped by a SHOWN/LIMIT constant */ (g) => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
        <p className="cps-hint">At generation time, Compendium loads this Guide&apos;s current text and sends it to this agent phase. The inline instructions above come afterward.</p>
      </div>
    </div>
  );
}

export function RecallSection({ compendium, guides, set }: SectionProps): JSX.Element {
  const r = compendium.resolved.recall;
  return (
    <SettingsSection id="recall" title="Before a reply" blurb="Recall relevant people, places, facts, and prior events before the narrator writes." dot="var(--bk-role-info)">
      <SettingsToggle on={r.on} onChange={(on) => void set({ recall: { on } })} label="Recall from Compendium" hint="Find useful information from the enabled books before each reply." />
      <Guidance value={r.guidance} guide={r.guide} guides={guides}
        onText={(text) => set({ recall: { guidance: text.trim() === "" ? null : text } })}
        onGuide={(id) => void set({ recall: { guide: id } })} />
    </SettingsSection>
  );
}

export function TuningSection({ compendium, set }: SectionProps): JSX.Element {
  const r = compendium.resolved.recall;
  const put = (key: "maxEntries" | "minEntries" | "contextMessages" | "depth") => (n: number) => void set({ recall: { [key]: n } });
  return (
    <SettingsSection id="tuning" title="Retrieval tuning" blurb="Fine-tune how Compendium searches and how much context the retrieval pass receives." dot="var(--bk-role-info)">
      <SettingsStepper label="Max entries to retrieve" value={r.maxEntries} min={RANGES.maxEntries[0]} max={RANGES.maxEntries[1]} onChange={put("maxEntries")} />
      <SettingsStepper label="Minimum entries to retrieve" hint="If it returns fewer, it gets one more call demanding more. 0 = no minimum." value={r.minEntries} min={RANGES.minEntries[0]} max={RANGES.minEntries[1]} onChange={put("minEntries")} />
      <SettingsSegmented label="Entry detail level" hint="How much info per entry the selector sees in the tree index" value={r.detail} options={DETAIL} onChange={(detail) => void set({ recall: { detail } })} />
      <SettingsStepper label="Context messages" hint="Recent messages the selector sees when picking entries" value={r.contextMessages} min={RANGES.contextMessages[0]} max={RANGES.contextMessages[1]} onChange={put("contextMessages")} />
      <SettingsStepper label="Collapsed depth" hint="How many tree levels the selector sees at once. Higher = more context but more tokens." value={r.depth} min={RANGES.depth[0]} max={RANGES.depth[1]} onChange={put("depth")} />
      <SettingsSegmented label="Multi-book display" hint="How multiple lorebooks appear in the bucket overview" value={r.bookDisplay} options={DISPLAY} onChange={(bookDisplay) => void set({ recall: { bookDisplay } })} />
    </SettingsSection>
  );
}
