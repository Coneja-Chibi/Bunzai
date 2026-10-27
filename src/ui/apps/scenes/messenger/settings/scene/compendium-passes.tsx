/**
 * The Compendium page's two passes (Full Chat: Compendium > Settings, recall.tsx and filing.tsx): "Before a reply" (recall, its guidance and Guide, and Retrieval tuning) and "After a reply" (filing, its guidance
 * and Guide, how often, when, and the entry types it may file). Every row writes the field `resolveCompendium` hands the pass, through the Settings tab's own patch (compendium-env.ts); ranges, options and
 * defaults are the Settings tab's constants (`RANGES`, `MAX_GUIDANCE`, RECALL_DETAIL, WHEN).
 */
import { useEffect, useState, type JSX } from "react";
import { ENTRY_TYPES, ENTRY_TYPE_INFO, MAX_GUIDANCE, RANGES, type EntryType } from "../../../../../../core/compendium";
import type { GuideRecord } from "../../../../../../core/guide-record";
import type { AppContext } from "../../../../../app-contract";
import { WHEN } from "../../../compendium/tabs/settings/filing";
import { RECALL_DETAIL, RECALL_DISPLAY } from "../../../compendium/tabs/settings/recall";
import { SegmentedRow, SelectRow } from "../../frames/settings-rows";
import type { WingArgs } from "../../wing-props";
import { CheckedText } from "./drafts";
import { useCompendiumSet } from "./compendium-env";
import { SavedNumber, SavedToggle } from "./saved";

/** The Guides a pass may take, as the Settings tab reads them; null until read, an empty list when they could not be. */
function useGuides(ctx: AppContext): readonly GuideRecord[] | null {
  const [guides, setGuides] = useState<readonly GuideRecord[] | null>(null);
  useEffect(() => {
    let live = true;
    ctx.api.listGuides().then((g) => live && setGuides(g), () => live && setGuides([]));
    return () => { live = false; };
  }, [ctx]);
  return guides;
}

interface GuidanceProps { ctx: AppContext; title: string; hint: string; guidance: string; guide: string | undefined; onText(text: string | null): Promise<void>; onGuide(id: string | null): Promise<void> }

/** A pass's inline guidance (saved once it rests, blank means none) and the Guide whose current text is sent first. */
function GuidanceRows({ ctx, title, hint, guidance, guide, onText, onGuide }: GuidanceProps): JSX.Element {
  const guides = useGuides(ctx);
  const usable = (guides ?? []).filter((g) => g.type === "guide" && g.visible);
  const options = [{ value: "", label: "None" }, ...(guide !== undefined && !usable.some((g) => g.id === guide) ? [{ value: guide, label: "A Guide that is no longer in your library" }] : []), ...usable.map((g) => ({ value: g.id, label: g.title }))];
  return (
    <>
      <CheckedText label={title} description={hint} saved={guidance} rows={4} delay={700}
        check={(t) => (t.length > MAX_GUIDANCE ? `Use at most ${MAX_GUIDANCE.toLocaleString()} characters.` : null)} write={(t) => onText(t.trim() === "" ? null : t)} />
      <SelectRow label={`${title} Guide`} description="The Guide's current text is sent to this pass first; the guidance above comes afterward." value={guide ?? ""} options={options} onChange={(id) => void onGuide(id === "" ? null : id)} />
    </>
  );
}

/** Before a reply: recall on, what to prioritize, and the Guide. */
export function RecallRows({ a }: { a: WingArgs }): JSX.Element {
  const { ctx, compendium, set } = useCompendiumSet(a);
  const r = compendium.resolved.recall;
  return (
    <>
      <SavedToggle label="Recall from Compendium" description="Find useful information from the enabled books before each reply." saved={r.on} write={(on) => set({ recall: { on } })} />
      <GuidanceRows ctx={ctx} title="What should it prioritize?" hint="Optional guidance for retrieval, such as prioritizing relationships, unresolved threats, or a particular setting." guidance={r.guidance} guide={r.guide}
        onText={(guidance) => set({ recall: { guidance } })} onGuide={(guide) => set({ recall: { guide } })} />
    </>
  );
}

