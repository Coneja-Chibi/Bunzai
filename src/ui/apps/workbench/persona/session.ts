/**
 * Persona editor session state. Canonical mutations delegate to the entity-layer authority.
 */
import type { PersonaBody } from "../../../../entities/persona/schema";
import { isAssetImageRef } from "../../../_shared/art-cache";

/**
 * The portrait ref the booth previews from the draft: any displayable ref the editor can hold (data URI, http(s),
 * or a stored/uploaded asset sentinel, the same test the character editor applies), else null so the stored portrait shows.
 * A sentinel is what both a saved portrait and a freshly hung upload look like in the draft.
 */
export const draftPortraitRef = (body: PersonaBody): string | null => {
  const ref = body.media?.portrait?.ref ?? "";
  return isAssetImageRef(ref) ? ref : null;
};

export const personaDirty = (body: PersonaBody, baseline: PersonaBody): boolean =>
  JSON.stringify(body) !== JSON.stringify(baseline);

export {
  patchPersonaBody as patchBody,
  patchPersonaIdentity as patchIdentity,
  patchPersonaInjection as patchInjection,
  patchPersonaSections as patchSections,
  setPersonaPortrait as setPortrait,
  togglePersonaTrait as toggleTrait,
} from "../../../../entities/persona/operations";
