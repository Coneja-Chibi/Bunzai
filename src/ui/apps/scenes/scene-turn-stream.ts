/**
 * Reading one scene turn's server-sent events in the browser (item 11).
 * Pure over a `Response`. Never throws: a stream that ends before its last event reports that the
 * page lost the turn, which keeps running on the server, so the reply lands in the scene anyway and
 * shows the next time it is opened.
 */
import { chunksOf } from "../../../core/stream-bytes";
import type { TurnEvent } from "../../../studio/scene-turn";

const LAST = new Set<TurnEvent["type"]>(["done", "stopped", "failed", "conflict"]);

export async function readSceneTurn(response: Response, onEvent: (event: TurnEvent) => void): Promise<void> {
  let ended = false;
  const emit = (frame: string): void => {
    const data = frame.split("\n").find((line) => line.startsWith("data: "));
    if (!data) return;
    let event: TurnEvent;
    try {
      event = JSON.parse(data.slice(6)) as TurnEvent;
    } catch {
      return;
    }
    if (LAST.has(event.type)) ended = true;
    onEvent(event);
  };
  try {
    if (response.body) {
      const decoder = new TextDecoder();
      let buffer = "";
      for await (const value of chunksOf(response.body)) {
        buffer += decoder.decode(value, { stream: true });
        let cut: number;
        while ((cut = buffer.indexOf("\n\n")) >= 0) {
          emit(buffer.slice(0, cut));
          buffer = buffer.slice(cut + 2);
        }
      }
      if (buffer.trim()) emit(buffer);
    }
  } catch {
    // Reported below: the page lost the stream, not the turn.
  }
  if (!ended) {
    onEvent({ type: "failed", category: "api_error", code: "service_unavailable", message: "This page lost the reply as it was being written. It keeps going in the background; reopen the scene to see it.", draft: "" });
  }
}
