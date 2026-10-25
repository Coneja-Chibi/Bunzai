/**
 * The message sanitizer, attacked. XSS vectors, CSS that tries to cover or reach outside the bubble,
 * remote-image egress, and the HTML a roleplay message legitimately carries. Pure style policy is
 * tested without a DOM; the DOMPurify half runs under jsdom.
 */
import { afterAll, beforeAll, expect, test } from "bun:test";
import { installDom, teardownAllDoms } from "../../_shared/test-dom";
import { blockToHtml, parseBlocks } from "./prose-core";

afterAll(teardownAllDoms);

beforeAll(() => {
  installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8325/" });
});

async function clean(text: string): Promise<string> {
  const { sanitizeMessageHtml } = await import("./message-html");
  return parseBlocks(text).map((b) => sanitizeMessageHtml(blockToHtml(b))).join("");
}

const PNG = "data:image/png;base64,iVBORw0KGgo=";

test.each([
  ["<script>alert(1)</script>hi", /script|alert/],
  ["<img src=x onerror=alert(1)>", /onerror|alert/],
  ["<svg onload=alert(1)><circle/></svg>", /svg|onload|alert/],
  ['<a href="javascript:alert(1)">x</a>', /javascript/i],
  ['<a href="  JaVa&#x09;Script:alert(1)">x</a>', /script:/i],
  ["<a href=\"data:text/html;base64,PHNjcmlwdD4=\">x</a>", /data:/i],
  ['<div onclick="alert(1)">x</div>', /onclick|alert/],
  ['<iframe src="https://evil.test"></iframe>', /iframe|evil/],
  ['<object data="x"></object><embed src="x">', /object|embed/],
  ['<form action="https://evil.test"><input name=a><button>go</button></form>', /form|input|button|evil/],
  ["<style>body{display:none}</style>x", /style|display/],
  ["<link rel=stylesheet href=https://evil.test/x.css>", /link|evil/],
  ['<meta http-equiv=refresh content="0;url=https://evil.test">', /meta|evil/],
  ["<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>", /onerror|alert/],
  ['<div id="x" name="y" data-a="1">x</div>', /\bid="x"|name=|data-a/],
  ["<video src=https://evil.test/v.mp4 autoplay></video>", /video|evil/],
  ['<base href="https://evil.test/">', /base|evil/],
])("XSS vector is neutralised: %s", async (src, bad) => {
  expect(await clean(src)).not.toMatch(bad);
});

