/** Synthetic workflows with an increasing number of private phases, for canonical storage scale checks. */
import { CANONICAL_SCHEMA_VERSION } from "../../../src/core/canonical";
import { emptyPromptbookBody, newBookPhase } from "../../../src/core/promptbook";
import type { CanonicalPromptbook } from "../../../src/entities/promptbook/schema";

export function promptbook(n: number): CanonicalPromptbook {
  const body = emptyPromptbookBody("Scale book");
  body.phases.unshift(...Array.from({ length: n }, (_, i) => newBookPhase(`private-${i}`, `Plan ${i}`, "private")));
  return { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "promptbook", id: "scale-book", body };
}
