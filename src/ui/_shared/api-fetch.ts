/**
 * Shared UI → loopback API fetch: attaches the per-launch session token and rejects non-2xx.
 * Token is injected into index HTML as <meta name="vaude-session">; never logged.
 */

import { STALE_SESSION } from "./session-marker";

export class ApiHttpError extends Error {
  readonly status: number;
  /** the server's stable machine code for the refusal, when it sent one ("studio_busy") */
  readonly code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
    if (code) this.code = code;
  }
}

/**
 * Did this failure come back with that HTTP status?
 *
 * NOT `instanceof`, AND THE REASON IS THE BUILD. Each app under /apps is bundled separately, so the
 * shell's copy of this module and the Workbench's copy define two different classes with the same
 * name. `ctx.api` belongs to the shell, so an error it throws is never `instanceof` the Workbench's
 * class - the check silently reads false, forever, for every app that tries it.
 *
 * It cost a real bug: the editor's conflict bar was wired to a 409 it could not recognise, so a
 * save refused because the file had changed went back to being an unexplained failure. Nothing in a
 * typecheck, a lint, or a unit test sees this; the two classes only become two at bundle time.
 */
export const apiStatusIs = (error: unknown, status: number): boolean =>
  typeof error === "object" && error !== null
  && (error as { status?: unknown }).status === status;

/**
 * Announced on the window whenever any call is answered 423: the library locked (the idle lock, or
 * another window). The shell's library gate listens and shows the stage door. A window event, not a
 * shared object, because every app is its own bundle with its own copy of this module.
 */
export const LIBRARY_LOCKED_EVENT = "bunzai:library-locked";
/** A server replaced the document's session; the host offers explicit recovery without discarding drafts. */
export const SESSION_STALE_EVENT = "bunzai:session-stale";


const TOKEN_META = 'meta[name="vaude-session"]';

export function readSessionToken(doc: Document = document): string {
  const el = doc.querySelector(TOKEN_META);
  const t = el?.getAttribute("content")?.trim() ?? "";
  return t;
}

export type ApiFetchInit = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
  /** When true, require a non-empty token (all POSTs). */
  requireToken?: boolean;
};

/**
 * Fetch a same-origin /api/* URL with session token when present.
 * Throws ApiHttpError on non-2xx; never includes the token in the error message.
 */
export async function apiFetch(path: string, init: ApiFetchInit = {}): Promise<Response> {
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  const requireToken = init.requireToken ?? (init.method !== undefined && init.method !== "GET");
  if (requireToken) {
    const token = readSessionToken();
    if (!token) throw new ApiHttpError(403, "missing session");
    headers["X-Bunzai-Token"] = token;
  }
  const { requireToken: _r, headers: _h, ...rest } = init;
  const res = await fetch(path, { ...rest, headers });
  if (res.status === 423 && typeof window !== "undefined") window.dispatchEvent(new Event(LIBRARY_LOCKED_EVENT));
  return res;
}

export async function apiFetchJson<T = unknown>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const msg =
      body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string }).error
        : `request failed (${res.status})`;
    if (res.status === 403 && msg === STALE_SESSION && typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_STALE_EVENT));
    const code = body && typeof body === "object" && typeof (body as { code?: unknown }).code === "string" ? (body as { code: string }).code : undefined;
    throw new ApiHttpError(res.status, msg, code);
  }
  return body as T;
}
