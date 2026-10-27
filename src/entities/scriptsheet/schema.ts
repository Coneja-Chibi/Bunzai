/** Canonical Script Sheet piece: one writing instruction (RoleCall's Script Sheet). */
import type { CanonicalEntity } from "../../core/canonical";
import type { PresetSamplers } from "../preset/schema";

/**
 * A Script Sheet is the small writing setup: one instruction instead of a preset's block list. The card, persona,
 * lore, memory and history are seated around it automatically (core/preset/script-sheet.ts), so a scene can use it
 * where it would use a preset. Samplers are the preset's own kind, so a sheet becomes a preset with nothing lost.
 */
export interface ScriptSheetBody {
  name: string;
  /** The instruction. Context macros are refused where it is written and when it is sent, never when it is read. */
  content: string;
  description?: string;
  samplers?: PresetSamplers;
}

export type CanonicalScriptSheet = CanonicalEntity<"scriptsheet", ScriptSheetBody>;

export const emptyScriptSheetBody = (name: string): ScriptSheetBody => ({ name, content: "" });
