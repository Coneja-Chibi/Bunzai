/**
 * The markdown subset, parsed. Table-driven for the happy path, then hostile input: markup is text,
 * links are scheme-checked, unclosed and nested markers stay bounded, and a long message parses fast
 * enough to redo on every streamed token.
 */
import { expect, test } from "bun:test";
import { blockToHtml, parseBlocks, parseInline, type Block, type Inline } from "./prose-core";

const kinds = (text: string): string[] => parseBlocks(text).map((b) => b.k);
const flat = (nodes: Inline[]): string => nodes.map((n) => ("kids" in n ? flat(n.kids) : "s" in n ? n.s : "")).join("");
const html = (text: string): string => parseBlocks(text).map(blockToHtml).join("");

test("the existing action and speech rules are unchanged", () => {
  expect(parseInline('*looks up* "Hello," she says.')).toEqual([
    { t: "em", kids: [{ t: "text", s: "looks up" }] },
    { t: "text", s: " " },
    { t: "q", kids: [{ t: "text", s: "Hello," }] },
    { t: "text", s: " she says." },
  ]);
  expect(parseInline("\u201Ccurly\u201D")).toEqual([{ t: "q", kids: [{ t: "text", s: "curly" }] }]);
});

test.each([
  ["**bold**", { t: "b", kids: [{ t: "text", s: "bold" }] }],
  ["_slant_", { t: "i", kids: [{ t: "text", s: "slant" }] }],
  ["`x < y`", { t: "code", s: "x < y" }],
  ["[site](https://example.com/a)", { t: "a", href: "https://example.com/a", s: "site" }],
  ["[mail](mailto:a@b.co)", { t: "a", href: "mailto:a@b.co", s: "mail" }],
])("inline %s", (src, node) => {
  expect(parseInline(src)).toEqual([node as Inline]);
});

test("bold may hold speech and italics", () => {
  expect(parseInline('**"no" and _yes_**')).toEqual([
    { t: "b", kids: [{ t: "q", kids: [{ t: "text", s: "no" }] }, { t: "text", s: " and " }, { t: "i", kids: [{ t: "text", s: "yes" }] }] },
  ]);
});

test("snake_case and mid-word underscores are not italics", () => {
  expect(parseInline("use my_var_name here")).toEqual([{ t: "text", s: "use my_var_name here" }]);
});

test("a bare URL links, and trailing punctuation stays outside it", () => {
  expect(parseInline("see https://example.com/x.")).toEqual([
    { t: "text", s: "see " },
    { t: "a", href: "https://example.com/x", s: "https://example.com/x" },
    { t: "text", s: "." },
  ]);
});

test("block kinds", () => {
  const text = ["# Title", "", "plain *act*", "", "- a", "- b", "", "1. one", "2. two", "", "> said", "> more", "", "---", "", "```", "code", "```"].join("\n");
  expect(kinds(text)).toEqual(["h", "p", "list", "list", "quote", "hr", "code"]);
  const lists = parseBlocks(text).filter((b): b is Extract<Block, { k: "list" }> => b.k === "list");
  expect(lists.map((l) => [l.ordered, l.items])).toEqual([[false, ["a", "b"]], [true, ["one", "two"]]]);
});

test("a bare *action* line is never a list item or rule", () => {
  expect(kinds("*waves*\n**loud** line\n***")).toEqual(["p", "hr"]);
  expect(parseBlocks("*waves*\n**loud** line")[0]).toMatchObject({ k: "p", lines: ["*waves*", "**loud** line"] });
});

test("an unclosed fence stays text and does not swallow what follows", () => {
  const blocks = parseBlocks("before\n```js\nlet a = 1;\n\n# still a heading");
  expect(blocks.map((b) => b.k)).toEqual(["p", "h"]);
  expect(parseBlocks("```\nx\n```\nafter").map((b) => b.k)).toEqual(["code", "p"]);
});

test("fenced code keeps markup literal", () => {
  expect(parseBlocks("```\n**not bold** <b>\n```")[0]).toMatchObject({ k: "code", text: "**not bold** <b>" });
});

// ---- hostile ----

test("script and tag text is carried as raw tags for the sanitizer, and nothing is trusted here", () => {
  const out = html("<script>alert(1)</script> hi");
  // the parser never decides what is safe: the tag text is passed on, and message-html removes it
  expect(parseInline("<script>alert(1)</script>").map((n) => n.t)).toEqual(["raw", "text", "raw"]);
  expect(out.startsWith("<p>")).toBe(true);
});

