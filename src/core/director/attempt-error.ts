/**
 * How a failed planning attempt is named in the activity log (RoleCall `dm/attempt-error-sanitizer.ts`). A provider's error message is untrusted: several APIs copy request excerpts or
 * private prompt text into it. Only a category and a numeric HTTP status derived from it may leave this function, so the log, which is kept with the story, never holds the message.
 */
import { hasErrorName } from "../guards";

const MAX = 240;

export function attemptError(error: unknown): string {
  const raw = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");
  const status = raw.match(/(?:\bHTTP\s*|\bstatus(?:\s+code)?\s*[:=]?\s*|\bProvider\s*\()\b([1-5]\d{2})\b/i)?.[1];
  let kind = "unclassified provider error";
  if (hasErrorName(error, "AbortError")) kind = "request aborted";
  else if (/\b(?:timed?\s*out|timeout|deadline exceeded)\b/i.test(raw)) kind = "provider request timed out";
  else if (/\b(?:rate.?limit|too many requests)\b/i.test(raw) || status === "429") kind = "provider rate limit";
  else if (/\b(?:unauthori[sz]ed|forbidden|authentication|invalid api key)\b/i.test(raw) || status === "401" || status === "403") kind = "provider authentication failure";
  else if (/\b(?:billing|credit|balance|quota)\b/i.test(raw)) kind = "provider billing or quota failure";
  else if (/\b(?:tool.?call|function.?call|tools? unsupported)\b/i.test(raw)) kind = "provider tool-call failure";
  else if (/\b(?:json|parse|malformed|invalid response)\b/i.test(raw)) kind = "provider response parse failure";
  else if (/\b(?:network|fetch failed|connection|socket|dns|econn)\b/i.test(raw)) kind = "provider network failure";
  else if (status) kind = "provider request failed";
  return `${kind}${status ? ` (HTTP ${status})` : ""}`.slice(0, MAX);
}
