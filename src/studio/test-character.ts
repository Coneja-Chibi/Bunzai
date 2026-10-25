/** Shared typed canonical character fixture for bundle and server contract tests. */
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import type { CanonicalCharacter } from "../entities/character/schema";

export function testCharacter(
  id: string,
  refs: string[] = [],
  options: {
    name?: string;
    firstMessage?: string;
    alternateGreetings?: string[];
    original?: CanonicalCharacter["original"];
  } = {},
): CanonicalCharacter {
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "character",
    id,
    body: {
      identity: { name: options.name ?? id },
      persona: {},
      prompts: {},
      greetings: {
        ...(options.firstMessage === undefined ? {} : { firstMessage: options.firstMessage }),
        ...(options.alternateGreetings ? { alternateGreetings: options.alternateGreetings.map((text) => ({ text })) } : {}),
      },
      examples: {},
      attribution: {},
      discovery: {},
      media: {},
      knowledgeRefs: refs.length ? refs : undefined,
    },
    ...(options.original === undefined ? {} : { original: options.original }),
  };
}
