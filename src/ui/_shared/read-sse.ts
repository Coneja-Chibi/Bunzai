/**
 * Reading a server-sent event stream of JSON events in the browser, the one reader every streamed answer uses (a scene turn, a Dramaturg turn).
 * Frames split on a blank line; a frame's `data: ` line is parsed as JSON and handed over when `accept` says it is an event of the stream, and
 * anything else (a `: ping` comment, a malformed line, an unknown event) is skipped. Never throws: a body that errors or ends is simply the end.
 * Answers whether a final event (`isLast`) arrived, so the caller can say the page lost the answer when one did not.
 */
import { chunksOf } from "../../core/stream-bytes";

export async function readSse<E>(response: Response, accept: (value: unknown) => value is E, isLast: (event: E) => boolean, onEvent: (event: E) => void): Promise<boolean> {
  let ended = false;
  const emit = (frame: string): void => {
    const data = frame.split("\n").find((line) => line.startsWith("data: "));
    if (!data) return;
    let value: unknown;
    try { value = JSON.parse(data.slice(6)); } catch { return; }
    if (!accept(value)) return;
    if (isLast(value)) ended = true;
    onEvent(value);
  };
  try {
    if (response.body) {
      const decoder = new TextDecoder();
      let buffer = "";
      for await (const value of chunksOf(response.body)) {
        buffer += decoder.decode(value, { stream: true });
        // A terminal Dramaturg frame can carry 200 entries of 40K characters, including JSON escapes.
        if (buffer.length > 64 * 1024 * 1024) return false;
        let cut: number;
        while ((cut = buffer.indexOf("\n\n")) >= 0) {
          emit(buffer.slice(0, cut));
          buffer = buffer.slice(cut + 2);
        }
      }
      if (buffer.trim()) emit(buffer);
    }
  } catch {
    // The page lost the stream, not the work: the caller reports it from the answer.
  }
  return ended;
}

/** True for a parsed JSON object with a string `type`, the shape every streamed event has. */
export const typedEvent = (value: unknown): value is { type: string } => !!value && typeof value === "object" && typeof (value as { type?: unknown }).type === "string";
