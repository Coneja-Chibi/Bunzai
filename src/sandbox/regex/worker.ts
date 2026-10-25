/**
 * Dedicated regex execution worker. It accepts value-only requests, applies the existing core
 * engine, and has no API token, DOM, storage, filesystem, or network bridge. The request check and
 * the answer live in request.ts.
 */
import { answerRegexRequest } from "./request";

self.addEventListener("message", (event: MessageEvent<unknown>) => {
  self.postMessage(answerRegexRequest(event.data));
});
