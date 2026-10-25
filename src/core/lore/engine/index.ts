/**
 * Public surface of the lore engine. Pure: no imports
 * from src/ui, src/stage, src/studio, storage, or network, and no ambient clock or random source
 * anywhere under engine/ (purity.test.ts greps for it). src/core/lore/inspect.ts and the Workbench's
 * lore tools call it directly; src/core/assembly wires it into a chat turn.
 */
export type {
  LoreBookInput,
  LoreFire,
  LoreScan,
  LoreScanMessage,
  LoreRunOptions,
  LorePosition,
  LoreReason,
  LoreHit,
  LoreRun,
  LoreSideEffectOp,
  LoreSkip,
  LoreVerdict,
} from "./types";
export { runLore } from "./engine";
export { expandLoreOutlets } from "./outlet";
export { loreWakeGraph } from "./wake";
export {
  matchKeywordTrigger,
  resolveKeywordOptions,
  clearKeywordRegexCaches,
  setKeywordRegexCacheGate,
  setKeywordRegexCacheInsertHook,
  keywordRegexCacheBytes,
  trimKeywordRegexCache,
  __keywordRegexCacheStatsForTests,
  __resetKeywordRegexCachesForTests,
  type KeywordMatchOptions,
} from "./triggers-keyword";
export {
  clearLoreKeyIndexCache,
  setLoreKeyIndexCacheGate,
  setLoreKeyIndexCacheInsertHook,
  loreKeyIndexCacheBytes,
  trimLoreKeyIndexCache,
  compileBookKeyIndexCached,
  __loreKeyIndexCacheStatsForTests,
  __resetLoreKeyIndexCacheForTests,
} from "./key-index";
