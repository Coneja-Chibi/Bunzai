/**
 * The Compendium page's maintenance settings (Full Chat: Compendium > Settings > Advanced; tree.tsx, historian.tsx, ingest.tsx, standardize.tsx): how the tree is built, the Historian's recaps, the import of chat history
 * and the defaults the Standardize run starts from. Every row writes the field the run resolves (`treeBuild`, `historian`, `ingest`, `standardize`) through the Settings tab's own patch (compendium-env.ts); ranges,
 * options and defaults are the Settings tab's constants. The runs themselves (Import messages with its range and progress, Revert last standardization, the tree's locks) act on the book open in the Compendium, so each
 * is a drill row to the Compendium program. "Preserve original content" is always on, so it has no row.
 */
import type { JSX } from "react";
import { RANGES } from "../../../../../../core/compendium";
import { GRANULARITY, PLACEMENT, TREE_DETAIL } from "../../../compendium/tabs/settings/tree";
import { INGEST_MODELS_OPTIONS } from "../../../compendium/tabs/settings/ingest";
import { DrillRow, SegmentedRow, SelectRow } from "../../frames/settings-rows";
import type { WingArgs } from "../../wing-props";
import type { OpenProgram } from "../scopes";
import { useCompendiumSet } from "./compendium-env";
import { SavedNumber, SavedSlider, SavedToggle } from "./saved";

const choices = (list: readonly (readonly [string | number, string])[]): { value: string; label: string }[] => list.map(([value, label]) => ({ value: String(value), label }));

/** Tree building: granularity, entry detail, placement and refine, and the way to the locks and pins kept on the open book. */
export function TreeRows({ a, open }: { a: WingArgs; open: OpenProgram }): JSX.Element {
  const { compendium, set } = useCompendiumSet(a);
  const t = compendium.resolved.treeBuild;
  return (
    <>
      <SelectRow label="Granularity" description="How aggressively the model splits entries into sub-categories." value={String(t.granularity)} options={choices(GRANULARITY)}
        onChange={(v) => void set({ treeBuild: { granularity: Number(v) as 0 | 1 | 2 | 3 | 4 } })} />
      <SelectRow label="Entry detail level" description="How much entry info the model sees during categorization." value={t.detail} options={choices(TREE_DETAIL)} onChange={(detail) => void set({ treeBuild: { detail: detail as typeof t.detail } })} />
      <SavedToggle label="Refine entries during build" description="The model splits multi-topic entries into focused pieces and merges duplicates after categorization. Slower build, better organization." saved={t.refine} write={(refine) => set({ treeBuild: { refine } })} />
      <SelectRow label="Placement mode" description="How the builder schedules placement passes on a book too big for one call." value={t.placement} options={choices(PLACEMENT)} onChange={(placement) => void set({ treeBuild: { placement: placement as typeof t.placement } })} />
      <DrillRow label="Tree and entry constraints" description="The branches and entries you locked, forbade or moved in a book." onOpen={() => open("compendium")} />
    </>
  );
}

/** Historian summaries: interval, context overlap and summary-aware truncation. */
export function HistorianRows({ a }: { a: WingArgs }): JSX.Element {
  const { compendium, set } = useCompendiumSet(a);
  const h = compendium.resolved.historian;
  // clone-ok: a row table for its own settings group; it shares the shape of the filing rows, not their fields or writer path
  return (
    <>
      <SavedNumber label="Interval (your turns)" description="Every N of your turns, the historian summarizes. 0 means off." saved={h.interval} min={RANGES.interval[0]} max={RANGES.interval[1]} write={(interval) => set({ historian: { interval } })} />
      <SavedNumber label="Context overlap" description="Messages of lookback from the previous window, so events that span a summary boundary are bridged." saved={h.overlap} min={RANGES.overlap[0]} max={RANGES.overlap[1]} write={(overlap) => set({ historian: { overlap } })} />
      <SavedToggle label="Summary-aware context truncation" description="Drop older messages from the narrator's context once they have been summarized, freeing tokens for newer content." saved={h.smartContext} write={(smartContext) => set({ historian: { smartContext } })} />
    </>
  );
}

/** Import chat history: the options the run reads, and the way to the run itself. */
export function IngestRows({ a, open }: { a: WingArgs; open: OpenProgram }): JSX.Element {
  const { compendium, set } = useCompendiumSet(a);
  const i = compendium.resolved.ingest;
  const put = (field: Partial<typeof i>): Promise<void> => set({ ingest: field });
  return (
    <>
      <SavedToggle label="Cross-chunk continuity" description="Send the previous chunk's entries to the next chunk so the model does not write the same characters or locations twice." saved={i.continuity} write={(continuity) => put({ continuity })} />
      <SegmentedRow label="Ingest model" description="Which model processes chat messages into typed entries." value={i.model} options={INGEST_MODELS_OPTIONS} onChange={(model) => void put({ model })} />
      <SavedSlider label="Tokens per chunk" description="How much context the ingest model sees per call. Bigger means fewer calls but more cost per call." saved={i.chunkTokens} min={RANGES.chunkTokens[0]} max={RANGES.chunkTokens[1]} step={1000} write={(chunkTokens) => put({ chunkTokens })} />
      <SavedToggle label="Search phase" description="Discover existing entries before writing new ones, which prevents duplicates." saved={i.search} write={(search) => put({ search })} />
      <SavedToggle label="Facts phase" description="Extract characters, locations, items, organizations, abilities and relationships." saved={i.facts} write={(facts) => put({ facts })} />
      <SavedToggle label="Narrative phase" description="Summarize scenes, create plots and organize entries into arcs." saved={i.narrative} write={(narrative) => put({ narrative })} />
      <DrillRow label="Import messages" description="Pick a message range and run the import into the open book." onOpen={() => open("compendium")} />
    </>
  );
}

const SOURCES = [{ value: "compendium", label: "Compendium model" }, { value: "scene", label: "Narrator" }] as const;

/** Standardization defaults: batch size, model source and retry, and the way to the run and its revert. */
export function StandardizeRows({ a, open }: { a: WingArgs; open: OpenProgram }): JSX.Element {
  const { compendium, set } = useCompendiumSet(a);
  const s = compendium.resolved.standardize;
  return (
    <>
      <SavedNumber label="Default batch size" description="How many entries the model converts per call. Larger means fewer calls, but risks overflowing the model's window on a huge lorebook." saved={s.batchSize} min={RANGES.batchSize[0]} max={RANGES.batchSize[1]} step={5} write={(batchSize) => set({ standardize: { batchSize } })} />
      <SegmentedRow label="Default model source" description="Which model runs the conversion: the one chosen under Compendium model, or the scene's own." value={s.modelSource} options={SOURCES} onChange={(modelSource) => void set({ standardize: { modelSource } })} />
      <SavedToggle label="Auto-retry failed entries once" description="Entries that come back unusable get one more try before they are left as written." saved={s.autoRetry} write={(autoRetry) => set({ standardize: { autoRetry } })} />
      <DrillRow label="Standardize and revert" description="Run it from the Dashboard, or revert the last run on a book. Every run keeps the original text of what it rewrites." onOpen={() => open("compendium")} />
    </>
  );
}
