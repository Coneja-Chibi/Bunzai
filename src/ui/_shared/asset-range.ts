/**
 * HTTP Range for the asset route, so a browser can seek inside a long sound. One byte range only (`bytes=a-b`, `bytes=a-`, `bytes=-n`);
 * a header that is not a single well-formed byte range is `none` and the whole file is sent, which RFC 9110 allows and which can never
 * send a wrong slice. A range that starts past the end (or asks for the last zero bytes) is `unsatisfiable`: the route answers 416
 * from the stored size alone, reading nothing.
 */
export type ByteRange = { kind: "none" } | { kind: "unsatisfiable" } | { kind: "partial"; start: number; end: number };

export function parseRange(header: string | null | undefined, size: number): ByteRange {
  const m = /^bytes=(\d*)-(\d*)$/.exec((header ?? "").trim());
  if (!m || (m[1] === "" && m[2] === "")) return { kind: "none" };
  if (m[1] === "") {
    const n = Number(m[2]);
    return n === 0 || size === 0 ? { kind: "unsatisfiable" } : { kind: "partial", start: Math.max(0, size - n), end: size - 1 };
  }
  const start = Number(m[1]);
  const end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (m[2] !== "" && Number(m[2]) < start) return { kind: "none" };
  return start >= size ? { kind: "unsatisfiable" } : { kind: "partial", start, end };
}
