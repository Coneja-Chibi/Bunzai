/** The Props trackers' state, one slot per module that keeps any (`tracker.inventory`, `tracker.spellbook`, ...), made from the module table in core/trackers/index.ts and not written by hand. A module's strategy and the rule each field or row passes come from its state spec (core/trackers/state.ts). */
import { TRACKER_STATE_MODULES, trackerSlotDef } from "../../trackers";
import { defineSlot } from "../define-slot";

export default TRACKER_STATE_MODULES.map((module) => defineSlot(trackerSlotDef(module)));
