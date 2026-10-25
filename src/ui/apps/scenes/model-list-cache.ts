/**
 * One read of each connection's model list, kept for a few minutes and shared by everything that lists
 * models (the AI wing, the Control Booth's pickers): reopening a wing, switching tabs or typing in a
 * search never asks the provider again. A request already in flight is joined, never repeated. A
 * failed read is not kept, so reopening (or Retry) asks again. Held per API object, so a fresh
 * context starts with an empty cache.
 */
import type { AppContext } from "../../app-contract";
import { toErrorMessage } from "../../_shared/error-message";
import type { AsyncState } from "../../_shared/async-state";

export type Models = AsyncState<
  { ids: { id: string; label?: string; context?: number }[] },
  { state: "failed"; why: string; saved: string }
>;

const TTL_MS = 5 * 60_000;
const held = new WeakMap<object, Map<string, { at: number; read: Promise<Models> }>>();

/** The connection's models: from the cache while fresh, else one fresh read (`force` skips the cache). */
export function readModels(ctx: AppContext, id: string, saved: string, force = false): Promise<Models> {
  const mine = held.get(ctx.api) ?? new Map<string, { at: number; read: Promise<Models> }>();
  held.set(ctx.api, mine);
  const hit = mine.get(id);
  if (hit && !force && Date.now() - hit.at < TTL_MS) return hit.read;
  const read: Promise<Models> = ctx.api.connectionModels(id).then(
    (r): Models => (r.models ? { state: "ready", ids: r.models } : r.failed ? { state: "failed", why: r.failed, saved: r.saved } : { state: "ready", ids: [{ id: r.saved }] }),
    (e: unknown): Models => ({ state: "failed", why: toErrorMessage(e), saved }),
  );
  mine.set(id, { at: Date.now(), read });
  void read.then((m) => { if (m.state === "failed" && mine.get(id)?.read === read) mine.delete(id); });
  return read;
}
