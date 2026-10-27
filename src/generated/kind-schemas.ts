/**
 * Generated kind seam (decoders and storage parts). Run `bun run kinds` to update it; do not edit it by hand.
 * The truth is src/entities/<kind>/ (kind.ts, runtime-schema.ts, parts.ts). Static imports, so the browser bundle and
 * the single-file builds reach every kind without walking a folder.
 */
import { entitySchema as schema0 } from "../entities/character/runtime-schema";
import { entitySchema as schema1 } from "../entities/lorebook/runtime-schema";
import { entitySchema as schema2 } from "../entities/persona/runtime-schema";
import { entitySchema as schema3 } from "../entities/pack/runtime-schema";
import { entitySchema as schema4 } from "../entities/preset/runtime-schema";
import { entitySchema as schema5 } from "../entities/scriptsheet/runtime-schema";
import { entitySchema as schema6 } from "../entities/regex/runtime-schema";
import { entitySchema as schema7 } from "../entities/quickreply/runtime-schema";
import { entitySchema as schema8 } from "../entities/tool/runtime-schema";
import { entitySchema as schema9 } from "../entities/dice/runtime-schema";
import { entitySchema as schema10 } from "../entities/formula/runtime-schema";
import { entitySchema as schema11 } from "../entities/promptformat/runtime-schema";
import { entitySchema as schema12 } from "../entities/htmldoc/runtime-schema";
import { parts as parts0 } from "../entities/lorebook/parts";
import { parts as parts1 } from "../entities/preset/parts";

/** Each kind's whole-entity decoder, in display order (the parse boundary's discriminated union). */
export const ENTITY_SCHEMAS = [schema0, schema1, schema2, schema3, schema4, schema5, schema6, schema7, schema8, schema9, schema10, schema11, schema12] as const;
/** The kinds whose bodies split into item parts in storage (src/entities/kind-parts.ts). */
export const KIND_PARTS = { lorebook: parts0, preset: parts1 } as const;
