/** Test helpers for host PNG exports (Janitor, Saucepan): a card built through the ST importer, and PNG keyword listing. */
import { readFileSync } from "node:fs";
import extract from "png-chunks-extract";
import text from "png-chunk-text";
import type { CanonicalCharacter } from "../../entities/character/schema";
import { characterAdapter as sillytavern } from "../sillytavern/index";
import { asText } from "./as-text";

const PNG = new Uint8Array(readFileSync("samples/sillytavern/characters/synthetic-character.png"));
const portrait = `data:image/png;base64,${Buffer.from(PNG).toString("base64")}`;

/** A card imported the way a real one is, with a PNG portrait unless told otherwise. */
export function hostCard(data: Record<string, unknown>, spec: "v2" | "v3" = "v2", withPortrait = true): CanonicalCharacter {
  const envelope = spec === "v3"
    ? { spec: "chara_card_v3", spec_version: "3.0", data }
    : { spec: "chara_card_v2", spec_version: "2.0", data };
  const entity = sillytavern.toCanonical(asText(envelope));
  if (withPortrait) entity.body.media.portrait = { role: "portrait", ref: portrait, mime: "image/png", primary: true };
  return entity;
}

/** Every tEXt chunk in a PNG as keyword -> decoded JSON. */
export function textChunks(bytes: Uint8Array): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const chunk of extract(bytes)) {
    if (chunk.name !== "tEXt") continue;
    const { keyword, text: value } = text.decode(chunk.data);
    out[keyword] = JSON.parse(Buffer.from(value, "base64").toString("utf8"));
  }
  return out;
}