test("message text is escaped; only author tags pass through", () => {
  expect(html("1 < 2 & 3 > 2")).toBe("<p>1 &lt; 2 &amp; 3 &gt; 2</p>");
  expect(html("**<b>x</b>**")).toBe("<p><strong><b>x</b></strong></p>");
  expect(html("`<b>`")).toBe("<p><code>&lt;b&gt;</code></p>");
  expect(html("[a\"b](https://x.test/?q=\"1\")")).not.toContain('href="https://x.test/?q="1"');
});

test("an HTML card spanning blank lines stays one html block", () => {
  const card = ['<div style="color:red">', "", "first", "", "second", "", "</div>", "", "after"].join("\n");
  const blocks = parseBlocks(card);
  expect(blocks.map((b) => b.k)).toEqual(["html", "p"]);
});

test("an unclosed html block runs to the end of the message but never throws", () => {
  expect(parseBlocks("<details>\nopen forever").map((b) => b.k)).toEqual(["html"]);
});

test.each([
  "javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "vbscript:x",
  "file:///etc/passwd",
  "/settings",
  "#frag",
])("link to %s is inert text", (href) => {
  const [n] = parseInline(`[click](${href})`);
  expect(n).toEqual({ t: "a", href: null, s: "click" });
});

test("a safe link keeps only a safe href", () => {
  const [n] = parseInline("[x](https://a.test/?q=1&r=2)");
  expect(n).toMatchObject({ href: "https://a.test/?q=1&r=2" });
});

test("nested markers never exceed the depth cap and lose no text", () => {
  const src = "**a **b **c **d**x**y**z**";
  const nodes = parseInline(src);
  expect(flat(nodes).replace(/\*/g, "")).toContain("d");
  const depth = (ns: Inline[]): number => Math.max(0, ...ns.map((n) => ("kids" in n ? 1 + depth(n.kids) : 0)));
  expect(depth(nodes)).toBeLessThanOrEqual(3);
});

test.each(["**open", "*open", "_open", "`open", "[open](", "[open](http://x", '"open', "```", "> ", "- ", "# ", "[", "]("])(
  "unclosed marker %p parses without loss",
  (src) => {
    const blocks = parseBlocks(`${src} and more text`);
    expect(blocks.length).toBeGreaterThan(0);
    const inl = parseInline(`${src} and more text`);
    expect(flat(inl).length).toBeGreaterThan(0);
  },
);

/** The shortest time of a few runs: a busy machine only ever adds time, so the minimum is the least disturbed. */
function bestMs(run: () => void, tries: number): number {
  let best = Infinity;
  for (let i = 0; i < tries; i++) {
    const t0 = performance.now();
    run();
    best = Math.min(best, performance.now() - t0);
  }
  return best;
}

// Linearity is asserted as scaling, not as a wall-clock ceiling: the same input eight times as long must cost about
// eight times as much (a quadratic parser would cost sixty-four). The wide gap and best-of-five keep one disturbed run from deciding it.
test("hostile long runs stay linear", () => {
  const cases = (n: number): string[] => ["*".repeat(n), "**a".repeat(n / 3), "[".repeat(n), "[a](".repeat(n / 4), "_a".repeat(n / 2), "`".repeat(n), '"'.repeat(n), "> ".repeat(n / 400) + "x", "- ".repeat(n / 80)];
  const small = cases(50_000);
  const large = cases(400_000);
  const parse = (c: string) => () => parseBlocks(c).forEach((b) => { if (b.k === "p") b.lines.forEach((l) => parseInline(l)); });
  for (let i = 0; i < small.length; i++) {
    const base = bestMs(parse(small[i]!), 5);
    const grown = bestMs(parse(large[i]!), 5);
    // linear is 8x, quadratic 64x; a floor on the base keeps sub-millisecond cases from dividing noise by noise
    expect(grown, `case ${i}: ${base.toFixed(1)}ms -> ${grown.toFixed(1)}ms`).toBeLessThan(24 * Math.max(base, 5));
  }
});

