/** Synthetic reusable Agents with increasing instruction size, for canonical storage scale checks. */
import { CANONICAL_SCHEMA_VERSION } from "../../../src/core/canonical";
import { emptyAgentBody, type CanonicalAgent } from "../../../src/entities/agent/schema";

export function agent(n: number): CanonicalAgent {
  return { schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "agent", id: "scale-agent", body: { ...emptyAgentBody("Scale Agent"), instructions: "Plan the next beat.\n".repeat(n) } };
}
