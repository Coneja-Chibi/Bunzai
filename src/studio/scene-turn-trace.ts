/**
 * What a turn stores beside its reply (turn-loop item 10): the trace, plain JSON with no undefined anywhere. Split out of
 * scene-turn.ts for the file-size cap; the route that reads it back is ui/server-chats-trace.ts.
 */
import type { LoreVerdict } from "../core/lore/engine";
import type { AssemblyResult, TraceBlock } from "../core/assembly/types";
import type { JsonObject } from "../stage/contracts/chat-store";
import type { ProviderOptions } from "../stage/contracts/provider";
import { sentParams, type ParamSupport } from "../stage/params/wire";
import { parseRequestOverrides } from "../stage/provider/request-overrides";

/** `book:entry` split back into its two halves (scene-lore's entryKey), for the routes. */
export function splitEntryKey(entryKey: string): { bookId: string; entryId: string } {
  const at = entryKey.indexOf(":");
  return at < 0 ? { bookId: entryKey, entryId: "" } : { bookId: entryKey.slice(0, at), entryId: entryKey.slice(at + 1) };
}

/** Only `detail`'s defined fields, and only when at least one exists (th-t3 plan step 1): the
 * engine's LoreVerdict.detail carries explicit `undefined` values for a field it has no number for,
 * and `checkTrace`'s JSON check (chat-rules.ts) refuses an object holding one. */
function compactDetail(detail: LoreVerdict["detail"]): JsonObject | undefined {
  if (!detail) return undefined;
  const out: JsonObject = {};
  for (const [k, v] of Object.entries(detail)) if (v !== undefined) out[k] = v;
  return Object.keys(out).length > 0 ? out : undefined;
}

/** One verdict, compact (th-t3 plan step 1): entryKey carries book and entry, so the route splits it
 * as it already does for injected/cut hits; no title or content, explain mode never kept either. */
function compactVerdict(v: LoreVerdict): JsonObject {
  const detail = compactDetail(v.detail);
  return { entryKey: v.entryKey, fired: v.fired, reason: v.reason, matched: v.matched, loop: v.loop, tokens: v.tokens, ...(detail ? { detail } : {}) };
}

/** The trace stored with the reply (turn-loop item 10): plain JSON, no undefined anywhere. */
export function traceOf(result: AssemblyResult, model: string, window: { context: number; reply: number; stated: boolean }, estimate: { mid: number; bound: number; samples: number }, options: JsonObject, extra: TraceBlock[] = [], recall?: JsonObject): JsonObject {
  return {
    estimate: { mid: estimate.mid, bound: estimate.bound, samples: estimate.samples },
    blocks: [...result.trace, ...extra].map((b) => ({ source: { ...b.source }, role: b.role, tokens: b.tokens })),
    budget: { budgeter: result.budget.budgeter, trimmed: result.budget.trimmed, finalPassDropped: result.budget.finalPassDropped },
    request: { model, ...options },
    // The Compendium's recall pass (compendium-recall.ts): counts and titles, never prompt text.
    ...(recall ? { recall } : {}),
    // Summary-aware truncation (core/assembly/summary-cut.ts): the messages recaps replaced and the recap blocks sent for them.
    ...(result.summaries ? { summaries: result.summaries } : {}),
    // The macro pass and the variables it changed (core/assembly/macro-report.ts): the Context wing's Macros tab and each variable's history. Absent when there was nothing to say.
    ...(result.macros ? { macros: result.macros } : {}),
    ...(result.changes ? { variables: result.changes } : {}),
    // The chat summary's Hide messages already covered: the messages it stood in for (assemble.ts), by id.
    ...(result.chatSummary ? { chatSummary: result.chatSummary } : {}),
    // `stated: false` means the window is RoleCall's guess, which the Context wing says.
    window: { context: window.context, reply: window.reply, stated: window.stated },
    ...(result.lore
      ? {
          lore: {
            fires: result.lore.fires,
            injected: result.lore.injected.map((h) => ({ ...splitEntryKey(h.entryKey), ...h })),
            cut: result.lore.cut.map((h) => ({ ...splitEntryKey(h.entryKey), ...h })),
            totalTokens: result.lore.totalTokens,
            seed: result.lore.seed,
            undo: result.lore.undo,
            // th-t3 plan step 1: one compact verdict per entry, for TrackHare's "missed" list.
            verdicts: result.lore.verdicts.map(compactVerdict),
            ...(result.lore.verdictsTruncated ? { verdictsTruncated: true } : {}),
          },
        }
      : {}),
  } as unknown as JsonObject;
}