/** Retrieval tuning: how many entries, how much of each, how many recent messages, how deep, and how several books are laid out. */
export function TuningRows({ a }: { a: WingArgs }): JSX.Element {
  const { compendium, set } = useCompendiumSet(a);
  const r = compendium.resolved.recall;
  const put = (key: "maxEntries" | "minEntries" | "contextMessages" | "depth") => (n: number): Promise<void> => set({ recall: { [key]: n } });
  return (
    <>
      <SavedNumber label="Max entries to retrieve" saved={r.maxEntries} min={RANGES.maxEntries[0]} max={RANGES.maxEntries[1]} write={put("maxEntries")} />
      <SavedNumber label="Minimum entries to retrieve" description="If it returns fewer, it gets one more call demanding more. 0 means no minimum." saved={r.minEntries} min={RANGES.minEntries[0]} max={RANGES.minEntries[1]} write={put("minEntries")} />
      <SelectRow label="Entry detail level" description="How much info per entry the selector sees in the tree index." value={r.detail} options={RECALL_DETAIL} onChange={(detail) => void set({ recall: { detail } })} />
      <SavedNumber label="Context messages" description="Recent messages the selector sees when picking entries." saved={r.contextMessages} min={RANGES.contextMessages[0]} max={RANGES.contextMessages[1]} write={put("contextMessages")} />
      <SavedNumber label="Collapsed depth" description="How many tree levels the selector sees at once. Higher means more context but more tokens." saved={r.depth} min={RANGES.depth[0]} max={RANGES.depth[1]} write={put("depth")} />
      <SegmentedRow label="Multi-book display" description="How several lorebooks appear in the bucket overview." value={r.bookDisplay} options={RECALL_DISPLAY} onChange={(bookDisplay) => void set({ recall: { bookDisplay } })} />
    </>
  );
}

const WHEN_OPTIONS = WHEN.map((label, i) => ({ value: String(i), label }));

/** After a reply: filing on, what to preserve, the Guide, how often and when. */
export function FilingRows({ a }: { a: WingArgs }): JSX.Element {
  const { ctx, compendium, set } = useCompendiumSet(a);
  const f = compendium.resolved.filing;
  return (
    <>
      <SavedToggle label="File lasting changes" description="Add what lasted from a reply to the books that allow writing. It never removes an entry, and every filing can be undone from Activity." saved={f.on} write={(on) => set({ filing: { on } })} />
      <GuidanceRows ctx={ctx} title="What should it preserve?" hint="Optional guidance for filing, such as tracking relationships, promises, or injuries. It cannot widen what Compendium may write." guidance={f.guidance} guide={f.guide}
        onText={(guidance) => set({ filing: { guidance } })} onGuide={(guide) => set({ filing: { guide } })} />
      <SavedNumber label="How often (every N of your turns)" description="1 files after every turn of yours." saved={f.everyN} min={RANGES.everyN[0]} max={RANGES.everyN[1]} write={(n) => set({ filing: { everyN: n } })} />
      <SelectRow label="When to file" description="Filing on your next message means the reply you are most likely to regenerate has nothing to undo." value={String(f.wait)} options={WHEN_OPTIONS} onChange={(wait) => void set({ filing: { wait: Number(wait) } })} />
    </>
  );
}

/** What Compendium may file: one switch per entry type. */
export function AllowRows({ a }: { a: WingArgs }): JSX.Element {
  const { compendium, set } = useCompendiumSet(a);
  const allowed = new Set<EntryType>(compendium.resolved.filing.allow);
  const flip = (type: EntryType) => (on: boolean): Promise<void> => set({ filing: { allow: ENTRY_TYPES.filter((t) => (t === type ? on : allowed.has(t))) } });
  return <>{ENTRY_TYPES.map((type) => <SavedToggle key={type} label={ENTRY_TYPE_INFO[type].label} saved={allowed.has(type)} write={flip(type)} />)}</>;
}
