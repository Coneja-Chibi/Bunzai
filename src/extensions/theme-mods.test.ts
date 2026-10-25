/** Contract tests for the optional powers: styles, fonts, images and slots, checked at the one inspector. */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { inspectThemePackage } from "./theme-contract";
import { decodeCanonicalBase64 } from "./theme-binary";
import { base64, modThemePackage, MOD_STYLES, png, pngBytes, webp, webpBytes, woff2, woff2Bytes } from "./theme-mod-fixture";
import { HOST_FONT_FAMILIES, HOST_KEYFRAMES, PROTECTED_SCOPE, scopeThemeCss } from "./theme-css";
import { SLOT_IDS } from "./slot-registry";

type Pkg = { manifest: Record<string, any>; assets: Record<string, unknown> };
const rejects = async (input: unknown): Promise<string> => inspectThemePackage(input).then(() => "accepted", (e: Error) => e.message);
const withCss = (css: string): Promise<Pkg> => modThemePackage((p) => { p.assets["styles.css"] = MOD_STYLES + "\n" + css; }) as Promise<Pkg>;
const cssRejected = async (css: string): Promise<void> => expect(await rejects(await withCss(css)), css).toContain("invalid theme styles");

describe("package with every power", () => {
  test("derives one scope per power and keeps the shipped data", async () => {
    const p = await inspectThemePackage(await modThemePackage());
    for (const scope of ["appearance.styles", "appearance.fonts", "appearance.assets", "ui.slots"]) expect(p.derivedScopes).toContain(scope as never);
    expect(p.fonts.map((f) => f.id)).toEqual(["face"]);
    expect(p.assets.filter((a) => a.mediaType !== "image/svg+xml").map((a) => a.mediaType).sort()).toEqual(["image/png", "image/webp"]);
    expect(Object.keys(p.slots)).toEqual(["shell.nav.end", "library.header"]);
    expect(p.styles).toBe(MOD_STYLES);
  });

  test("every power must be requested, and an unrequested one is a scope lie", async () => {
    for (const scope of ["appearance.styles", "appearance.fonts", "ui.slots"]) {
      const lie = await modThemePackage((p) => { p.manifest.requests = p.manifest.requests.filter((s: string) => s !== scope); });
      expect(await rejects(lie), scope).toContain("invalid theme package");
    }
  });

  test("the digest covers the styles, the font and the slots", async () => {
    const a = (await inspectThemePackage(await modThemePackage())).digest;
    const css = await inspectThemePackage(await modThemePackage((p) => { p.assets["styles.css"] += "\n.x{color:red}"; }));
    const slot = await inspectThemePackage(await modThemePackage((p) => { p.manifest.slots["library.header"][0].text = "Other"; }));
    const font = await inspectThemePackage(await modThemePackage((p) => { const b = woff2Bytes(); b[40] = 9; p.assets["fonts/face.woff2"] = base64(b); }));
    expect(new Set([a, css.digest, slot.digest, font.digest]).size).toBe(4);
  });

  test("a font needs styles that use it, and an unused font is refused", async () => {
    const noStyles = await modThemePackage((p) => {
      delete p.manifest.styles; delete p.assets["styles.css"]; delete p.manifest.slots;
      p.manifest.requests = p.manifest.requests.filter((s: string) => s !== "appearance.styles" && s !== "ui.slots");
    });
    expect(await rejects(noStyles)).toContain("invalid theme package");
    const unused = await modThemePackage((p) => { p.assets["styles.css"] = ".mod-stamp-note{color:red}"; });
    expect(await rejects(unused)).toContain("invalid theme package");
  });
});

