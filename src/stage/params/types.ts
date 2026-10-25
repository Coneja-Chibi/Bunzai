/**
 * The generation parameter registry's shape: one entry per parameter a scene may send to its model
 * (RoleCall's SamplerParameter, lib/ai/samplers/definitions.ts). `id` is the stored key and the
 * canonical wire name; `aliases` are shown under the label and are never sent.
 */

/** The panel group a parameter is listed in. Core, reasoning and thinking are owned by the AI wing's own cards. */
export type ParamGroup = "core" | "reasoning" | "thinking" | "nucleus" | "penalties" | "constraints" | "advanced";

export type ParamKind = "range" | "integer" | "boolean" | "string" | "array" | "object" | "select";

/** What a parameter holds. A JSON object is stored parsed, a list of stop strings as strings. */
export type ParamValue = number | boolean | string | string[] | { [key: string]: unknown };

export interface ParamDef {
  id: string;
  label: string;
  group: ParamGroup;
  kind: ParamKind;
  min?: number;
  max?: number;
  step?: number;
  /** What a card shows when it is switched on with no value yet; null for a parameter with no starting value. */
  default: ParamValue | null;
  unit?: string;
  aliases?: readonly string[];
  placeholder?: string;
  multiline?: boolean;
  /** A sub-toggle of this parameter: shown indented and greyed while the parent is off. */
  parentId?: string;
  description: string;
  notes?: string;
}
