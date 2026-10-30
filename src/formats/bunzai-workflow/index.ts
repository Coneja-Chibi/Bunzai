/** Bunzai's portable Promptbook and Agent files preserve their complete canonical bodies. */
import type { AdapterInput, KindAdapter } from "../../core/adapter";
import { parseCanonicalEntity, type ParsedCanonicalEntity } from "../../entities/runtime-schema";
import { readJsonAny } from "../_shared/card-io";

function workflowAdapter<K extends "promptbook" | "agent">(kind: K): KindAdapter<K> {
  const parse = (input: AdapterInput): Extract<ParsedCanonicalEntity, { kind: K }> => {
    const entity = parseCanonicalEntity(readJsonAny(input));
    if (entity.kind !== kind) throw new Error(`This file is not a Bunzai ${kind}.`);
    return entity as Extract<ParsedCanonicalEntity, { kind: K }>;
  };
  return {
    id: `bunzai-${kind}`, label: `Bunzai ${kind === "agent" ? "Agent" : "Promptbook"}`, kind, native: true,
    outputExtensions: ["json"],
    detect: (input) => { try { parse(input); return 1; } catch { return 0; } },
    toCanonical: parse,
    fromCanonical: (entity) => ({ text: JSON.stringify(entity, null, 2), suggestedExtension: "json" }),
  };
}
export default [workflowAdapter("promptbook"), workflowAdapter("agent")];