describe("hostile styles are refused whole", () => {
  const bad: string[] = [
    "@import url(asset:backdrop);", "@import 'https://evil.example/x.css';", "@charset 'utf-8'; a{color:red}", "@namespace url(http://x);", "@page{margin:0}",
    "a{background:url(https://evil.example/x.png)}", "a{background:url(//evil.example/x.png)}", "a{background:url( 'https://evil.example/x.png' )}",
    "a{background:u\\72l(https://evil.example/x.png)}", "a{background:\\75 rl(https://evil.example/x.png)}", "a{background:URL(data:image/png;base64,AAAA)}",
    "a{background:url(asset:nonexistent)}", "a{background:url(asset:face)}", "a{background:image-set('https://evil.example/x.png' 1x)}", "a{background:-webkit-image-set(url(asset:backdrop) 1x)}",
    "a{background:src('https://evil.example/x.png')}", "a{width:expression(alert(1))}", "a{behavior:url(x.htc)}", "a{-moz-binding:url(x)}", "a{content:attr(data-x)}",
    "a{background:url('https://evil.example/x.png')}", "a{background:url(asset:backdrop/../x)}", "a{b:calc('x')}",
    ".host-protected{display:none}", ".host-protected *{display:none}", ".gate :is(.host-protected *){opacity:0}", ".host\\2d protected{display:none}", ".HOST-PROTECTED{display:none}", "#host-protected{display:none}",
    ".bk-protected{display:none}", "[class*='host-protected']{display:none}", "[class*=host-prot]{display:none}", "[class^=host]{display:none}", "[class$=tected]{display:none}", "[class|=host]{display:none}",
    "@media (min-width:1px){.host-protected{display:none}}", "@supports (a:b){.host-protected{display:none}}", "a{--x:host-protected}",
    "@layer protected{a{color:red}}", "@layer{a{color:red}}", "@property --bk-text{syntax:'*';inherits:false}", "a{--host-canvas:red}", "a{color:var(--host-ink)}",
    "@font-face{font-family:'Archivo';src:url(asset:face)}", "@font-face{font-family:'OpenDyslexic';src:url(asset:face)}", "@font-face{font-family:Lexend;src:url(asset:face)}", "@font-face{font-family:\"Atkinson Hyperlegible\";src:url(asset:face)}", "@font-face{font-family:serif;src:url(asset:face)}",
    "@font-face{font-family:'X';src:url(https://evil.example/f.woff2)}", "@font-face{font-family:'X';src:local('Arial')}", "@font-face{font-family:'X';src:url(asset:face),url(asset:face)}", "@font-face{font-family:'X'}", "@font-face{font-family:'X';src:url(asset:backdrop)}", "@font-face{font-family:'X';src:url(asset:face);color:red}",
    "@keyframes pulse{from{opacity:0}to{opacity:1}}", "@keyframes premiereFloorFog{from{opacity:0}}", "@keyframes x{a{color:red}}",
    "a{b{color:red}}", "a{color:red", "a{color:red}}", "/* never closes a{color:red}", "a{content:'unterminated}", "a{content:'new\nline'}", "<!-- a{color:red}", "a{background:url(bad url)}", "a{color:\\}", "a\0{color:red}",
    "@media screen{@media print{@media tty{@media all{a{color:red}}}}}", "@counter-style x{system:cyclic}", "@scope (a){b{color:red}}", "@container x{.host-protected{color:red}}", "@starting-style{a{color:red}}",
    "a{} ;; garbage", "a", "{color:red}", "a{;color}", "a{color:}",
    "a{color:red}" + " ".repeat(64_001),
  ];
  for (const css of bad) test(JSON.stringify(css.length > 60 ? css.slice(0, 60) + "..." : css), async () => cssRejected(css));

  test("each construct the plan bans is in the table above", () => {
    const text = bad.join("\n");
    for (const needle of ["@import", "url(https", "host-protected", "bk-protected", "expression", "-moz-binding", "behavior", "@font-face"]) expect(text).toContain(needle);
  });

  test("ordinary author CSS is accepted, including a hostile-looking but legitimate layout", async () => {
    const good: string[] = [
      "body{display:none}", ":root{--bk-surface-base:#fff}", "*{box-sizing:border-box}", "a::before{content:'x'}", "html{color:red !important}", "a:hover,b:focus-visible{color:red}",
      "@media (min-width:600px){a{color:red}}", "@supports (display:grid){a{display:grid}}", "@keyframes spin{0%{opacity:0}50%{opacity:.5}100%{opacity:1}}", ".a:not(.b) > c + d ~ e{color:red}",
      "a{background:url(asset:backdrop)}", "a{background:url('asset:backdrop')}", "a{background:linear-gradient(red,blue),url( \"asset:backdrop\" )}", "a{content:\"\\201C quote\"}", "[data-part='shell.nav']{color:red}", "[class~=gate]{color:red}", "[class=gate]{color:red}",
    ];
    for (const css of good) {
      const p = await modThemePackage((m) => { m.assets["styles.css"] = css + "\n" + MOD_STYLES; });
      expect(await rejects(p), css).toBe("accepted");
    }
  });
});