test("a long message parses cheaply (streaming re-parses it per token)", () => {
  const para = 'She turned, *quietly*, and said "this is **fine**, truly" while `code` and [a link](https://example.com) waited.\n- item one\n- item two\n> a quote\n';
  const text = Array.from({ length: 400 }, () => para).join("\n\n");
  parseBlocks(text);
  const runs = 20;
  const t0 = performance.now();
  for (let i = 0; i < runs; i++) parseBlocks(text).forEach((b) => { if (b.k === "p") b.lines.forEach((l) => parseInline(l)); });
  const per = (performance.now() - t0) / runs;
  expect(per).toBeLessThan(50);
});

test("a whitespace-split scheme never becomes a link", () => {
  expect(parseInline("[x](java\tscript:alert(1))").some((n) => n.t === "a")).toBe(false);
  expect(parseInline("[x](java script:alert(1))").some((n) => n.t === "a")).toBe(false);
});

// ---- <style> blocks and CSS-only cards ----

const TAB_CARD = [
  "<style>",
  "#tab-a:checked ~ .panels .pane-a { display: block; }",
  "",
  ".pane-a { display: none; }",
  "</style>",
  '<input type="radio" id="tab-a" name="g" checked>',
  '<input type="radio" id="tab-b" name="g">',
  '<label for="tab-a">A</label><label for="tab-b">B</label>',
  "",
  '<nav class="tabs"><label for="tab-a">A</label></nav>',
  "",
  '<div class="panels"><div class="pane-a">one</div></div>',
].join("\n");

test("a closed <style> becomes one style block that renders nothing, blank lines inside it included", () => {
  const blocks = parseBlocks(TAB_CARD);
  expect(blocks.filter((b) => b.k === "style")).toEqual([{ k: "style", src: "\n#tab-a:checked ~ .panels .pane-a { display: block; }\n\n.pane-a { display: none; }\n" }]);
  expect(html(TAB_CARD)).not.toMatch(/style|display/);
});

test("a stylesheet makes the card one html block, so sibling selectors keep their siblings", () => {
  const cards = parseBlocks(TAB_CARD).filter((b) => b.k === "html");
  expect(cards.length).toBe(1);
  expect(cards[0]!.src).toContain('<input type="radio" id="tab-a"');
  expect(cards[0]!.src.indexOf("<nav")).toBeLessThan(cards[0]!.src.indexOf('class="panels"'));
});

test("without a stylesheet html blocks stay separate, as before", () => {
  expect(kinds('<div>a</div>\n\n<div>b</div>')).toEqual(["html", "html"]);
});

test("input, label and nav open an html block like any block tag", () => {
  expect(kinds('<input type="radio" id="a">\n<label for="a">x</label>')).toEqual(["html"]);
  expect(kinds('<nav><label for="a">x</label></nav>')).toEqual(["html"]);
});

test.each([
  ["a fence", "```html\n<style>.a{color:red}</style>\n```"],
  ["inline code", "see `<style>.a{color:red}</style>` for the rule"],
  ["a quote", "> <style>.a{color:red}</style>"],
  ["mid-sentence text", "a <style>.a{color:red}</style> b"],
])("a <style> shown in %s is text, never a stylesheet", (_name, text) => {
  expect(parseBlocks(text).some((b) => b.k === "style")).toBe(false);
});

test("a <style> that never closes stays text until its close arrives (no CSS flashing as prose is a separate render concern)", () => {
  expect(kinds("<style>\n.a{color:red}")).toEqual(["p"]);
  expect(kinds("<style>\n.a{color:red}\n</style>")).toEqual(["style"]);
});

test("a <style> inside an html block is lifted out of it", () => {
  const blocks = parseBlocks('<div class="card"><style>.card{color:red}</style>\n<p>x</p></div>');
  expect(blocks.filter((b) => b.k === "style").map((b) => b.src)).toEqual([".card{color:red}"]);
  expect(html('<div class="card"><style>.card{color:red}</style>\n<p>x</p></div>')).not.toContain("style");
});

test("html on the closing line of a <style> is kept, and text before a style stays a paragraph", () => {
  const blocks = parseBlocks('She waves.\n<style>.a{color:red}</style><div class="a">card</div>');
  expect(blocks.map((b) => b.k)).toEqual(["p", "style", "html"]);
  expect(blocks[2]).toEqual({ k: "html", src: '<div class="a">card</div>' });
});

test("thousands of <style> openers that never close stay linear", () => {
  const t0 = performance.now();
  parseBlocks("<style>\n".repeat(20_000));
  parseBlocks("<style>\na{}\n</style>\n".repeat(5_000));
  expect(performance.now() - t0).toBeLessThan(1500);
});
