/**
 * RoleCall Script Sheet codec. RoleCall stores a Script Sheet as a preset whose settings carry `script_sheet: { version:
 * 1, content }` (files saved before its rename carry `promptbook`), and its export writes the preset file with that key
 * at the top beside the blocks the sheet sends (packages/presets-core/src/script-sheet.ts, preset-parser.ts). This reads
 * such a file as a Script Sheet and writes one back the same way: the blocks through the RoleCall preset writer, from the
 * sheet as the preset it sends, plus the sheet itself.
 */
import type { AdapterInput, AdapterOutput, KindAdapter } from "../../core/adapter";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { isRecord, optStr, type Rec } from "../../core/guards";
import { sheetAsPreset } from "../../core/preset/script-sheet";
import type { CanonicalScriptSheet } from "../../entities/scriptsheet/schema";
import { readJsonObject } from "../_shared/card-io";
import { setNameFromFilename } from "../_shared/regex-set-name";
import { detectStPreset, parsedToBody, parseStPreset } from "../_shared/st-preset-wire";
import rolecallPreset from "./preset";

/** The sheet a RoleCall file carries, under either key, or undefined. */
function sheetOnWire(json: Rec): { content: string } | undefined {
  const value = isRecord(json.script_sheet) ? json.script_sheet : isRecord(json.promptbook) ? json.promptbook : undefined;
  return value && value.version === 1 && typeof value.content === "string" ? { content: value.content } : undefined;
}

const rolecallScriptSheet: KindAdapter<"scriptsheet"> = {
  id: "rolecall-script-sheet",
  label: "RoleCall Script Sheet export (one instruction, with the blocks it sends)",
  escrowFormatIds: ["rolecall"],
  outputExtensions: ["json"],
  kind: "scriptsheet",

  // 0.97: a RoleCall preset file that carries a sheet is a sheet, so it outranks the RoleCall preset codec (0.95)
  detect(input: AdapterInput): number {
    const raw = readJsonObject(input);
    return raw && detectStPreset(raw) && sheetOnWire(raw) ? 0.97 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalScriptSheet {
    const raw = readJsonObject(input);
    const sheet = raw && sheetOnWire(raw);
    if (!raw || !sheet) throw new Error("rolecall-script-sheet: not a RoleCall Script Sheet (no script_sheet)");
    const name = optStr(raw.name) ?? setNameFromFilename(input, "Imported Script Sheet");
    const samplers = parsedToBody(name, parseStPreset(raw)).samplers;
    const readme = optStr(raw.readme);
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "scriptsheet",
      id: canonicalId(name),
      body: { name, content: sheet.content, ...(readme !== undefined ? { description: readme } : {}), ...(samplers ? { samplers } : {}) },
      original: { rolecall: { raw } },
    };
  },

  fromCanonical(entity: CanonicalScriptSheet): AdapterOutput {
    const preset = rolecallPreset.fromCanonical({ ...entity, kind: "preset", body: sheetAsPreset(entity.body) } as never);
    const out = JSON.parse(preset.text ?? "{}") as Rec;
    delete out.promptbook;
    out.script_sheet = { version: 1, content: entity.body.content };
    return { text: JSON.stringify(out, null, 2), suggestedExtension: "json" };
  },
};

export default rolecallScriptSheet;
