/**
 * A scene's own generation parameters (ChatStore rule 19, `ChatPreset.samplers`): which registry
 * parameters it switched on, each with its value, and the Custom Request Parameters text. `on: false`
 * is an explicit "off", so a library preset's own value can be switched off for one scene. Pure.
 */
import { isPlainObject } from "../../core/guards";
import { customProblem } from "./custom";
import { paramById } from "./index";
import type { ParamDef, ParamValue } from "./types";

export interface SceneParam {
  on: boolean;
  /** Absent means the registry's default. */
  value?: ParamValue;
}

export interface SceneGeneration {
  params?: Record<string, SceneParam>;
  customHeaders?: string;
  customBody?: string;
  /** One body field name per line. */
  customExclude?: string;
}

const CUSTOM_FIELDS = { customHeaders: "headers", customBody: "body", customExclude: "exclude" } as const;
export const GENERATION_KEYS: readonly (keyof SceneGeneration)[] = ["params", ...(Object.keys(CUSTOM_FIELDS) as (keyof typeof CUSTOM_FIELDS)[])];

const MAX_PARAMS = 200;
const MAX_STRING = 16_384;
const MAX_JSON = 65_536;

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Logit Bias is a list of entries (words, a {verbatim} word or [token ids]) each with a bias. */
function biasProblem(v: Record<string, unknown>): string | null {
  const list = v["entries"];
  if (Object.keys(v).length !== 1 || !Array.isArray(list) || list.length > 200) return "must hold up to 200 entries";
  const ok = list.every((e) => isPlainObject(e) && typeof e["id"] === "string" && typeof e["text"] === "string" && e["text"].length <= 256 && finite(e["value"]));
  if (!ok) return "entries need an id, text and a number";
  return list.every((e) => (e as { value: number }).value >= -100 && (e as { value: number }).value <= 100) ? null : "biases must be numbers from -100 to 100";
}

/** Why this value does not fit the parameter, or null when it does. */
function valueProblem(def: ParamDef, v: unknown): string | null {
  switch (def.kind) {
    case "range":
    case "integer":
      if (!finite(v)) return "must be a finite number";
      if (def.kind === "integer" && !Number.isInteger(v)) return "must be a whole number";
      return (def.min !== undefined && v < def.min) || (def.max !== undefined && v > def.max) ? `must be between ${def.min} and ${def.max}` : null;
    case "boolean":
      return typeof v === "boolean" ? null : "must be true or false";
    case "array":
      return Array.isArray(v) && v.length <= 64 && v.every((s) => typeof s === "string" && s.length > 0 && s.length <= 256) ? null : "must be a list of up to 64 non-empty text lines";
    case "object":
      if (!isPlainObject(v) || JSON.stringify(v).length > MAX_JSON) return "must be a JSON object";
      if (def.id === "logit_bias") return biasProblem(v);
      return null;
    case "string":
      if (typeof v !== "string" || v.length > MAX_STRING) return "must be text";
      if (def.id === "dry_sequence_breakers") {
        try {
          const list: unknown = JSON.parse(v);
          return Array.isArray(list) && list.every((s) => typeof s === "string") ? null : "must be a JSON list of text";
        } catch {
          return "must be a JSON list of text";
        }
      }
      return null;
    case "select":
      return typeof v === "string" && v.length <= 64 ? null : "must be text";
  }
}

/** Why these scene parameters cannot be stored, or null. Unknown ids and out-of-range values are refused, never dropped. */
export function sceneParamsProblem(raw: unknown): string | null {
  if (!isPlainObject(raw)) return "params must be a plain object";
  const entries = Object.entries(raw);
  if (entries.length > MAX_PARAMS) return `params holds at most ${MAX_PARAMS} entries`;
  for (const [id, entry] of entries) {
    const def = paramById(id);
    if (!def) return `params has an unknown parameter: ${id}`;
    if (!isPlainObject(entry) || Object.keys(entry).some((k) => k !== "on" && k !== "value")) return `params ${id} must be { on, value }`;
    if (typeof entry["on"] !== "boolean") return `params ${id} on must be true or false`;
    if (entry["value"] !== undefined) {
      const why = valueProblem(def, entry["value"]);
      if (why) return `params ${id} value ${why}`;
    }
  }
  return null;
}

/** Why a custom request text cannot be stored, or null. */
export function customTextProblem(key: keyof typeof CUSTOM_FIELDS, raw: unknown): string | null {
  if (typeof raw !== "string") return `${key} must be text`;
  const why = customProblem(CUSTOM_FIELDS[key], raw);
  return why ? `${key}: ${why}` : null;
}

/** The scene's generation part of its sampler overrides, and only that. */
export function sceneGeneration(samplers: SceneGeneration): SceneGeneration {
  const out: SceneGeneration = {};
  for (const key of GENERATION_KEYS) if (samplers[key] !== undefined) Object.assign(out, { [key]: samplers[key] });
  return out;
}

/** The values to send: every switched-on parameter, at its value or the registry's default; a parameter with neither has nothing to send. */
export function enabledValues(params: SceneGeneration["params"]): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const [id, p] of Object.entries(params ?? {})) {
    const v = p.value ?? paramById(id)?.default ?? undefined;
    if (p.on && v !== undefined) out[id] = v;
  }
  return out;
}
