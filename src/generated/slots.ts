/**
 * Generated scene-state slot list. Run `bun run slots` to update it; do not edit it by hand.
 * The truth is src/core/scene-state/slots/<id>.ts. Static imports, so the browser bundle and the single-file builds reach every slot without walking a folder.
 */
import { makeSlotOf } from "../core/scene-state/slot-lookup";
import type { SlotDef } from "../core/scene-state/types";
import slot0 from "../core/scene-state/slots/tracker-list";
import slot1 from "../core/scene-state/slots/tracker-record";
import slot2 from "../core/scene-state/slots/vars";

/** Every scene-state slot, by id. */
export const SLOTS = [slot0, slot1, slot2] as const;

/** A slot's declaration, or undefined for an id that is not a slot: an exact id, else the family that covers it (tracker-record:<pieceId>). */
export const slotOf: (id: string) => SlotDef | undefined = makeSlotOf(SLOTS);
