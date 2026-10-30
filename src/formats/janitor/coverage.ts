/**
 * JanitorAI coverage: what its avatar-upload importer keeps from a `chara` PNG (V1 branch).
 * Grounded in Janitor's production bundle (CharacterForm/ImageInput, read 2026-10-24).
 */
import type { CoverageDecl } from "../../core/coverage";

const coverage: CoverageDecl = {
  carries: [
    "identity.name",
    "identity.description",
    "persona.personality",
    "persona.scenario",
    "greetings.firstMessage",
    "examples.exampleMessages",
    "attribution.creatorNotes",
    "media.portrait",
  ],
  notes: {
    "identity.description": "with personality, folded into Janitor's Personality (the definition)",
    "persona.personality": "appended to the definition after a blank line",
    "attribution.creatorNotes": "becomes Janitor's public Description (bio)",
    "media.portrait": "the avatar; the importer strips the card from it on upload",
  },
};

export default coverage;
