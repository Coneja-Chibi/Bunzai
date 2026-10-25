/**
 * RoleCall's upsert rules for a filing pass (`lib/ai/tv-stream/postgen-writer.ts:809-816`): arrays append, nested objects
 * deep-merge, scalars replace, and nothing the model did not mention is touched. The model never re-sends a field it is not
 * changing (F23: RoleCall's 60-character preview once made it overwrite an 18,591-character entry), so a merge is only ever an
 * addition or a replacement of what it named. Appending skips an element already there. Pure.
 */
import { deepEq, isRecord, type Rec } from "../guards";

const blank = (v: unknown): boolean => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

/** The merge of one value into what is there: the same reference when nothing changes. */
function mergeValue(old: unknown, add: unknown): unknown {
  if (blank(add)) return old;
  if (old === undefined || old === null) return add;
  if (Array.isArray(old) && Array.isArray(add)) {
    const fresh = add.filter((item) => !old.some((had) => deepEq(had, item)));
    return fresh.length === 0 ? old : [...old, ...fresh];
  }
  if (isRecord(old) && isRecord(add)) {
    let next = old;
    for (const [key, value] of Object.entries(add)) {
      const merged = mergeValue(old[key], value);
      if (merged !== old[key]) next = { ...next, [key]: merged };
    }
    return next;
  }
  return deepEq(old, add) ? old : add;
}

export interface Merged {
  data: Rec;
  /** The top-level fields that changed, with the value each held before (absent from `before` when it was not there). */
  before: Rec;
  after: Rec;
}

/** `incoming` merged into `existing`. A field in `keep` (the entry's name) is never replaced, so the canonical name survives an alias. */
export function mergeData(existing: Rec, incoming: Rec, keep: readonly string[] = []): Merged {
  let data = existing;
  const before: Rec = {};
  const after: Rec = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (keep.includes(key) && !blank(existing[key])) continue;
    const merged = mergeValue(existing[key], value);
    if (merged === existing[key]) continue;
    if (!blank(existing[key])) before[key] = existing[key];
    after[key] = merged;
    data = { ...data, [key]: merged };
  }
  return { data, before, after };
}
