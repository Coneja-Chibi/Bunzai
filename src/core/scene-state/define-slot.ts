/**
 * `defineSlot`: how a slot file (slots/<id>.ts) declares itself. It checks the declaration once, at import, so a slot
 * the generator lists is always usable, and returns it unchanged. A slot id ending in `:*` is a family (slot-lookup.ts): one
 * declaration for every slot a library piece makes at run time (`tracker-record:<pieceId>`); its file is named without the `:*`.
 */
import type { SlotDef } from "./types";

export const SLOT_ID = /^[a-z][a-z0-9.:_-]{0,63}$/;
/** A family: one lowercase word, a colon and a star. The word is the prefix every member id starts with. */
export const FAMILY_ID = /^[a-z][a-z0-9.-]{0,40}:\*$/;

/** The file a slot is declared in, without its extension: its id, less the `:*` of a family. */
export const slotFile = (id: string): string => (id.endsWith(":*") ? id.slice(0, -2) : id);

export function defineSlot<const D extends SlotDef>(def: D): D {
  const rule = def.id.endsWith(":*") ? FAMILY_ID : SLOT_ID;
  if (!rule.test(def.id)) throw new Error(`slot id "${def.id}" must match ${rule}`);
  if (def.diff === "keyed-list" && !def.key) throw new Error(`slot ${def.id}: a keyed-list names its row key`);
  if (def.diff !== "keyed-list" && def.key !== undefined) throw new Error(`slot ${def.id}: only a keyed-list has a row key`);
  return def;
}
