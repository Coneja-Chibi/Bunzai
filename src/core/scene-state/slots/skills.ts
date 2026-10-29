/** Which linked skills the model has open (core/skill.ts): one field per skill id, `true` while open; closing removes the field. Written by the reply (open_skill, close_skill, a skill's close rule) and by the person. */
import { bool } from "../../trackers/shape";
import { defineSlot } from "../define-slot";

export default defineSlot({ id: "skills", scope: "scene", diff: "fields", writers: ["turn", "person"], default: {}, shape: bool() });
