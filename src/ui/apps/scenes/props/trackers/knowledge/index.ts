/**
 * Knowledge, RoleCall's `knowledge` tracker (Legacy Trackers, builtin-catalog.ts LEGACY_TRACKER_MODULES): known facts, secrets, suspicions, and information
 * asymmetry. Registered through props/trackers/legacy.ts; the state is ChatStore rule 43's `knowledge`, the rules are core/trackers/knowledge.ts.
 */
import { trackerProp } from "../tracker-prop";
import { KnowledgePanel } from "./knowledge-panel";
import { summaryLine } from "./summary";

export const knowledgeProp = trackerProp({
  module: "knowledge",
  name: "Knowledge",
  blurb: "Known facts, secrets, suspicions, and information asymmetry.",
  icon: "lucide:book-open",
  tone: "color-mix(in srgb,var(--stage-link) 60%,var(--stage-ok))",
  group: "legacy",
  reach: "model",
  title: "Knowledge",
  noun: "Knowledge",
  Panel: KnowledgePanel,
  summary: summaryLine,
});
