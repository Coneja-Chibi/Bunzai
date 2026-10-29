/** The scene's saved chat summary (ChatStore rule 45): a row for each version of a reply a piece of the text ends at, and one row, `person`, for the person's own text (core/summary/rows.ts). */
import { summaryRowShape } from "../../summary/row-shape";
import { defineSlot } from "../define-slot";

export default defineSlot({ id: "summary", scope: "scene", diff: "keyed-list", key: "version", writers: ["background", "person"], default: [], shape: summaryRowShape });
