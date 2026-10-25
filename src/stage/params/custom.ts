/**
 * Custom Request Parameters (RoleCall's three text boxes, SamplerPanel.tsx:1348): headers to add, body
 * fields to add, and body fields to remove. A scene's text is checked here when it is saved, so a
 * mistake is said at once instead of failing a reply later; the provider boundary checks the same
 * protected names again (request-overrides.ts). A deviation from RoleCall: JSON only, where it also
 * read YAML and quietly ignored text it could not read; and the credential and framing headers are protected.
 */
import { isRecord } from "../../core/guards";

/** The request's own fields: a custom body may neither replace them nor remove them. */
export const PROTECTED_BODY_KEYS: readonly string[] = ["model", "messages", "stream", "tools", "tool_choice"];

/** Headers the host sets itself (credentials, framing, API version): a custom header may never replace them. Compared lowercase and trimmed. */
export const PROTECTED_HEADER_KEYS: readonly string[] = [
  "authorization", "proxy-authorization", "x-api-key", "api-key", "x-goog-api-key", "anthropic-version",
  "host", "content-type", "content-length", "cookie",
];

const MAX_TEXT = 65_536;
const MAX_KEYS = 200;

/** The protected names among these keys, in the order given. */
export const protectedKeys = (keys: readonly string[]): string[] => keys.filter((k) => PROTECTED_BODY_KEYS.includes(k));

/** The protected header names among these keys, in the order given, whatever their letter case. */
export const protectedHeaders = (keys: readonly string[]): string[] => keys.filter((k) => PROTECTED_HEADER_KEYS.includes(k.trim().toLowerCase()));

/** Why this text cannot be saved in the field, or null when it can. Empty text clears the field. */
export function customProblem(field: "headers" | "body" | "exclude", text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_TEXT) return "That text is too long.";
  if (field === "exclude") {
    const names = trimmed.split("\n").map((n) => n.trim()).filter(Boolean);
    if (names.length > MAX_KEYS) return `List at most ${MAX_KEYS} names.`;
    const bad = protectedKeys(names)[0];
    return bad ? `${bad} is a protected request field and cannot be removed.` : null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return "That is not valid JSON.";
  }
  if (!isRecord(parsed)) return "Use a JSON object: { \"name\": value }.";
  const keys = Object.keys(parsed);
  if (keys.length > MAX_KEYS) return `Use at most ${MAX_KEYS} entries.`;
  if (field === "headers") {
    const blocked = protectedHeaders(keys)[0];
    if (blocked) return `${blocked.trim()} is a protected request header and cannot be set.`;
    const bad = keys.find((k) => !k.trim() || !["string", "number", "boolean"].includes(typeof parsed[k]));
    return bad === undefined ? null : `Header ${bad || "(blank)"} needs a plain text, number or true/false value.`;
  }
  const bad = protectedKeys(keys)[0];
  return bad ? `${bad} is a protected request field and cannot be set.` : null;
}