describe("scopeThemeCss", () => {
  const urlFor = (id: string): string => `/api/themes/assets/p/${id}?digest=d`;
  test("keeps every selector subject off the protected layer, before any pseudo-element", () => {
    const out = scopeThemeCss("a b, .x > c:hover::after, *, ::selection, d:before { color: red } @media (min-width:1px){ e{color:blue} } @keyframes k { from{opacity:0} to{opacity:1} }", urlFor);
    expect(out).toContain(`a b${PROTECTED_SCOPE},`);
    expect(out).toContain(`.x > c:hover${PROTECTED_SCOPE}::after`);
    expect(out).toContain(`*${PROTECTED_SCOPE},`);
    expect(out).toContain(`${PROTECTED_SCOPE}::selection`);
    expect(out).toContain(`d${PROTECTED_SCOPE}:before`);
    expect(out).toContain(`e${PROTECTED_SCOPE}{color:blue}`);
    expect(out).toContain("from{opacity:0}");
    expect(out).not.toContain("from" + PROTECTED_SCOPE);
  });

  test("resolves package urls and nothing else", () => {
    const out = scopeThemeCss("a{background:url(asset:backdrop)} b{background:url( 'asset:badge' )}", urlFor);
    expect(out).toContain(`url("/api/themes/assets/p/backdrop?digest=d")`);
    expect(out).toContain(`url("/api/themes/assets/p/badge?digest=d")`);
    expect(out).not.toContain("asset:");
  });
});

describe("slots", () => {
  const slots = (value: unknown) => modThemePackage((p) => { p.manifest.slots = value; });
  test("takes the fixed slot ids and nothing else", async () => {
    expect(SLOT_IDS.length).toBe(41);
    expect(await rejects(await slots({ "shell.sidebar": [{ kind: "text", text: "x" }] }))).toContain("unknown slot");
    for (const id of SLOT_IDS) expect(await rejects(await slots({ [id]: [{ kind: "text", text: "x" }] })), id).toBe("accepted");
  });
  test("limits items, text and keys", async () => {
    const t = { kind: "text", text: "x" };
    expect(await rejects(await slots({ "library.header": [t, t, t, t, t] }))).toContain("slots");
    expect(await rejects(await slots({ "library.header": [] }))).toContain("slots");
    expect(await rejects(await slots({}))).toContain("invalid theme package");
    const four = [t, t, t, t];
    expect(await rejects(await slots(Object.fromEntries(SLOT_IDS.slice(0, 7).map((id) => [id, four]))))).toContain("at most 24");
    expect(await rejects(await slots({ "library.header": [{ kind: "text", text: "x".repeat(281) }] }))).toContain("slots");
    expect(await rejects(await slots({ "library.header": [{ kind: "text", text: "x‮y" }] }))).toContain("slots");
    expect(await rejects(await slots({ "library.header": [{ kind: "text", text: "x", html: "<b>" }] }))).toContain("slots");
    expect(await rejects(await slots({ "library.header": [{ kind: "html", text: "x" }] }))).toContain("slots");
  });
  test("text stays text and images must be declared package images", async () => {
    const p = await inspectThemePackage(await slots({ "library.header": [{ kind: "text", text: "<img src=x onerror=alert(1)>" }] }));
    expect(p.slots["library.header"]).toEqual([{ kind: "text", text: "<img src=x onerror=alert(1)>" }]);
    expect(await rejects(await slots({ "library.header": [{ kind: "image", asset: "ghost", alt: "" }] }))).toContain("declared image");
    expect(await rejects(await slots({ "library.header": [{ kind: "image", asset: "face", alt: "" }] }))).toContain("declared image");
    expect(await rejects(await slots({ "library.header": [{ kind: "image", asset: "badge", alt: "x".repeat(161) }] }))).toContain("alt");
  });
  test("a class must be defined by the package styles as a rule on that class alone", async () => {
    const item = (cls: string) => ({ "library.header": [{ kind: "text", text: "x", class: cls }] });
    expect(await rejects(await slots(item("mod-stamp-note")))).toBe("accepted");
    expect(await rejects(await slots(item("gate-card")))).toContain("class must be defined");
    expect(await rejects(await slots(item("host-protected")))).toContain("class must be defined");
    const borrowed = await modThemePackage((p) => { p.assets["styles.css"] = MOD_STYLES + "\n.gate-card{color:red} .kit-gate{color:red}"; p.manifest.slots = item("gate-card"); });
    expect(await rejects(borrowed), "a host class the styles also define is still not borrowable").toContain("class must be defined");
    expect(await rejects(await slots(item("mod-")))).toContain("class must be defined");
    const compound = await modThemePackage((p) => { p.assets["styles.css"] = MOD_STYLES + "\n.mod-hidden .inner{color:red} .mod-a.mod-b{color:red} c .mod-d{color:red}"; p.manifest.slots = item("mod-hidden"); });
    expect(await rejects(compound)).toContain("class must be defined");
    const list = await modThemePackage((p) => { p.assets["styles.css"] = MOD_STYLES + "\n.mod-one, .mod-two {color:red}"; p.manifest.slots = item("mod-two"); });
    expect(await rejects(list)).toBe("accepted");
  });
});

