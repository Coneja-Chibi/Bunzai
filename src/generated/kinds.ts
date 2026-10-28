/**
 * Generated kind seam (identity). Run `bun run kinds` to update it; do not edit it by hand.
 * The truth is src/entities/<kind>/ (kind.ts, runtime-schema.ts, parts.ts). Static imports, so the browser bundle and
 * the single-file builds reach every kind without walking a folder.
 */
import type { CanonicalEntity } from "../core/canonical";
import type { KindDescriptor } from "../entities/_shared/kind-descriptor";
import kind0 from "../entities/character/kind";
import kind1 from "../entities/lorebook/kind";
import kind2 from "../entities/persona/kind";
import kind3 from "../entities/pack/kind";
import kind4 from "../entities/preset/kind";
import kind5 from "../entities/scriptsheet/kind";
import kind6 from "../entities/regex/kind";
import kind7 from "../entities/quickreply/kind";
import kind8 from "../entities/tool/kind";
import kind9 from "../entities/dice/kind";
import kind10 from "../entities/formula/kind";
import kind11 from "../entities/tracker/kind";
import kind12 from "../entities/promptformat/kind";
import kind13 from "../entities/htmldoc/kind";

/** Every content kind, in display order. */
export const KINDS = [kind0, kind1, kind2, kind3, kind4, kind5, kind6, kind7, kind8, kind9, kind10, kind11, kind12, kind13] as const;
/** Every kind id, in display order: the closed set of studio folders and canonical kinds. */
export const KIND_IDS = ["character", "lorebook", "persona", "pack", "preset", "scriptsheet", "regex", "quickreply", "tool", "dice", "formula", "tracker", "promptformat", "htmldoc"] as const;
export type KindId = (typeof KIND_IDS)[number];
type EntityOf<D> = D extends KindDescriptor<infer Id, infer Body> ? CanonicalEntity<Id, Body> : never;
/** Any canonical piece, as the union of every kind's. */
export type AnyKindEntity = EntityOf<(typeof KINDS)[number]>;

const BY_ID = new Map<string, KindDescriptor>(KINDS.map((k) => [k.id, k as KindDescriptor]));
/** A kind's descriptor, or undefined for an id that is not a kind. */
export const kindOf = (id: string): KindDescriptor | undefined => BY_ID.get(id);
export const isKindId = (value: unknown): value is KindId => typeof value === "string" && BY_ID.has(value);
