/** Development SSE lifecycle: offer updates without navigating away from active widgets or drafts. */
import type { DevUpdate } from "./shell/store-dev-update";

export function connectDevReload(source: EventTarget, onUpdate: (reason: DevUpdate) => void, onStatus: (text: string) => void,
  clock: Pick<Window, "setTimeout" | "clearTimeout"> = window): () => void {
  let bootId: string | null = null;
  let down = false;
  let timer: number | null = null;
  const message = (event: Event): void => {
    const data: unknown = (event as MessageEvent<unknown>).data;
    if (data === "reload") onUpdate("source");
    if (typeof data !== "string" || !data.startsWith("hello ")) return;
    const id = data.slice("hello ".length);
    if (timer !== null) { clock.clearTimeout(timer); timer = null; }
    if (bootId !== null && bootId !== id) onUpdate("restart");
    if (down) onStatus("Studio server is back.");
    bootId = id;
    down = false;
  };
  const error = (): void => {
    if (bootId === null || down || timer !== null) return;
    timer = clock.setTimeout(() => {
      timer = null; down = true;
      onStatus("Studio server is not running. Your work stays open; reconnecting...");
    }, 8000);
  };
  source.addEventListener("message", message);
  source.addEventListener("error", error);
  return () => {
    source.removeEventListener("message", message);
    source.removeEventListener("error", error);
    if (timer !== null) clock.clearTimeout(timer);
  };
}
