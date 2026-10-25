/**
 * The token meter: a counter that learns every model from the usage its
 * replies report. Pure core: the base count, the usage reader, the per-model fits, the cache planner,
 * cost, and cache-friendly trimming. The stage stores the meter document; the turn loop feeds it.
 */
export {
  clearTokenCaches,
  countFramed,
  countMessage,
  countPrompt,
  countText,
  setTokenCacheGate,
  setTokenCacheInsertHook,
  tokenCacheBytes,
  trimTokenCache,
  CONTENT_CLASSES,
  MESSAGE_OVERHEAD,
  __resetTokenCacheForTests,
  __tokenCacheStatsForTests,
  type BaseCount,
  type ClassCounts,
} from "./base";
export { readTokenReport, type TokenReport, type UsageShape } from "./usage";
export { estimate, estimatePart, FLOOR_RATIO, REPORT_FLOOR, newCalibration, observe, observeCache, type CachedPart, type Estimate, type ModelCalibration, type Sample } from "./calibrate";
export { familyOf, PRIORS, type Family, type Prior } from "./priors";
export { cacheRulesFor, backendOf, cachedPart, costOf, predictCache, prefixChain, sharedPrefix, type CachePrediction, type CacheRules, type Cost, type Prices } from "./cache";
export { trimHistory, type TrimInput, type TrimResult } from "./trim";
export {
  emptyMeter,
  estimateFor,
  partFor,
  readKey,
  learn,
  modelKey,
  parseMeter,
  reset,
  serializeMeter,
  summaries,
  type Meter,
  type ModelSummary,
  type ReplyEvidence,
} from "./meter";
