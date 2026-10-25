/** Validates the deliberately small, inert SVG subset accepted for staged NamedAssets. */
const ELEMENTS = new Set(["svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "defs", "lineargradient", "radialgradient", "stop", "clippath", "mask", "title", "desc"]);
const ATTRS = new Set(["xmlns", "id", "class", "viewbox", "width", "height", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "d", "points", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "fill-rule", "clip-rule", "opacity", "fill-opacity", "stroke-opacity", "transform", "offset", "stop-color", "stop-opacity", "gradientunits", "gradienttransform"]);
const ENTITIES = /&(?!amp;|lt;|gt;|quot;|apos;|#(?:[0-9]+|x[0-9a-f]+);)/i;

function tagEnd(text: string, from: number): number {
  let quote = "";
  for (let i = from; i < text.length; i++) {
    const char = text[i]!;
    if (quote) { if (char === quote) quote = ""; }
    else if (char === "\"" || char === "'") quote = char;
    else if (char === ">") return i;
  }
  return -1;
}

/** Rejects namespaces, active elements, CSS, references, and every syntax outside this subset. */
export function isInertSvg(text: string): boolean {
  let source = text.replace(/^\uFEFF/, "").trim();
  if (/^<\?xml\s+[^?]*\?>/i.test(source)) source = source.replace(/^<\?xml\s+[^?]*\?>/i, "").trimStart();
  const stack: string[] = [];
  let cursor = 0;
  let rootClosed = false;
  while (cursor < source.length) {
    const open = source.indexOf("<", cursor);
    const content = source.slice(cursor, open < 0 ? source.length : open);
    if (ENTITIES.test(content)) return false;
    if (stack.length === 0 && content.trim()) return false;
    if (open < 0) break;
    if (source.startsWith("<!", open) || source.startsWith("<?", open)) return false;
    const end = tagEnd(source, open + 1);
    if (end < 0) return false;
    let token = source.slice(open + 1, end).trim();
    if (!token || token.includes("<")) return false;
    const closing = token.startsWith("/");
    if (closing) {
      const name = token.slice(1).trim().toLowerCase();
      if (!/^[a-z][a-z0-9_.-]*$/.test(name) || name.includes(":") || stack.pop() !== name) return false;
      if (!stack.length) rootClosed = true;
      cursor = end + 1;
      continue;
    }
    if (rootClosed) return false;
    const selfClosing = token.endsWith("/");
    if (selfClosing) token = token.slice(0, -1).trimEnd();
    const head = /^([A-Za-z][A-Za-z0-9_.-]*)([\s\S]*)$/.exec(token);
    if (!head) return false;
    const name = head[1]!.toLowerCase();
    if (name.includes(":") || !ELEMENTS.has(name) || (!stack.length && name !== "svg")) return false;
    let rest = head[2]!;
    const seen = new Set<string>();
    while (rest.trim()) {
      const attr = /^\s+([A-Za-z][A-Za-z0-9_.-]*)\s*=\s*("([^"<>]*)"|'([^'<>]*)')/.exec(rest);
      if (!attr) return false;
      const key = attr[1]!.toLowerCase();
      const value = attr[3] ?? attr[4] ?? "";
      if (seen.has(key) || !ATTRS.has(key) || (key === "xmlns" && value !== "http://www.w3.org/2000/svg") || value.includes("&") || /[\\<>]|url\s*\(/i.test(value)) return false;
      seen.add(key);
      rest = rest.slice(attr[0].length);
    }
    if (!selfClosing) stack.push(name);
    else if (!stack.length) rootClosed = true;
    cursor = end + 1;
  }
  return rootClosed && stack.length === 0;
}
