/** Validate and copy search inputs before the serialized service retains them. */
import type { EntitySummary } from "../../studio/store";
import { parseSearchRequest, type SearchRequest } from "../../core/search/contracts";

const MAX_FIELD = 4096;

export function assertSearchString(value: unknown, max = MAX_FIELD): string {
  if (typeof value !== "string" || value.length > max) throw new TypeError("search field exceeds its admission limit");
  return value;
}

export function projectSearchSummary(value: EntitySummary): { summary: EntitySummary; bytes: number } {
  if (!value || typeof value !== "object") throw new TypeError("invalid search summary");
  const id = assertSearchString(value.id, 240);
  const kind = assertSearchString(value.kind, 80);
  const name = assertSearchString(value.name);
  const tags = value.tags ?? [];
  if (!Array.isArray(tags) || tags.length > 128) throw new TypeError("search tag count exceeds its admission limit");
  const copiedTags = tags.map((tag) => assertSearchString(tag, 256));
  const sourceFormat = value.sourceFormat ? assertSearchString(value.sourceFormat, 120) : undefined;
  const sourceVariant = value.sourceVariant ? assertSearchString(value.sourceVariant, 120) : undefined;
  const provenance = (value as EntitySummary & { provenance?: string }).provenance;
  const copiedProvenance = provenance ? assertSearchString(provenance, 512) : undefined;
  if (value.hasPortrait !== undefined && typeof value.hasPortrait !== "boolean") throw new TypeError("invalid search portrait flag");
  if (!id || !kind) throw new TypeError("search identity is empty");
  const summary = {
    id, kind, name, tags: copiedTags,
    ...(sourceFormat ? { sourceFormat } : {}), ...(sourceVariant ? { sourceVariant } : {}),
    ...(copiedProvenance ? { provenance: copiedProvenance } : {}),
    ...(value.hasPortrait !== undefined ? { hasPortrait: value.hasPortrait } : {}),
  } as EntitySummary & { provenance?: string };
  return { summary, bytes: 96 + (id.length + kind.length + name.length + copiedTags.reduce((n, tag) => n + tag.length, 0)
    + (sourceFormat?.length ?? 0) + (sourceVariant?.length ?? 0) + (copiedProvenance?.length ?? 0)) * 2 };
}

export function projectSearchRequest(input: SearchRequest): { request: SearchRequest; bytes: number } {
  const request = parseSearchRequest(input);
  if (!request) throw new TypeError("invalid search request");
  const scope = request.scope;
  const bytes = 128 + request.query.length * 2 + (request.kinds ?? []).reduce((n, kind) => n + 16 + kind.length * 2, 0)
    + (scope?.kind === "lorebook-entry" ? 64 + scope.id.length * 2 + (scope.revision?.length ?? 0) * 2 : 0);
  return { request, bytes };
}
