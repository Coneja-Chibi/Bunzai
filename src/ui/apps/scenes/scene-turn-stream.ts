/**
 * Reading one scene turn's server-sent events in the browser (item 11).
 * Pure over a `Response`. Never throws: a stream that ends before its last event reports that the
 * page lost the turn, which keeps running on the server, so the reply lands in the scene anyway and
 * shows the next time it is opened.
 */
import { readSse, typedEvent } from "../../_shared/read-sse";
import type { TurnEvent } from "../../../studio/scene-turn";

const LAST = new Set<TurnEvent["type"]>(["done", "stopped", "failed", "conflict"]);

export async function readSceneTurn(response: Response, onEvent: (event: TurnEvent) => void): Promise<void> {
  const ended = await readSse(response, (v): v is TurnEvent => typedEvent(v), (e) => LAST.has(e.type), onEvent);
  if (!ended) {
    onEvent({ type: "failed", category: "api_error", code: "service_unavailable", message: "This page lost the reply as it was being written. It keeps going in the background; reopen the scene to see it.", draft: "" });
  }
}