describe("the mod- class namespace", () => {
  test("the host never uses a mod- class, so the namespace stays the package's own", () => {
    const hits: string[] = [];
    const walk = (dir: URL): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const next = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
        if (entry.isDirectory()) walk(next);
        else if (/\.(tsx?|css)$/.test(entry.name) && !/\.test\.|theme-mod|mod-style|store-mod-guard/.test(entry.name) && /(\.|["' ])mod-[a-z]/.test(readFileSync(next, "utf8"))) hits.push(entry.name);
      }
    };
    walk(new URL("../ui/", import.meta.url));
    expect(hits).toEqual([]);
  });
});

describe("binary files", () => {
  const set = (path: string, value: unknown) => modThemePackage((p) => { p.assets[path] = value; });
  test("digests are over the decoded bytes", async () => {
    const p = await inspectThemePackage(await modThemePackage());
    const digest = Buffer.from(await crypto.subtle.digest("SHA-256", Uint8Array.from(pngBytes()))).toString("hex");
    expect(p.assets.find((a) => a.id === "backdrop")!.digest).toBe(digest);
  });
  test("refuses damage, trailing bytes, oversized dimensions, wrong lengths and non-canonical base64", async () => {
    const flip = (b: number[], at: number): number[] => b.map((v, i) => i === at ? v ^ 1 : v);
    const cases: [string, unknown][] = [
      ["assets/backdrop.png", base64(flip(pngBytes(), 30))], ["assets/backdrop.png", base64([...pngBytes(), 0])], ["assets/backdrop.png", base64(pngBytes().slice(0, -3))],
      ["assets/backdrop.png", png(5000, 10)], ["assets/backdrop.png", png(3000, 3000)], ["assets/backdrop.png", base64(pngBytes().slice(8))], ["assets/backdrop.png", webp()],
      ["assets/badge.webp", base64(flip(webpBytes(), 5))], ["assets/badge.webp", webp(5000, 2)], ["assets/badge.webp", base64(webpBytes().slice(0, -2))], ["assets/badge.webp", png()],
      ["fonts/face.woff2", base64(woff2Bytes().slice(0, 60))], ["fonts/face.woff2", base64(flip(woff2Bytes(), 0))], ["fonts/face.woff2", png()],
      ["assets/backdrop.png", png() + "\n"], ["assets/backdrop.png", png().replace(/=+$/, "")], ["assets/backdrop.png", ""], ["assets/backdrop.png", 7],
      ["assets/backdrop.png", base64(new Array(130_000).fill(1))], ["fonts/face.woff2", base64(new Array(130_000).fill(1))],
    ];
    for (const [path, value] of cases) expect(await rejects(await set(path, value)), path + String(value).slice(0, 20)).toContain("invalid theme package");
    expect(woff2().length).toBeGreaterThan(0);
  });
  test("a file at the size cap passes and one byte over is refused, for images and fonts alike", async () => {
    const fits = pngBytes(2, 2, 128_000 - pngBytes().length);
    expect(fits.length).toBe(128_000);
    expect(await rejects(await set("assets/backdrop.png", base64(fits)))).toBe("accepted");
    expect(await rejects(await set("assets/backdrop.png", base64(pngBytes(2, 2, 128_001 - pngBytes().length))))).toContain("invalid theme package");
    expect(await rejects(await set("fonts/face.woff2", base64(woff2Bytes(128_000))))).toBe("accepted");
    expect(await rejects(await set("fonts/face.woff2", base64(woff2Bytes(128_001))))).toContain("invalid theme package");
  });
  test("base64 has exactly one text form: stray trailing bits are refused", () => {
    expect(Array.from(decodeCanonicalBase64("QQ=="))).toEqual([65]);
    expect(() => decodeCanonicalBase64("QR==")).toThrow();
    expect(() => decodeCanonicalBase64("QUI=")).not.toThrow();
    expect(() => decodeCanonicalBase64("QUJ=")).toThrow();
  });
  test("an animated WebP is refused", async () => {
    const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));
    const vp8x = [...ascii("VP8X"), 10, 0, 0, 0, 0x02, 0, 0, 0, 1, 0, 0, 1, 0, 0];
    const body = [...ascii("WEBP"), ...vp8x, ...webpBytes().slice(12)];
    const file = [...ascii("RIFF"), body.length & 255, (body.length >> 8) & 255, 0, 0, ...body];
    expect(await rejects(await set("assets/badge.webp", base64(file)))).toContain("invalid theme package");
  });
  test("the media type must match the path extension and ids stay unique", async () => {
    expect(await rejects(await modThemePackage((p) => { p.manifest.assets.find((a: any) => a.id === "backdrop").mediaType = "image/webp"; }))).toContain("invalid theme package");
    expect(await rejects(await modThemePackage((p) => { p.manifest.fonts[0].mediaType = "font/woff"; }))).toContain("invalid theme package");
    expect(await rejects(await modThemePackage((p) => { p.manifest.fonts[0].id = "backdrop"; }))).toContain("invalid theme package");
  });
});

