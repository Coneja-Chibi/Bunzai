/** A reusable personality and model choice; seats own execution and the piece carries no credentials. */
import type { CanonicalEntity } from "../../core/canonical";
export interface AgentBody {
  name: string;
  description: string;
  instructions: string;
  connection?: { id: string; model: string };
  temperature?: number;
  contextMessages?: number;
  tools: string[];
  skills: string[];
}
export type CanonicalAgent = CanonicalEntity<"agent", AgentBody>;
export const emptyAgentBody = (name: string): AgentBody => ({ name, description: "", instructions: "", tools: [], skills: [] });
