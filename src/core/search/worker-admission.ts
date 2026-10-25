/** Conservative structured-clone message admission for both search worker transports. */
export const SEARCH_MESSAGE_BYTES = 2 * 1024 * 1024;
export function searchMessageBytes(value: unknown, depth = 0): number {
  if (typeof value === "string") return Math.min(SEARCH_MESSAGE_BYTES + 1, value.length * 6 + 8);
  if (value === null || typeof value !== "object") return 16;
  if (depth > 8) return SEARCH_MESSAGE_BYTES + 1;
  let bytes = 16;
  for (const [key, item] of Object.entries(value)) {
    bytes += key.length * 2 + searchMessageBytes(item, depth + 1);
    if (bytes > SEARCH_MESSAGE_BYTES) return SEARCH_MESSAGE_BYTES + 1;
  }
  return bytes;
}
