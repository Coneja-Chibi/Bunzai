/**
 * SillyTavern prompt-format codec (kind "promptformat"): the instruct template ({ input_sequence,
 * output_sequence, ... }) and the context template ({ story_string, ... }) ST keeps in separate
 * folders and binds by name, as one piece with an optional half each. Reads either file alone, or
 * ST's master-import wrapper { name, instruct?, context? } (the shape export writes when both halves
 * are present). A wrapper that also carries a `sysprompt` stays a preset (the preset codec's master
 * shape), and a chat-completion preset is never claimed here. Every key ST wrote rides inside its
 * half under ST's own name, so a single-half piece exports back to the file it came from.
 */
import type { AdapterInput, AdapterOutput, PromptFormatAdapter } from "../../core/adapter";
import type { CanonicalPromptFormat, PromptFormatPart } from "../../entities/promptformat/schema";
import { CANONICAL_SCHEMA_VERSION, canonicalId } from "../../core/canonical";
import { isRecord, type Rec } from "../../core/guards";
import { readJsonObject } from "../_shared/card-io";
import { setNameFromFilename } from "../_shared/regex-set-name";

const scalar = (v: unknown): boolean => ["string", "number", "boolean"].includes(typeof v);
const isInstruct = (v: unknown): boolean => isRecord(v) && typeof v.input_sequence === "string" && typeof v.output_sequence === "string";
const isContext = (v: unknown): boolean => isRecord(v) && typeof v.story_string === "string";
const allScalar = (v: Rec): boolean => Object.values(v).every(scalar);

interface Halves {
  name?: string;
  instruct?: Rec;
  context?: Rec;
}

/** The halves a JSON object holds, or null when it is neither file nor a master wrapper of them. */
function halvesOf(json: unknown): Halves | null {
  if (!isRecord(json) || Array.isArray(json.prompts) || isRecord(json.sysprompt)) return null;
  const name = typeof json.name === "string" ? json.name : undefined;
  const found: Halves = { name };
  if (isInstruct(json)) found.instruct = json;
  else if (isContext(json)) found.context = json;
  else {
    if (isInstruct(json.instruct)) found.instruct = json.instruct as Rec;
    if (isContext(json.context)) found.context = json.context as Rec;
  }
  const halves = [found.instruct, found.context].filter((h): h is Rec => h !== undefined);
  return halves.length > 0 && halves.every(allScalar) ? found : null;
}

const withoutName = (half: Rec): PromptFormatPart => {
  const { name: _name, ...rest } = half;
  return rest as PromptFormatPart;
};

const promptFormatAdapter: PromptFormatAdapter = {
  id: "sillytavern-promptformat",
  label: "SillyTavern prompt format (instruct and context templates)",
  escrowFormatIds: ["sillytavern"],
  outputExtensions: ["json"],
  kind: "promptformat",

  detect(input: AdapterInput): number {
    return halvesOf(readJsonObject(input)) ? 0.9 : 0;
  },

  toCanonical(input: AdapterInput): CanonicalPromptFormat {
    const raw = readJsonObject(input);
    const halves = halvesOf(raw);
    if (!raw || !halves) throw new Error("sillytavern-promptformat: not a SillyTavern instruct or context template");
    const name = halves.name ?? setNameFromFilename(input, "Imported prompt format");
    return {
      schemaVersion: CANONICAL_SCHEMA_VERSION,
      kind: "promptformat",
      id: canonicalId(name),
      body: {
        name,
        ...(halves.instruct ? { instruct: withoutName(halves.instruct) } : {}),
        ...(halves.context ? { context: withoutName(halves.context) } : {}),
      },
      original: { sillytavern: { raw: { name, ...(halves.instruct ? { instruct: halves.instruct } : {}), ...(halves.context ? { context: halves.context } : {}) } } },
    };
  },

  fromCanonical(entity: CanonicalPromptFormat): AdapterOutput {
    const { name, instruct, context } = entity.body;
    const named = (half: PromptFormatPart): Rec => ({ ...half, name });
    const out: Rec = instruct && context
      ? { name, instruct: named(instruct), context: named(context) }
      : named((instruct ?? context ?? {}) as PromptFormatPart);
    return { text: JSON.stringify(out, null, 2), suggestedExtension: "json" };
  },
};

export default promptFormatAdapter;
export { promptFormatAdapter };
