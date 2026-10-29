/** Characterizes shared desktop-window worker wiring while callers retain their worker factories. */
import { expect, test } from "bun:test";
import { startDesktopWindow } from "./desktop-window-launch";

test("starts the supplied worker, reports its error, sends the window target, and handles close", () => {
  const error = (): void => undefined;
  const close = (): void => undefined;
  const worker = {
    addEventListener: (_type: string, listener: (event: ErrorEvent) => void) => expect(listener).toBe(error),
    postMessage: (message: unknown) => expect(message).toEqual({ url: "http://127.0.0.1:8321", title: "Bunzai." }),
    onmessage: null as ((event: MessageEvent) => void) | null,
  } as unknown as Worker;
  let created = false;

  const result = startDesktopWindow(() => {
    created = true;
    return worker;
  }, "http://127.0.0.1:8321", "Bunzai.", error, close);

  expect(created).toBe(true);
  expect(result).toBe(worker);
  expect(worker.onmessage).toBe(close);
});
