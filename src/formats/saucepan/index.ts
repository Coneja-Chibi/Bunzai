/**
 * Saucepan character export: a CCv2 PNG for Saucepan's Companion Importer (/labs/companion-importer),
 * which reads the `chara` chunk alone ("SillyTavern PNG v1 and v2": no `ccv3`, no JSON, no charx).
 * The importer's defaults merge description, personality and scenario into Information, send
 * creator_notes to the public Description, first_mes plus alternate_greetings to Scenarios, and keep
 * mes_example and tags. It clips oversized fields with a toast, so this adapter names every field over
 * Saucepan's limits (counted in code points) in the report instead of letting the clip go unnoticed.
 * Saucepan's own Backup JSON is unverified against a real file, so there is no Saucepan reader and the
 * adapter never bids on detection; it is an export target.
 */
import type { AdapterOutput, CharacterAdapter, EmitContext } from "../../core/adapter";
import type { CanonicalCharacter } from "../../entities/character/schema";
import { buildSerializeReport, withWarnings } from "../../core/reports";
import { str, strArray, type Rec } from "../../core/guards";
import { charaOnlyPng, v2CardObject } from "../_shared/card-png";
import { hostWorldbook } from "../_shared/host-worldbook";
import { characterAdapter as sillytavern } from "../sillytavern/index";
import coverage from "./coverage";

const MAX_SCENARIOS = 50;
const LIMITS = { information: 120_000, description: 20_000, examples: 40_000, scenario: 30_000, formatting: 10_000 };

const length = (s: string): number => [...s].length;

/** Report lines for every field Saucepan's importer would clip, and the prompts it only takes by hand. */
export function saucepanWarnings(data: Rec): string[] {
  const information = [data.description, data.personality, data.scenario].map(str).filter((s) => s.trim()).join("\n\n");
  const greetings = [str(data.first_mes), ...strArray(data.alternate_greetings)];
  const over = (label: string, text: string, limit: number): string[] =>
    length(text) > limit ? [`saucepan: ${label} is ${length(text)} characters; Saucepan keeps ${limit}`] : [];
  return [
    ...over("Information (description + personality + scenario)", information, LIMITS.information),
    ...over("Description (creator notes)", str(data.creator_notes), LIMITS.description),
    ...over("Example dialogue", str(data.mes_example), LIMITS.examples),
    ...greetings.flatMap((g, i) => over(`Scenario ${i + 1}`, g, LIMITS.scenario)),
    ...(greetings.length > MAX_SCENARIOS ? [`saucepan: ${greetings.length} greetings; Saucepan keeps ${MAX_SCENARIOS} scenarios`] : []),
    ...manualPrompts(data),
  ];
}

/**
 * The importer's default map has no entry for the prompt fields, so it discards them, but its mapping
 * step offers a "Select mapping..." per discarded field, and Formatting Instructions takes them.
 */
function manualPrompts(data: Rec): string[] {
  const fields = (["system_prompt", "post_history_instructions"] as const).filter((key) => str(data[key]).trim());
  if (fields.length === 0) return [];
  const total = length(fields.map((key) => str(data[key])).join("\n\n"));
  return [
    `saucepan: ${fields.join(" and ")} ${fields.length > 1 ? "are" : "is"} discarded by default; in the importer pick "Formatting Instructions" for ${fields.length > 1 ? "them" : "it"} under Discarded Fields`,
    ...(total > LIMITS.formatting ? [`saucepan: those prompts are ${total} characters; Formatting Instructions keeps ${LIMITS.formatting}`] : []),
  ];
}

const adapter: CharacterAdapter = {
  id: "saucepan",
  label: "Saucepan companion (PNG for the Companion Importer)",
  outputExtensions: ["png"],
  kind: "character",
  escrowFormatIds: ["sillytavern"], // the V2 card is built from the Tavern twin, so its escrow re-emits
  coverage,
  lens: false, // export target, not a host lens

  detect: () => 0,

  // Never bids on detection, but its own PNG is a plain CCv2 card, so it reads back through the Tavern mapping.
  toCanonical: (input) => sillytavern.toCanonical(input),

  fromCanonical(entity: CanonicalCharacter, context?: EmitContext): AdapterOutput {
    const card = v2CardObject(entity, context);
    return {
      bytes: charaOnlyPng(entity, card),
      suggestedExtension: "png",
      report: withWarnings(buildSerializeReport(entity, adapter), saucepanWarnings(card.data as Rec)),
    };
  },
};

export { adapter as characterAdapter };
export default [adapter, hostWorldbook("saucepan-lorebook", "Saucepan lorebook (ST world info for the Lorebook Importer)")];
