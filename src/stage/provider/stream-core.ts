/**
 * Applying streamed pieces to a buffer, ported from RoleCall (ai/streaming/
 * stream-delta.ts). Offsets let a reconnecting consumer apply only what it lacks; an authoritative
 * `full` value wins so text the server removed cannot linger. Pure.
 */
import type { ProviderEvent, StreamChannel } from "../contracts/provider";

/** The part of `delta` a buffer of `currentLength` characters does not have yet. */
export function missingStreamSuffix(
  currentLength: number,
  delta: string,
  startOffset: number | undefined,
  endOffset: number | undefined,
): string {
  if (!delta) return "";
  if (typeof startOffset !== "number" || typeof endOffset !== "number") return delta;
  if (currentLength >= endOffset) return "";
  if (currentLength <= startOffset) return delta;
  return delta.slice(currentLength - startOffset);
}

/** The buffer after one event. A `full` value replaces it outright. */
export function applyStreamEvent(previous: string, event: ProviderEvent): string {
  if ("full" in event) return event.full;
  return previous + missingStreamSuffix(previous.length, event.delta, event.startOffset, event.endOffset);
}

/** A delta stamped with the character range it covers, for a producer to send. */
export function withStreamOffsets(
  channel: StreamChannel,
  delta: string,
  startOffset: number,
  endOffset: number,
): ProviderEvent {
  return { channel, delta, startOffset, endOffset };
}

/** Append one response delta and stamp it with the exact range it added. */
export function appendStreamDelta(
  events: ProviderEvent[],
  current: string,
  delta: string,
  channel: StreamChannel,
): string {
  if (delta) events.push(withStreamOffsets(channel, delta, current.length, current.length + delta.length));
  return current + delta;
}