test("a javascript: markdown link and a raw anchor both lose the href", async () => {
  const out = await clean('[x](javascript:alert(1)) and <a href="javascript:alert(1)">y</a>');
  expect(out).not.toMatch(/href=["']?javascript/i);
});

test("links that survive open in a new window without an opener", async () => {
  const out = await clean('[x](https://example.com) <a href="mailto:a@b.co">m</a> <a href="https://a.test" target="_self">t</a>');
  expect(out).toContain('href="https://example.com"');
  expect(out).toContain('rel="noopener noreferrer"');
  expect(out).not.toContain("_self");
  expect(out).toContain('href="mailto:a@b.co"');
});

test("classes are namespaced so a message cannot wear an app class", async () => {
  const out = await clean('<div class="host-protected acts">x</div>');
  expect(out).toContain('class="custom-host-protected custom-acts"');
  expect(out).not.toMatch(/class="(?:host-protected|acts)/);
});

// ---- CSS overlay escape ----

test.each([
  "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999",
  "position:absolute;inset:0",
  "position:sticky;top:0",
  "transform:translate(9999px,9999px)",
  "float:left",
  "z-index:2147483647",
  "width:100vw",
  "height:100dvh",
  "margin-top:-5000px",
  "margin:-10px",
  "background:url(https://evil.test/x.png)",
  'background-image:image-set("https://evil.test/x.png" 1x)',
  "background:var(--x)",
  "color:expression(alert(1))",
  "behavior:url(x.htc)",
  "-moz-binding:url(x)",
  "overflow:visible",
  "pointer-events:none",
  "cursor:url(https://evil.test/c.png),auto",
  'content:"x"',
  "filter:blur(900px)",
  "animation:spin 1s infinite",
  "display:contents",
])("style %s is dropped", async (css) => {
  const { sanitizeMessageStyle } = await import("./message-html");
  const out = sanitizeMessageStyle(css);
  expect(out).not.toMatch(/position|fixed|absolute|sticky|inset|transform|float|z-index|vw|vh|vmin|url|image-set|var\(|expression|behavior|binding|overflow|pointer|cursor|content|filter|animation|contents|-\d/i);
});

test("a semicolon hidden in a string or backslash cannot smuggle a declaration", async () => {
  const { sanitizeMessageStyle } = await import("./message-html");
  expect(sanitizeMessageStyle('font-family:"a;position:fixed"')).toBe('font-family: "a;position:fixed"');
  expect(sanitizeMessageStyle("color:red\\;position:fixed")).toBe("");
});

test("an overlay attempt through the full pipeline leaves no positioning at all", async () => {
  const out = await clean('<div style="position:fixed;inset:0;width:100vw;height:100vh;background:red;z-index:9999">cover</div>');
  expect(out).not.toMatch(/position|inset|vw|vh|z-index/);
  expect(out).toContain("background: red");
});

test("presentation a roleplay card needs survives", async () => {
  const { sanitizeMessageStyle } = await import("./message-html");
  const css =
    "color:#daa520; background:linear-gradient(135deg, rgb(10 10 10 / 0.8), #222); border:1px solid #444; border-radius:8px; padding:8px 12px; margin:4px 0; font-family:'Cinzel', serif; text-shadow:0 0 6px #fff; display:flex; gap:8px; max-width:100%";
  const out = sanitizeMessageStyle(css);
  for (const p of ["color", "background", "border", "border-radius", "padding", "margin", "font-family", "text-shadow", "display", "gap", "max-width"]) {
    expect(out).toContain(`${p}:`);
  }
  expect(out).toContain("linear-gradient(135deg, rgb(10 10 10 / 0.8), #222)");
});

// ---- image egress ----

test.each([
  "https://evil.test/pixel.png",
  "http://evil.test/pixel.png",
  "//evil.test/pixel.png",
  "/api/anything",
  "relative.png",
  "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
  "data:text/html;base64,PHNjcmlwdD4=",
  "javascript:alert(1)",
  "blob:https://x/1",
  "file:///C:/secret.png",
])("image src %s is never requested", async (src) => {
  const out = await clean(`<img src="${src}" alt="a">`);
  expect(out).not.toMatch(/<img/i);
  expect(out).toContain("custom-blockedmedia");
});

test("markdown images follow the same rule, and srcset or poster never survive", async () => {
  expect(await clean("![x](https://evil.test/p.png)")).not.toMatch(/<img/i);
  const out = await clean(`<img src="${PNG}" srcset="https://evil.test/a.png 2x" alt="ok">`);
  expect(out).toContain("<img");
  expect(out).not.toMatch(/srcset|evil/);
});

test("an inline raster image survives and is size-capped", async () => {
  const out = await clean(`<img src="${PNG}" width="99999" height="12" alt="dot">`);
  expect(out).toContain(PNG);
  expect(out).toContain('width="800"');
  expect(out).toContain('height="12"');
});

test("an oversized inline image is refused", async () => {
  const { isInlineImage } = await import("./message-html");
  expect(isInlineImage(`data:image/png;base64,${"A".repeat(2_000_001)}`)).toBe(false);
  expect(isInlineImage(PNG)).toBe(true);
});

// ---- what the roleplay HTML is for ----

test("styled cards, tables, details and fonts survive", async () => {
  const card = [
    '<div style="color:#fff;background:#223;padding:8px"><font color="#daa520">gold</font> <span style="font-style:italic">slant</span></div>',
    "",
    "<details open><summary>More</summary>hidden <b>bold</b></details>",
    "",
    "<table><tr><th>a</th><td colspan=2>b</td></tr></table>",
  ].join("\n");
  const out = await clean(card);
  for (const keep of ['<font color="#daa520">', "font-style: italic", "<details", "<summary>", "<table>", 'colspan="2"', "background: #223"]) {
    expect(out).toContain(keep);
  }
});

test("markdown and html mix in one message", async () => {
  const out = await clean('*smiles* "hi" <span style="color:red">**warm**</span>');
  expect(out).toContain("<em>smiles</em>");
  expect(out).toContain("<q>hi</q>");
  expect(out).toContain('<span style="color: red"><strong>warm</strong></span>');
});

test("mutation-XSS shapes do not survive a parse round trip", async () => {
  const out = await clean('<noscript><p title="</noscript><img src=x onerror=alert(1)>">');
  expect(out).not.toMatch(/onerror|<img/i);
  const out2 = await clean('<a href="x"><svg><a><style><!--</style><img title="--><img src=x onerror=alert(1)>">');
  expect(out2).not.toMatch(/onerror/i);
});

// ---- streaming cost ----

test("sanitizing the growing last block while a long reply streams stays cheap", async () => {
  const { sanitizeMessageHtml } = await import("./message-html");
  const para = 'She turned, *quietly*, and said "this is **fine**" <span style="color:#daa520">gold</span> with `code` and [a link](https://example.com).';
  const text = Array.from({ length: 300 }, () => para).join("\n\n");
  const blocks = parseBlocks(text);
  sanitizeMessageHtml(blockToHtml(blocks[0]!));
  // a streaming token re-parses the whole text but re-sanitizes only the changed (last) block
  const runs = 30;
  let t0 = performance.now();
  for (let i = 0; i < runs; i++) parseBlocks(`${text} more`).map(blockToHtml);
  const parse = (performance.now() - t0) / runs;
  t0 = performance.now();
  for (let i = 0; i < runs; i++) sanitizeMessageHtml(blockToHtml(blocks[blocks.length - 1]!));
  const one = (performance.now() - t0) / runs;
  expect(parse + one).toBeLessThan(40);
});

// ---- CSS-only cards: inputs, labels, ids, fragments ----

async function cleanIn(text: string, mount: string): Promise<string> {
  const { sanitizeMessageHtml } = await import("./message-html");
  return parseBlocks(text).map((b) => sanitizeMessageHtml(blockToHtml(b), mount)).join("");
}

test("radio and checkbox inputs keep type, checked, and a per-message id, name and label target", async () => {
  const out = await cleanIn(
    '<input type="radio" id="tab-a" name="g" checked><input type="CheckBox" id="flip"><label for="tab-a">A</label><nav><label for="flip">B</label></nav>',
    "m1",
  );
  expect(out).toContain('<input type="radio" id="msg-m1-tab-a" name="msg-m1-g" checked="">');
  expect(out).toContain('<input type="checkbox" id="msg-m1-flip">');
  expect(out).toContain('<label for="msg-m1-tab-a">A</label>');
  expect(out).toContain('<nav><label for="msg-m1-flip">B</label></nav>');
});

test.each([
  '<input>',
  '<input type="text" value="x">',
  '<input type="password">',
  '<input type="file">',
  '<input type="hidden" name="a" value="b">',
  '<input type="submit" value="go">',
  '<input type="button" value="go">',
  '<input type="image" src="https://evil.test/leak.png">',
  '<input type="image" src="data:image/png;base64,iVBORw0KGgo=">',
  '<input type="range">',
  '<input type="radio ">x<input type="Radioactive">',
])("only radio and checkbox survive: %s", async (src) => {
  const out = await clean(src);
  expect(out).not.toMatch(/type="(?!radio|checkbox)/);
  expect(out).not.toMatch(/evil|value=|src=/);
});

test("an input cannot submit, fetch, or carry a handler", async () => {
  const out = await clean(
    '<input type="radio" form="f" formaction="https://evil.test" formmethod="post" value="v" src="https://evil.test/x.png" alt="a" autofocus onchange="alert(1)" onfocus="alert(2)" disabled>',
  );
  expect(out).toMatch(/^<input type="radio"/);
  expect(out).not.toMatch(/form|value|src|alt|autofocus|onchange|onfocus|alert|evil|disabled/);
  expect(await clean('<form action="https://evil.test"><input type="radio" name="a"></form>')).not.toMatch(/form|evil/);
  expect(await clean("<button type=submit>go</button><select><option>a</option></select><textarea>t</textarea>")).not.toMatch(/button|select|option|textarea/);
});

test("name, type, checked and for are only kept where they mean something", async () => {
  const out = await clean('<a name="x" href="https://a.test">a</a><img name="y" src="https://evil.test/i.png"><div for="q" type="radio" checked name="n">d</div><ol type="a"><li>i</li></ol>');
  expect(out).not.toMatch(/\bname=|\bfor=|\btype=|checked/);
});

test("a message cannot take an id the app uses, and the same message in two mounts shares no id", async () => {
  const src = '<div id="composer">x</div><div id="app">y</div>';
  const a = await cleanIn(src, "m1"), b = await cleanIn(src, "m2");
  expect(a).toBe('<div id="msg-m1-composer">x</div><div id="msg-m1-app">y</div>');
  expect(a).not.toBe(b);
  expect(await cleanIn('<div id="a b&quot;c">x</div>', "m1")).toContain('id="msg-m1-a-b-c"');
});

test("a #fragment link points at this message's own id and is never a route", async () => {
  const { parseLaunchTarget } = await import("../../_shared/launch-target");
  const out = await cleanIn('<a href="#tab2">t</a> <a href="#settings/models">s</a> <a href="#" target="_blank">h</a>', "m1");
  expect(out).toContain('<a href="#msg-m1-tab2">t</a>');
  expect(out).toContain('<a href="#msg-m1-settings-models">s</a>');
  expect(out).not.toMatch(/target=|rel=/);
  // the shell reads the hash once, at boot, and only opens an app whose id matches; none starts with msg-
  expect(parseLaunchTarget("#msg-m1-settings-models")).toEqual({ appId: "msg-m1-settings-models" });
});

test("an unscoped sanitize still namespaces, under the static mount", async () => {
  expect(await clean('<input type="radio" id="a" name="g">')).toContain('id="msg-static-a" name="msg-static-g"');
});
