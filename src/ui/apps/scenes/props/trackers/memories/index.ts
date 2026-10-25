/**
 * Memories, RoleCall's `memoryJournal` tracker (Legacy Trackers, builtin-catalog.ts LEGACY_TRACKER_MODULES): per-character remembered moments and emotional
 * history. Registered through props/trackers/legacy.ts; the state is ChatStore rule 43's `memories`, the rules are core/trackers/memories.ts.
 */
import { trackerProp } from "../tracker-prop";
import { MemoriesPanel } from "./memories-panel";

export const memoriesProp = trackerProp({
  module: "memories",
  name: "Memories",
  blurb: "Per-character remembered moments and emotional history.",
  icon: "lucide:brain",
  tone: "color-mix(in srgb,var(--stage-danger-text) 50%,var(--stage-macro))",
  group: "legacy",
  reach: "model",
  title: "Memory Journal",
  noun: "Memories",
  Panel: MemoriesPanel,
});
