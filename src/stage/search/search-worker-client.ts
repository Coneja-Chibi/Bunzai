/** Persistent request/reply owner for the disposable Stage search worker. */
import { startLaneWorker } from "../worker-lane";
import { searchMessageBytes, SEARCH_MESSAGE_BYTES } from "../../core/search/worker-admission";
import type { SearchWorkerReply, SearchWorkerRequest } from "./search-protocol";

const LIMIT = 64 * 1024 * 1024;
const DEADLINE_MS = 15_000;
const CONTROL_BYTES = 256;
type SearchWorkerValue = Extract<SearchWorkerReply, { ok: true }>["value"];
type Pending = { resolve: (value: SearchWorkerValue) => void; reject: (error: Error) => void; bytes: number; timer: ReturnType<typeof setTimeout>; signal?: AbortSignal; abort?: () => void; cancellable: boolean; cancelled?: boolean };
type SearchWorkerCommand = SearchWorkerRequest extends infer T ? T extends { requestId: number } ? Omit<T, "requestId"> : never : never;

export class SearchWorkerClient {
  private readonly worker: Worker;
  private nextId = 0;
  private queuedBytes = 0;
  private indexedBytes = 0;
  private pending = new Map<number, Pending>();
  private controlRequests = new Set<number>();
  private closed = false;

  get bytes(): number { return this.queuedBytes + this.indexedBytes; }

  constructor(createWorker?: () => Worker) {
    this.worker = createWorker ? createWorker() : startLaneWorker(
      () => new Worker("./stage/search/search-worker.ts"),
      new URL("./search-worker.ts", import.meta.url).href,
    );
    this.worker.onmessage = (event: MessageEvent<SearchWorkerReply>) => this.receive(event.data);
    this.worker.onerror = (event: ErrorEvent) => this.close(new Error(event.message || "search worker failed"));
  }

  private receive(reply: SearchWorkerReply): void {
    const pending = this.pending.get(reply.requestId);
    if (!pending) {
      if (this.controlRequests.delete(reply.requestId)) this.queuedBytes -= CONTROL_BYTES;
      return;
    }
    this.pending.delete(reply.requestId);
    clearTimeout(pending.timer);
    pending.signal?.removeEventListener("abort", pending.abort!);
    this.queuedBytes -= pending.bytes;
    if (!reply.ok) { pending.reject(new Error(reply.reason)); return; }
    const value = reply.value;
    if (value && "bytes" in value) this.indexedBytes = value.bytes;
    if (this.queuedBytes + this.indexedBytes > LIMIT) { pending.reject(new Error("search memory budget exceeded")); return; }
    if (pending.cancelled) return;
    pending.resolve(value);
  }

  request(message: SearchWorkerCommand, signal?: AbortSignal): Promise<SearchWorkerValue> {
    if (this.closed) return Promise.reject(new Error("search worker is closed"));
    if (signal?.aborted) return Promise.reject(new DOMException("aborted", "AbortError"));
    const requestId = ++this.nextId;
    const bytes = searchMessageBytes(message);
    if (bytes > SEARCH_MESSAGE_BYTES) return Promise.reject(new Error("search message exceeds its 2 MiB admission limit"));
    if (this.queuedBytes + this.indexedBytes + bytes > LIMIT) return Promise.reject(new Error("search queue reached its 64 MiB budget"));
    this.queuedBytes += bytes;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.close(new Error("search worker request exceeded its deadline")), DEADLINE_MS);
      const cancel = (): void => {
        const current = this.pending.get(requestId);
        if (!current) return;
        current.signal?.removeEventListener("abort", current.abort!);
        current.reject(new DOMException("aborted", "AbortError"));
        if (!current.cancellable) { this.close(new DOMException("aborted", "AbortError")); return; }
        current.cancelled = true;
        const controlId = ++this.nextId;
        if (this.queuedBytes + this.indexedBytes + CONTROL_BYTES > LIMIT) { this.close(new Error("search cancellation queue exceeded its budget")); return; }
        this.queuedBytes += CONTROL_BYTES;
        this.controlRequests.add(controlId);
        try { this.worker.postMessage({ requestId: controlId, op: "cancel", targetId: requestId } satisfies SearchWorkerRequest); }
        catch { this.close(new Error("search cancellation failed")); }
      };
      const pending: Pending = { resolve, reject, bytes, timer, signal, abort: cancel, cancellable: message.op === "search" };
      this.pending.set(requestId, pending);
      signal?.addEventListener("abort", cancel, { once: true });
      if (signal?.aborted) { cancel(); return; }
      try { this.worker.postMessage({ ...message, requestId } as SearchWorkerRequest); }
      catch (error) { this.pending.delete(requestId); this.queuedBytes -= bytes; clearTimeout(timer); signal?.removeEventListener("abort", cancel); reject(error instanceof Error ? error : new Error("search request failed")); }
    });
  }

  close(reason = new Error("search worker closed")): void {
    if (this.closed) return;
    this.closed = true;
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.terminate();
    this.fail(reason);
  }

  private fail(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.signal?.removeEventListener("abort", pending.abort!);
      pending.reject(error);
    }
    this.pending.clear();
    this.controlRequests.clear();
    this.queuedBytes = 0;
  }
}
