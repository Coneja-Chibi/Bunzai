/**
 * Website guides: turn the user guide under docs/guide/ into site pages. Pure: front matter comes off,
 * the in-app figure directives come out, and every relative link is re-pointed (another guide becomes
 * its site page, docs/media becomes the site's media folder, anything else opens on GitHub). The build
 * script owns the file IO.
 */
import { Marked } from "marked";

export interface Guide {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly html: string;
}

const BLOB = "https://github.com/Coneja-Chibi/Bunraku/blob/Mainstage/";
const BASE = "https://repo.invalid/";

/** docs/guide/lorebooks.md -> "lorebooks", docs/guide/platforms/risu.md -> "platforms-risu", README -> its folder. */
export function guideSlug(path: string): string | null {
  const m = /^docs\/guide\/(.+)\.md$/.exec(path);
  if (!m) return null;
  return m[1] === "README" ? "index" : m[1]!.replace(/\/README$/, "").replaceAll("/", "-");
}

/** Re-point one link written in the markdown file at repo path `from` for a page served from guides/. */
export function relink(href: string, from: string): string {
  if (/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(href)) return href;
  const url = new URL(href, BASE + from);
  const path = decodeURIComponent(url.pathname.slice(1));
  const slug = guideSlug(path);
  if (slug) return `${slug}.html${url.hash}`;
  if (path.startsWith("docs/media/")) return `../media/${path.slice("docs/media/".length)}`;
  return BLOB + path + url.hash;
}

/** Render one guide file; null for a path outside docs/guide/. */
export function renderGuide(path: string, source: string): Guide | null {
  const slug = guideSlug(path);
  if (!slug) return null;
  const front = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source);
  const meta = (key: string): string => new RegExp(`^${key}:\\s*(.+)$`, "m").exec(front?.[1] ?? "")?.[1]?.trim() ?? "";
  const body = source.slice(front?.[0].length ?? 0).replace(/^@fig .*$/gm, "");
  const marked = new Marked({
    walkTokens(token) {
      if (token.type === "link" || token.type === "image") token.href = relink(token.href, path);
    },
  });
  return { slug, title: meta("title") || slug, summary: meta("summary"), html: marked.parse(body, { async: false }) };
}
