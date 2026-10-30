/**
 * A character as the PNG card the whole ecosystem trades.
 *
 * PNG IS A CARRIER, NOT A PLATFORM'S OUTPUT FORMAT, and modelling it the other way was backwards.
 * The bytes inside a card PNG are the V2/V3 spec, which is what SillyTavern, Chub, Agnai, RisuAI,
 * Backyard and Pygmalion all parse on import - so "can this be a PNG" is a property of being a
 * character, not of which platform dialect you happen to be exporting through.
 *
 * OUR OWN IMPORT PATH ALREADY KNEW THIS. `card-io.ts` reads a card out of a PNG for any adapter that
 * asks, and four of them do. Export was the asymmetric half: two adapters had opted into writing one
 * and the other seven could not, so exporting the same character as PNG depended on picking the
 * right platform first - which is exactly the thing a person exporting a picture does not know.
 *
 * WHY NOT SIMPLY LET EVERY ADAPTER WRITE PNG. Because a PNG card announces itself as the standard
 * card. Putting Agnai's own JSON dialect, or RoleCall's, under the `chara` keyword produces a file
 * that claims to be something it is not, and the reader on the other side has no way to tell - seven
 * formats each lying in their own shape. There is one dialect every reader understands, so there is
 * one path here, and the platform adapters keep writing the containers their own apps want.
 */
import type { EmitContext } from "../../core/adapter";
import { recOr, type Rec } from "../../core/guards";
import type { CanonicalCharacter } from "../../entities/character/schema";
import { characterCardJsons } from "../sillytavern";
import { embedCardPng, portraitPngBytes } from "./png";
import { CARD_SPEC_V2, wrapV2, type TavernData } from "./tavern-fields";

/** Why a character cannot become a PNG card, or null when it can. */
export function pngCardRefusal(entity: CanonicalCharacter): string | null {
  return portraitPngBytes(entity.body) ? null : "this card has no PNG portrait to carry it";
}

/**
 * The card, as PNG bytes. Throws with the reason above when it cannot be one.
 *
 * The JSON is built by the Tavern codec because that codec IS the standard dialect - not because the
 * character came from SillyTavern. A card imported from anywhere exports the same way, which is the
 * whole point: `original` may be empty and this still produces a card every app can open.
 */
export function characterPngCard(entity: CanonicalCharacter): Uint8Array {
  const portrait = portraitPngBytes(entity.body);
  if (!portrait) throw new Error(`png card: ${pngCardRefusal(entity) ?? "unavailable"}`);
  const output = characterCardJsons(entity);
  return embedCardPng(portrait, output.v2Backfill ?? output.text, output.v2Backfill === undefined ? undefined : output.text);
}

/**
 * The standard card as a V2 envelope object, for hosts whose importer reads only the `chara` chunk
 * and only V1/V2 (JanitorAI, Saucepan). A V3 card yields its V2 backfill; a flat card gets wrapped.
 */
export function v2CardObject(entity: CanonicalCharacter, context?: EmitContext): Rec {
  const output = characterCardJsons(entity, context);
  const card = JSON.parse(output.v2Backfill ?? output.text) as Rec;
  // The V2 backfill escrows V3 `assets`, and a set portrait rides there as a data URI: the PNG pixels
  // already are that portrait, so keeping it would embed the image a second time inside its own card.
  // All escrowed assets go, not just the portrait: neither chara-only host reads any of them.
  const fields = recOr(recOr(recOr(recOr(recOr(card.data).extensions).vaudeville).escrow).fields);
  delete fields.assets;
  return card.spec === CARD_SPEC_V2 ? card : { ...wrapV2(card as TavernData) };
}

/**
 * The card's portrait, or else the PNG it was imported from. The Studio keeps an imported card's art
 * only as that source carrier and shows it as the portrait, so a PNG-only host must fall back to it.
 * A portrait set on the card wins over the carrier: it is the newer, deliberate choice of art.
 */
function portraitOrCarrier(entity: CanonicalCharacter): Uint8Array | null {
  const carriers = Object.values(entity.original ?? {}).map((entry) => entry?.sourceMedia);
  const carrier = carriers.find((media) => media?.mime === "image/png");
  return portraitPngBytes(entity.body)
    ?? (carrier ? portraitPngBytes({ media: { portrait: { ref: `data:image/png;base64,${carrier.b64}` } } }) : null);
}

/** `card` embedded under `chara` alone (no `ccv3`). Throws when there is no PNG art; the export boundary names the target. */
export function charaOnlyPng(entity: CanonicalCharacter, card: Rec): Uint8Array {
  const portrait = portraitOrCarrier(entity);
  if (!portrait) throw new Error(`export is a PNG card and ${pngCardRefusal(entity)}`);
  return embedCardPng(portrait, JSON.stringify(card, null, 2));
}
