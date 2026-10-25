/**
 * Writes or checks src/generated/ic-glyphs.json, the path table behind `Ic`. Every id the source names
 * ("lucide:trash-2", "mdi:drama-masks") is drawn from the real Iconify lucide and mdi data, so the glyphs are
 * RoleCall's own. lucide-react 0.559 (what RoleCall renders) disagrees with the Iconify data on four glyphs;
 * those four are pinned below from its dist/esm/icons files.
 *
 * Run: bun run ic [--check]
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

type Node = readonly [string, Record<string, string>];
type Pack = { icons: Record<string, { body: string }>; aliases?: Record<string, { parent: string }> };

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const OUT = `${ROOT}src/generated/ic-glyphs.json`;
const ID = /["'`]((?:lucide|mdi):[a-z0-9-]+)["'`]/g;

/** lucide-react 0.559.0 iconNode data for the glyphs where the Iconify lucide data differs from what RoleCall renders. */
const LUCIDE_559: Record<string, readonly Node[]> = {
  "git-branch": [["line", { x1: "6", x2: "6", y1: "3", y2: "15" }], ["circle", { cx: "18", cy: "6", r: "3" }], ["circle", { cx: "6", cy: "18", r: "3" }], ["path", { d: "M18 9a9 9 0 0 1-9 9" }]],
  bookmark: [["path", { d: "m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" }]],
  coins: [["circle", { cx: "8", cy: "8", r: "6" }], ["path", { d: "M18.09 10.37A6 6 0 1 1 10.34 18" }], ["path", { d: "M7 6h1v4" }], ["path", { d: "m16.71 13.88.7.71-2.82 2.82" }]],
  "package-search": [["path", { d: "M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14" }], ["path", { d: "m7.5 4.27 9 5.15" }], ["polyline", { points: "3.29 7 12 12 20.71 7" }], ["line", { x1: "12", x2: "12", y1: "22", y2: "12" }], ["circle", { cx: "18.5", cy: "15.5", r: "2.5" }], ["path", { d: "M20.27 17.27 22 19" }]],
};

const num = (s: string | undefined): number => Number(s ?? 0);
const arc = (r: number, x: number, y: number): string => `a${r} ${r} 0 0 1 ${x} ${y}`;

/** One drawing element as path data, so every glyph is `d` strings joined by |. */
function toPath(tag: string, a: Record<string, string>): string {
  if (tag === "path") return a.d!;
  if (tag === "line") return `M${a.x1} ${a.y1}L${a.x2} ${a.y2}`;
  if (tag === "polyline" || tag === "polygon") return `M${a.points}${tag === "polygon" ? "z" : ""}`;
  if (tag === "circle" || tag === "ellipse") {
    const rx = num(a.r ?? a.rx), ry = num(a.r ?? a.ry), cx = num(a.cx), cy = num(a.cy);
    return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`;
  }
  if (tag === "rect") {
    const x = num(a.x), y = num(a.y), w = num(a.width), h = num(a.height), r = Math.min(num(a.rx ?? a.ry), w / 2, h / 2);
    if (!r) return `M${x} ${y}h${w}v${h}h${-w}z`;
    return `M${x + r} ${y}h${w - 2 * r}${arc(r, r, r)}v${h - 2 * r}${arc(r, -r, r)}h${-(w - 2 * r)}${arc(r, -r, -r)}v${-(h - 2 * r)}${arc(r, r, -r)}z`;
  }
  throw new Error(`ic-glyphs: unsupported element <${tag}>`);
}

/** Parse an Iconify body: only drawing elements with geometry attributes are allowed, anything else fails the build. */
function parseBody(id: string, body: string): Node[] {
  const nodes: Node[] = [];
  for (const m of body.matchAll(/<(path|circle|ellipse|rect|line|polyline|polygon)\b([^>]*?)\/?>/g)) {
    const attrs: Record<string, string> = {};
    for (const a of m[2]!.matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]!] = a[2]!;
    for (const k of Object.keys(attrs)) {
      if (/^(fill|stroke|stroke-width|stroke-linecap|stroke-linejoin)$/.test(k)) continue;
      if (!/^(d|cx|cy|r|rx|ry|x|y|x1|x2|y1|y2|width|height|points)$/.test(k)) throw new Error(`ic-glyphs: ${id} has attribute ${k}`);
    }
    nodes.push([m[1]!, attrs]);
  }
  if (!nodes.length) throw new Error(`ic-glyphs: ${id} has no drawing element`);
  return nodes;
}

const load = (name: string): Pack => JSON.parse(readFileSync(`${ROOT}node_modules/@iconify-json/${name}/icons.json`, "utf8")) as Pack;

/** The table for the given ids: id to path data. Throws for an id the data does not have, or one that is only an alias. */
export function buildGlyphs(ids: readonly string[]): Record<string, string> {
  const sets: Record<string, Pack> = { lucide: load("lucide"), mdi: load("mdi") };
  const out: Record<string, string> = {};
  for (const id of [...ids].sort()) {
    const [prefix, name] = id.split(":") as [string, string];
    const set = sets[prefix]!;
    const real = set.icons[name];
    if (!real) {
      const parent = set.aliases?.[name]?.parent;
      throw new Error(`ic-glyphs: ${id} ${parent ? `is an alias, use ${prefix}:${parent}` : "does not exist"}`);
    }
    const nodes = (prefix === "lucide" ? LUCIDE_559[name] : undefined) ?? parseBody(id, real.body);
    out[id] = nodes.map(([tag, a]) => toPath(tag, a)).join("|");
  }
  return out;
}

function sources(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) sources(p, acc);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}

/** Every icon id the authored source names, which is the allowlist the table is cut to. */
export function usedIds(): string[] {
  const ids = new Set<string>();
  for (const f of sources(`${ROOT}src`)) for (const m of readFileSync(f, "utf8").matchAll(ID)) ids.add(m[1]!);
  return [...ids].sort();
}

export const render = (): string => `${JSON.stringify(buildGlyphs(usedIds()), null, 1)}\n`;

if (import.meta.main) {
  const text = render();
  if (process.argv.includes("--check")) {
    if (readFileSync(OUT, "utf8") !== text) { console.error("ic-glyphs: src/generated/ic-glyphs.json is stale, run bun run ic"); process.exit(1); }
    console.log("ic-glyphs: current.");
  } else { writeFileSync(OUT, text); console.log(`ic-glyphs: wrote ${Object.keys(JSON.parse(text)).length} glyphs.`); }
}
