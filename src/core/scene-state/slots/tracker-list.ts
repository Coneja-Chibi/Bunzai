/** A linked list tracker's state (entities/tracker, core/tracker.ts): one row per name, each row holding every field. A family: `tracker-list:<pieceId>`. */
import { defineSlot } from "../define-slot";

export default defineSlot({ id: "tracker-list:*", scope: "scene", diff: "keyed-list", key: "name", default: [] });
