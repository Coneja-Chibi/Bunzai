/**
 * Saucepan coverage: what its Companion Importer (/labs/companion-importer) keeps from a `chara` PNG
 * under its default field mapping. Grounded in Saucepan's production bundle (read 2026-10-24).
 */
import type { CoverageDecl } from "../../core/coverage";

const coverage: CoverageDecl = {
  carries: [
    "identity.name",
    "identity.description",
    "persona.personality",
    "persona.scenario",
    "greetings.firstMessage",
    "greetings.alternateGreetings",
    "examples.exampleMessages",
    "attribution.creatorNotes",
    "discovery.tags",
    "media.portrait",
  ],
  notes: {
    "identity.description": "description, personality and scenario merge into Saucepan's Information (card)",
    "greetings.alternateGreetings": "become Scenario 2..N; Saucepan keeps at most 50 scenarios",
    "attribution.creatorNotes": "becomes Saucepan's public Description (full_description)",
    "media.portrait": "the avatar; the importer strips the card from it on upload",
  },
};

export default coverage;
