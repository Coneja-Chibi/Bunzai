/** The library's global variables (globals.ts): one row per operation a reply version made, kept with that version and folded across every live take. */
import { defineSlot } from "../define-slot";
import { globalOpShape } from "../globals";

export default defineSlot({ id: "global", scope: "shared", diff: "keyed-list", key: "id", writers: ["turn"], default: [], shape: globalOpShape });
