/**
 * The browser end of a Dramaturg turn (specs/stage/dramaturg.md, "A turn"): a refusal before the stream opens becomes the server's own
 * words as an ApiHttpError, and the stream's server-sent events are handed over one by one through the shared reader (_shared/read-sse.ts).
 * Never throws once the stream is open: one that ends without its last event reports that the page lost the answer, which the server
 * finishes and saves anyway.
 */
import { ApiHttpError } from "../../../../_shared/api-fetch";
import { readSse } from "../../../../_shared/read-sse";
import type { DramaturgStreamEvent } from "../../../../app-contract-dramaturg";
import { isPlainObject } from "../../../../../core/guards";
import { decodeDramaturg } from "../../../../../stage/store/dramaturg-rules";
import { readStreamCapped } from "../../../../../core/stream-bytes";

const LAST = new Set<DramaturgStreamEvent["type"]>(["done", "failed", "stopped"]);
const KEYS: Record<DramaturgStreamEvent["type"], readonly string[]> = { text: ["type", "delta"], read: ["type", "tool", "summary"], done: ["type", "thread"], stopped: ["type", "thread"], failed: ["type", "message", "thread"] };

function accept(value: unknown): value is DramaturgStreamEvent {
  if (!isPlainObject(value) || typeof value.type !== "string" || !Object.hasOwn(KEYS, value.type)) return false;
  const kind = value.type as DramaturgStreamEvent["type"];
  if (Object.keys(value).some((key) => !KEYS[kind].includes(key))) return false;
  if (kind === "text") return typeof value.delta === "string";
  if (kind === "read") return typeof value.tool === "string" && value.tool.length <= 64 && typeof value.summary === "string" && value.summary.length <= 300;
  if (kind === "failed" && (typeof value.message !== "string" || value.message.length > 600)) return false;
  if (value.thread === undefined) return kind === "failed";
  if (!isPlainObject(value.thread) || Object.keys(value.thread).some((key) => !["settings", "entries", "revision"].includes(key)) || typeof value.thread.revision !== "number") return false;
  try {
    const { revision, ...record } = value.thread;
    decodeDramaturg(record, revision);
    return true;
  } catch { return false; }
}

/** The server's refusal, in its words and with its code, as apiFetchJson would have thrown it. */
export async function refusalOf(res: Response): Promise<ApiHttpError> {
  const read = await readStreamCapped(res.body, 64 * 1024);
  const text = read.ok ? new TextDecoder().decode(read.bytes) : "";
  let body: unknown = null;
  try { body = text ? JSON.parse(text) as unknown : null; } catch { body = null; }
  const rec = body && typeof body === "object" ? body as { error?: unknown; code?: unknown } : {};
  return new ApiHttpError(res.status, typeof rec.error === "string" ? rec.error : `request failed (${res.status})`, typeof rec.code === "string" ? rec.code : undefined);
}

export async function readDramaturgStream(response: Response, onEvent: (event: DramaturgStreamEvent) => void): Promise<void> {
  const ended = await readSse(response, accept, (e) => LAST.has(e.type), onEvent);
  if (!ended) onEvent({ type: "failed", message: "This page lost the answer as it was being written. It keeps going in the background; reopen the Dramaturg to see it." });
}
