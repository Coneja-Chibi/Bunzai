/** Parse the identical custom header, body, and exclusion controls for provider wire requests. */
import { ProviderError, type ProviderOptions } from "../contracts/provider";
import { isRecord } from "../../core/guards";
import { protectedHeaders, protectedKeys } from "../params/custom";

interface SavedOverrides {
  customHeaders?: string;
  customBody?: string;
  customExcludeBody?: string;
}

export interface RequestOverrides {
  headers?: Record<string, unknown>;
  body?: Record<string, unknown>;
  excluded: string[];
}

/** Apply shared header coercion without changing the provider's existing header insertion order. */
export function applyRequestHeaders(headers: Record<string, string>, custom?: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(custom ?? {})) {
    for (const existing of Object.keys(headers)) if (existing.toLowerCase() === key.toLowerCase()) delete headers[existing];
    headers[key] = String(value);
  }
}

/** Header names are case-insensitive: later entries replace earlier ones of any case, so each name is sent once. */
const mergeHeaders = (...maps: (Record<string, unknown> | undefined)[]): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of maps.flatMap((m) => Object.entries(m ?? {}))) {
    for (const existing of Object.keys(out)) if (existing.toLowerCase() === key.toLowerCase()) delete out[existing];
    out[key] = value;
  }
  return out;
};

/** Apply body overrides in their shared order; the caller supplies its dialect's tool field names. */
export function applyRequestBody(
  body: Record<string, unknown>,
  overrides: Pick<RequestOverrides, "body" | "excluded">,
  disallowTools: boolean,
  toolFields: readonly string[],
): void {
  Object.assign(body, overrides.body);
  for (const key of overrides.excluded) delete body[key];
  if (disallowTools) for (const key of toolFields) delete body[key];
}

function parseMap(text: string | undefined, label: string): Record<string, unknown> | undefined {
  const trimmed = text?.trim();
  if (!trimmed) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new ProviderError(`The custom ${label} could not be read as JSON.`, {
      category: "invalid_request_error",
      code: "invalid_options",
      status: 400,
    });
  }
  if (!isRecord(parsed)) {
    throw new ProviderError(`The custom ${label} must be key-value pairs.`, {
      category: "invalid_request_error",
      code: "invalid_options",
      status: 400,
    });
  }
  return parsed as Record<string, unknown>;
}

export function parseRequestOverrides(
  options: ProviderOptions,
  saved: SavedOverrides,
): RequestOverrides {
  const body = parseMap(options.custom_include_body ?? saved.customBody, "body");
  const excluded = (options.custom_exclude_body ?? saved.customExcludeBody ?? "")
    .split("\n")
    .map((key) => key.trim())
    .filter(Boolean);
  const bad = protectedKeys([...Object.keys(body ?? {}), ...excluded])[0];
  if (bad) {
    throw new ProviderError(`${bad} is a protected request field; a custom body cannot set or remove it.`, { category: "invalid_request_error", code: "invalid_options", status: 400 });
  }
  // Scene text (a scene's own setting, or one an imported preset carried in) may not name a credential. The connection's own headers are
  // the person's setup of their endpoint, so they may (a custom auth scheme), and they win a clash: scene text never overrides them.
  const scene = parseMap(options.custom_include_headers, "headers");
  const blocked = protectedHeaders(Object.keys(scene ?? {}))[0];
  if (blocked) {
    throw new ProviderError(`${blocked.trim()} is a protected request header; a custom header cannot set it.`, { category: "invalid_request_error", code: "invalid_options", status: 400 });
  }
  const own = parseMap(saved.customHeaders, "headers");
  const headers = scene || own ? mergeHeaders(scene, own) : undefined;
  return { headers, body, excluded };
}