describe("host lists the checker holds the styles to", () => {
  test("HOST_FONT_FAMILIES names every family the painter can write and every @font-face the host ships, and HOST_KEYFRAMES every global keyframe", () => {
    const tokens = readFileSync(new URL("../ui/shell/theme-tokens.ts", import.meta.url), "utf8");
    const families = [...tokens.matchAll(/'"([^"]+)"/g)].map((m) => m[1]!.toLowerCase());
    expect(families.length).toBeGreaterThan(5);
    for (const f of families) expect(HOST_FONT_FAMILIES).toContain(f);
    const css = readFileSync(new URL("../ui/theme/tokens.css", import.meta.url), "utf8");
    // Every face the host ships is reserved, not only the ones the painter writes: a package face under a bundled name (OpenDyslexic, Lexend) would replace the reader's accessibility font.
    const shipped = new Set([...css.matchAll(/@font-face\s*\{[^}]*?font-family:\s*"([^"]+)"/g)].map((m) => m[1]!.toLowerCase()));
    expect(shipped.size).toBeGreaterThan(12);
    for (const f of shipped) expect(HOST_FONT_FAMILIES).toContain(f);
    for (const m of css.matchAll(/@keyframes\s+([A-Za-z0-9_-]+)/g)) expect(HOST_KEYFRAMES).toContain(m[1]!.toLowerCase());
  });
});
