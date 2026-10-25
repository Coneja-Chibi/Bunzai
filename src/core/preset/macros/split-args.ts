/** Split macro arguments at top-level separators while keeping nested macro calls intact. */
export function splitMacroArgs(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i += 1) {
    if (inner[i] === "{" && inner[i + 1] === "{") { depth += 1; i += 1; continue; }
    if (inner[i] === "}" && inner[i + 1] === "}") { depth -= 1; i += 1; continue; }
    if (depth === 0 && inner[i] === ":" && inner[i + 1] === ":") {
      parts.push(inner.slice(start, i));
      i += 1;
      start = i + 1;
    }
  }
  parts.push(inner.slice(start));
  return parts;
}
