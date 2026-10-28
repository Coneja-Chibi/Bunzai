/** The scene's macro variables (ChatStore rule 17): one field per variable name, each with its first and latest write time. */
import { defineSlot } from "../define-slot";

export default defineSlot({ id: "vars", scope: "scene", diff: "fields", default: {} });
