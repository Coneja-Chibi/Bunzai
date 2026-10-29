/** A linked record tracker's state (entities/tracker, core/tracker.ts): one field per tracker field. A family: `tracker-record:<pieceId>`. */
import { defineSlot } from "../define-slot";

export default defineSlot({ id: "tracker-record:*", scope: "scene", diff: "fields", writers: ["turn", "person"], default: {} });