/**
 * The request's options as the trace keeps them: what the provider was actually given (`sent`, from
 * the same mapping its request builder runs), what it was not and why (`notSent`), and custom header
 * names only, since a header's value can be a credential.
 */
export function traceOptions(options: ProviderOptions, support: ParamSupport | undefined, model: string): JsonObject {
  const { custom_include_headers: headers, ...rest } = options;
  const sent = sentParams(support, options, model);
  let names: string[] | undefined;
  if (headers?.trim()) {
    try {
      names = Object.keys(parseRequestOverrides({ custom_include_headers: headers }, {}).headers ?? {});
    } catch {
      names = [];
    }
  }
  return { ...rest, sent: sent.fields, notSent: sent.notSent, ...(names ? { customHeaderNames: names } : {}) } as unknown as JsonObject;
}

/** What the Prompt Inspector shows of the parameters going out: the fields sent, the ones left out and why, and the custom text (header names only). */
export interface RequestParams {
  sent: Record<string, unknown>;
  notSent: { id: string; why: string }[];
  customBody?: string;
  customExclude?: string;
  customHeaderNames?: string[];
}

export function requestParams(shown: JsonObject): RequestParams {
  return {
    sent: shown["sent"] as Record<string, unknown>,
    notSent: shown["notSent"] as RequestParams["notSent"],
    ...(typeof shown["custom_include_body"] === "string" ? { customBody: shown["custom_include_body"] } : {}),
    ...(typeof shown["custom_exclude_body"] === "string" ? { customExclude: shown["custom_exclude_body"] } : {}),
    ...(Array.isArray(shown["customHeaderNames"]) ? { customHeaderNames: shown["customHeaderNames"] as string[] } : {}),
  };
}

/** One try at a reply, as the trace keeps it (the Context wing's Route tab): which connection and model, and how it ended. */
export interface RouteAttempt {
  connectionId: string;
  kind: string;
  model: string;
  outcome?: "answered" | "failed" | "stopped";
  status?: number;
  code?: string;
  message?: string;
  /** The model the provider reported answering, when it is not the one asked for. */
  served?: string;
}

const MESSAGE_CHARS = 300;

/** An attempt that failed, with the provider's own status and code and a bounded message (never a body). */
export function failedAttempt(attempt: RouteAttempt, error: unknown): RouteAttempt {
  const e = error as { status?: unknown; code?: unknown; message?: unknown };
  const message = typeof e?.message === "string" ? e.message.slice(0, MESSAGE_CHARS) : undefined;
  return {
    ...attempt,
    outcome: "failed",
    ...(typeof e?.status === "number" ? { status: e.status } : {}),
    ...(typeof e?.code === "string" ? { code: e.code } : {}),
    ...(message ? { message } : {}),
  };
}

/** The route as stored: every attempt but the last failed; the last ended as `last` says. */
export function routeOf(attempts: readonly RouteAttempt[], last: "answered" | "stopped", served?: string): JsonObject {
  return {
    attempts: attempts.map((a, i): JsonObject => {
      const done = i === attempts.length - 1;
      const out = { ...a, outcome: a.outcome ?? (done ? last : "failed"), ...(done && served && served !== a.model ? { served } : {}) };
      return out as unknown as JsonObject;
    }),
  };
}
