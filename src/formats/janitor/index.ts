/**
 * JanitorAI character export: a CCv2 PNG shaped for Janitor's only importer, the avatar upload on
 * /create_character. That importer reads the `chara` chunk alone (no `ccv3`, no JSON, no charx) and
 * takes its V1 branch whenever the top-level mirror fields are present, where it maps top-level
 * `description` to Janitor's Personality (the definition) and top-level `personality` to Janitor's
 * public Description (bio). A plain ST card therefore lands swapped; this adapter writes the mirrors
 * the way Janitor reads them and leaves `data` a normal V2 card for every other reader.
 * Janitor has no official card export, so the adapter never bids on detection; it is an export target.
 */
import type { AdapterOutput, CharacterAdapter, EmitContext } from "../../core/adapter";
import type { CanonicalCharacter } from "../../entities/character/schema";
import { buildSerializeReport, withWarnings } from "../../core/reports";
import { str, type Rec } from "../../core/guards";
import { charaOnlyPng, v2CardObject } from "../_shared/card-png";
import { hostWorldbook } from "../_shared/host-worldbook";
import { characterAdapter as sillytavern } from "../sillytavern/index";
import coverage from "./coverage";

const AVATAR_LIMIT = 10 * 1024 * 1024;

const adapter: CharacterAdapter = {
  id: "janitor",
  label: "JanitorAI character (PNG for the avatar importer)",
  outputExtensions: ["png"],
  kind: "character",
  escrowFormatIds: ["sillytavern"], // the V2 card is built from the Tavern twin, so its escrow re-emits
  coverage,
  lens: false, // export target, not a host lens: the Default CCv3 tab covers Janitor editing

  detect: () => 0,

  // Never bids on detection, but its own PNG is a plain CCv2 card, so it reads back through the Tavern mapping.
  toCanonical: (input) => sillytavern.toCanonical(input),

  fromCanonical(entity: CanonicalCharacter, context?: EmitContext): AdapterOutput {
    const card = v2CardObject(entity, context);
    const data = card.data as Rec;
    const definition = [str(data.description), str(data.personality)].filter((s) => s.trim()).join("\n\n");
    Object.assign(card, {
      name: str(data.name),
      description: definition,
      personality: str(data.creator_notes),
      scenario: str(data.scenario),
      first_mes: str(data.first_mes),
      mes_example: str(data.mes_example),
    });
    const bytes = charaOnlyPng(entity, card);
    const warnings: string[] = [];
    if (!definition.trim()) warnings.push("janitor: the definition is empty and Janitor requires Personality");
    if (!str(data.first_mes).trim()) warnings.push("janitor: no first message and Janitor requires one");
    if (bytes.length > AVATAR_LIMIT) warnings.push("janitor: the PNG is over Janitor's 10 MB avatar limit");
    return {
      bytes,
      suggestedExtension: "png",
      report: withWarnings(buildSerializeReport(entity, adapter), warnings),
    };
  },
};

export { adapter as characterAdapter };
export default [adapter, hostWorldbook("janitor-lorebook", "JanitorAI lorebook (ST world info for Scripts > Import JSON)")];
