/** Shared window-worker wiring; each caller supplies its compile-safe worker factory and its own failure policy. */

export function startDesktopWindow(
  createWorker: () => Worker,
  url: string,
  title: string,
  onError: (error: ErrorEvent) => void,
  onClose: () => void,
): Worker {
  const worker = createWorker();
  worker.addEventListener("error", onError);
  worker.postMessage({ url, title });
  worker.onmessage = onClose;
  return worker;
}
