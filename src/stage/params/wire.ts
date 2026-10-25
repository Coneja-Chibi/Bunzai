/**
 * Generation parameters at the provider boundary. A provider declares, in its own spoke, the
 * parameters it accepts and the one wire name each goes under (never aliases); this pure builder turns
 * a scene's resolved values into those wire fields and says which it left out and why. The request
 * builders and the stored trace both read this result, so what is recorded is what was sent.
 */
import type { ProviderOptions } from "../contracts/provider";
import { PARAMS } from "./index";
import type { ParamValue } from "./types";

type Values = Readonly<Record<string, ParamValue>>;

/** `true` sends under the parameter's own id, a string renames it, an object also reshapes the value (undefined drops it). */
export type WireRule = true | string | { key: string; to(value: ParamValue, all: Values, model: string): unknown };
export type ParamSupport = Readonly<Record<string, WireRule>>;

export type NotSentWhy = "unsupported" | "neutral" | "parent-off" | "unusable";
export interface NotSent {
  id: string;
  why: NotSentWhy;
}
export interface WireParams {
  fields: Record<string, unknown>;
  notSent: NotSent[];
}

/** Samplers that do nothing at this value; some gateways reject the request for the key's mere presence. */
const NEUTRAL: Readonly<Record<string, number>> = { top_k: 0, top_a: 0, min_p: 0, frequency_penalty: 0, presence_penalty: 0, repetition_penalty: 1 };

/** Whether the provider accepts this parameter at all (what the panel's "not sent to" marker reads). */
export const accepts = (support: ParamSupport, id: string): boolean => Object.hasOwn(support, id);

/** The wire fields for the values a scene enabled. `parents` maps a sub-toggle's id to its parent's id. */
export function wireParams(support: ParamSupport, values: Values, parents: Readonly<Record<string, string>> = {}, model = ""): WireParams {
  const fields: Record<string, unknown> = {};
  const notSent: NotSent[] = [];
  const conditions = new Set(Object.values(parents));
  for (const [id, value] of Object.entries(values)) {
    const rule = Object.hasOwn(support, id) ? support[id]! : undefined;
    // A parent switch (Enable Thinking) only decides whether its children go; it is no field of its own.
    if (rule === undefined && conditions.has(id)) continue;
    if (rule === undefined) notSent.push({ id, why: "unsupported" });
    else if (parents[id] !== undefined && values[parents[id]!] !== true) notSent.push({ id, why: "parent-off" });
    else if (NEUTRAL[id] === value) notSent.push({ id, why: "neutral" });
    else {
      const key = rule === true ? id : typeof rule === "string" ? rule : rule.key;
      const sent = typeof rule === "object" ? rule.to(value, values, model) : value;
      if (sent === undefined) notSent.push({ id, why: "unusable" });
      else fields[key] = sent;
    }
  }
  return { fields, notSent };
}

/** Support for a connection that declares none: the two penalties every OpenAI-compatible server reads. */
export const BASE_SUPPORT: ParamSupport = { frequency_penalty: true, presence_penalty: true };

const FLAT = ["top_k", "top_a", "min_p", "frequency_penalty", "presence_penalty", "repetition_penalty"] as const;

const PARENTS: Readonly<Record<string, string>> = Object.fromEntries(PARAMS.flatMap((p) => (p.parentId ? [[p.id, p.parentId]] : [])));

/**
 * What a request sends beyond the base fields: the preset's typed samplers, over which the scene's
 * enabled parameters win, mapped through the provider's own support. The one function the request
 * builders and the stored trace both call.
 */
export function sentParams(support: ParamSupport | undefined, options: Pick<ProviderOptions, "params" | (typeof FLAT)[number]>, model = ""): WireParams {
  const values: Record<string, ParamValue> = {};
  for (const key of FLAT) if (options[key] !== undefined) values[key] = options[key]!;
  return wireParams(support ?? BASE_SUPPORT, { ...values, ...options.params }, PARENTS, model);
}
