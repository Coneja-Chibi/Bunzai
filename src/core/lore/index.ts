/**
 * Pure lore capabilities, summaries, health, empty factory, sample match,
 * plus inspect and diff, and the one lore engine chat and the Workbench share (engine/).
 */
export {
  type LoreWriteForProfile,
  type FieldVisibility,
  type LoreFieldKey,
  LORE_WRITE_FOR_LABELS,
  LORE_WRITE_FOR_PROFILES,
  isLoreWriteForProfile,
  parseWriteFor,
  loreFieldVisibility,
  fieldVisible,
} from "./capabilities";
export {
  LORE_ALL_POSITIONS,
  LORE_CORE_KEYS,
  LORE_POSITIONS_BY_PROFILE,
  PLATFORM_OWNED_EXTRAS,
  allPlatformFieldKeys,
  isDepthLikePosition,
  placementRailStops,
  placementRailVisible,
  platformOwnsField,
  positionsForProfile,
} from "./platform-fields";
export { type LoreSummary, estimateBookTokens, estimateEntryTokens, loreSummary } from "./summary";
export { type LoreHealthLevel, type LoreHealthNote, loreHealth } from "./health";
export { emptyLoreEntry, emptyLorebookBody } from "./empty-book";
export { type SampleMatchHit, sampleMatchEntries } from "./sample-match";
export type { ScanLine } from "./chat-import";
export {
  type LoreFinding,
  type LoreFindingRule,
  inspectBook,
  applyAllFixes,
} from "./inspect";
export {
  type FieldChange,
  type BookDiff,
  diffBooks,
  wordDiffRanges,
  revertField,
  restoreEntry,
} from "./diff";
export {
  renumberEntries,
  splitBook,
  mergeBooks,
  duplicateBook,
  filterEnabledBooks,
} from "./book-ops";
export { cryptoUnit, mulberry32, freshSeed } from "./rng";
export {
  type LoreBookInput,
  type LoreFire,
  type LoreScan,
  type LoreScanMessage,
  type LoreRunOptions,
  type LorePosition,
  type LoreReason,
  type LoreHit,
  type LoreRun,
  type LoreSideEffectOp,
  type LoreSkip,
  type LoreVerdict,
  runLore,
  loreWakeGraph,
} from "./engine";
export { nearMisses, type NearMissHit } from "./near-miss";
export { parseChatJsonl, type ImportedChat } from "./chat-import";
export { healBook, type HealNote, type HealResult } from "./heal";
export { findingsFromHealNotes, healNotesFromOriginal } from "./heal-findings";
export {
  type LayoutNode,
  type LayoutEdge,
  type LayoutBounds,
  WEB_NODE_CAP,
  componentLabels,
  stepLayout,
  seedLayout,
} from "./web-layout";
