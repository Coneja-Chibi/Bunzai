/**
 * A multi-line message where two different lines both open with the same markup at the same
 * character offset (extremely common in SillyTavern-style text: many lines start with a bare
 * `*action*` at index 0) must never produce a React duplicate-key warning. `inline()` used to key
 * each `<em>`/`<q>` by the regex match's offset WITHIN its own line, so two lines colliding at the
 * same offset produced two siblings under the same `<p>` with the same key (big imported scenes hit
 * this on nearly every multi-line reply).
 */
import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { installDom, teardownAllDoms } from "../../_shared/test-dom";

afterAll(teardownAllDoms);

let dom: JSDOM;

beforeAll(() => {
  dom = installDom("<!doctype html><html><body></body></html>", {
    url: "http://127.0.0.1:8325/",
    extraGlobals: ["SVGElement"]
  }).dom;
});

let host: HTMLElement | undefined;
afterEach(() => {
  host?.remove();
  host = undefined;
});

/** Renders <Prose text> into a fresh JSDOM root and returns every "same key" console.error fired. */
async function renderAndCaptureKeyWarnings(text: string): Promise<string[]> {
  const { createRoot } = await import("react-dom/client");
  const { flushSync } = await import("react-dom");
  const { Prose } = await import("./prose");
  const warnings: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const msg = String(args[0]);
    if (msg.includes("same key")) warnings.push(String(args[1]));
    else originalError(...args);
  };
  try {
    host = dom.window.document.createElement("div");
    dom.window.document.body.appendChild(host);
    const root = createRoot(host);
    flushSync(() => root.render(<Prose text={text} />));
  } finally {
    console.error = originalError;
  }
  return warnings;
}

test("two lines that both open with *action* at the same offset render with no duplicate React key", async () => {
  const text = "*looks up*\n*smiles warmly*\n\"Hello there,\" she says.";
  const warnings = await renderAndCaptureKeyWarnings(text);
  expect(warnings).toEqual([]);
});

test("a paragraph with several lines sharing offsets keeps every inline element uniquely keyed", async () => {
  const text = [
    "*draws her sword*",
    "*narrows her eyes*",
    "\"Stand back,\" she warns.",
    "*steps forward*",
  ].join("\n");
  const warnings = await renderAndCaptureKeyWarnings(text);
  expect(warnings).toEqual([]);
});

/** Renders <Prose text> and returns the host element so the mounted DOM can be inspected. */
async function mount(text: string): Promise<HTMLElement> {
  const { createRoot } = await import("react-dom/client");
  const { flushSync } = await import("react-dom");
  const { Prose } = await import("./prose");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  flushSync(() => createRoot(host!).render(<Prose text={text} />));
  return host;
}

test("markdown, actions, speech and sanitized html render through the one component", async () => {
  const el = await mount('# Title\n\n*waves* "hi" **bold** `code`\n\n- a\n- b\n\n<span style="color:red">red</span>');
  expect(el.querySelector("h1")?.textContent).toBe("Title");
  expect(el.querySelector("em")?.textContent).toBe("waves");
  expect(el.querySelector("q")?.textContent).toBe("hi");
  expect(el.querySelector("strong")?.textContent).toBe("bold");
  expect(el.querySelector("code")?.textContent).toBe("code");
  expect(el.querySelectorAll("li").length).toBe(2);
  expect(el.querySelector("span")?.getAttribute("style")).toBe("color: red");
});

test("hostile text mounts as inert nodes: no script, no handler, no live javascript link", async () => {
  const el = await mount('<script>window.__pwned=1</script><img src=x onerror="window.__pwned=1">[x](javascript:window.__pwned=1)\n\n<div onclick="window.__pwned=1">d</div>');
  expect(el.querySelector("script")).toBeNull();
  expect(el.innerHTML).not.toMatch(/onerror|onclick|javascript:/i);
  expect((dom.window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
});

test("a fenced block with an unclosed fence after it does not swallow later paragraphs", async () => {
  const el = await mount("```\nopen\n\nstill a paragraph");
  expect(el.querySelector("pre")).toBeNull();
  expect(el.textContent).toContain("still a paragraph");
});

test("an http link opens through the leaving gate, not natively", async () => {
  const { subscribeExternal } = await import("../../_shared/link-gate");
  const seen: string[] = [];
  // the link gate dispatches a CustomEvent on the global window, which is jsdom here, so use its constructor
  const g = globalThis as unknown as { CustomEvent: unknown };
  const realCustomEvent = g.CustomEvent;
  g.CustomEvent = dom.window.CustomEvent;
  const off = subscribeExternal((t) => seen.push(t.url));
  const el = await mount("[site](https://example.com/a)");
  const a = el.querySelector("a")!;
  const ev = new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
  a.dispatchEvent(ev);
  off();
  g.CustomEvent = realCustomEvent;
  expect(a.getAttribute("rel")).toBe("noopener noreferrer");
  expect(a.getAttribute("target")).toBe("_blank");
  expect(ev.defaultPrevented).toBe(true);
  expect(seen).toEqual(["https://example.com/a"]);
});

// ---- <style> blocks and CSS-only cards, through the whole component ----

const TAB_CARD = [
  "<style>",
  "#tab-a:checked ~ .panels .pane-a { display: block; }",
  "#tab-b:checked ~ .panels .pane-b { display: block; }",
  ".pane-a, .pane-b { display: none; }",
  "label { cursor: pointer; }",
  "</style>",
  '<input type="radio" id="tab-a" name="g" checked>',
  '<input type="radio" id="tab-b" name="g">',
  "",
  '<label for="tab-a">A</label>',
  '<label for="tab-b">B</label>',
  "",
  '<div class="panels"><div class="pane-a">one</div><div class="pane-b">two</div></div>',
].join("\n");

const FLIP_CARD = [
  "<style>",
  ".flip { perspective: 600px; } .flip .inner { transition: transform .5s; transform-style: preserve-3d; }",
  ".flip input:checked ~ .inner { transform: rotateY(180deg); }",
  ".front, .back { position: absolute; inset: 0; backface-visibility: hidden; } .back { transform: rotateY(180deg); }",
  "</style>",
  '<label class="flip"><input type="checkbox" style="display:none"><div class="inner"><div class="front">front</div><div class="back">back</div></div></label>',
].join("\n");

const click = (el: Element): void => { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })); };
const scopeOf = (el: Element): string => [...el.querySelector(".prose")!.classList].find((c) => c.startsWith("msg-"))!;

test("a radio-tab card mounts with its inputs as siblings of its panels, a scoped sheet, and working labels", async () => {
  const el = await mount(TAB_CARD);
  const scope = scopeOf(el);
  const sheet = el.querySelector("style")!.textContent!;
  expect(sheet.startsWith(`.${scope}.${scope}.${scope}{position:relative;isolation:isolate;contain:paint}`)).toBe(true);
  const a = el.querySelector<HTMLInputElement>(`#${scope}-tab-a`)!, b = el.querySelector<HTMLInputElement>(`#${scope}-tab-b`)!;
  expect(a.parentElement).toBe(el.querySelector(".custom-panels")!.parentElement);
  expect(el.querySelectorAll(".blk").length).toBe(1);
  expect(a.name).toBe(`${scope}-g`);
  expect(a.checked).toBe(true);
  const rule = (id: string, pane: string): string => `#${id}:checked ~ .custom-panels .custom-${pane}`;
  expect(el.querySelector(rule(a.id, "pane-a"))).not.toBeNull();
  expect(el.querySelector(rule(b.id, "pane-b"))).toBeNull();
  click(el.querySelector(`label[for="${b.id}"]`)!);
  expect([a.checked, b.checked]).toEqual([false, true]);
  expect(el.querySelector(rule(b.id, "pane-b"))).not.toBeNull();
  expect(el.querySelector(rule(a.id, "pane-a"))).toBeNull();
  for (const id of [a.id, b.id]) expect(sheet).toContain(`.${scope}.${scope}.${scope} #${id}:checked ~ .custom-panels`);
});

test("a flip card toggles through its label and keeps the 3D rules", async () => {
  const el = await mount(FLIP_CARD);
  const scope = scopeOf(el);
  const sheet = el.querySelector("style")!.textContent!;
  const box = el.querySelector<HTMLInputElement>("input[type=checkbox]")!;
  expect(box.getAttribute("style")).toBe("display: none"); // the inline allowlist keeps the usual way to hide the checkbox
  expect(el.querySelector(".custom-flip input:checked ~ .custom-inner")).toBeNull();
  click(el.querySelector("label")!);
  expect(box.checked).toBe(true);
  expect(el.querySelector(".custom-flip input:checked ~ .custom-inner")).not.toBeNull();
  for (const piece of ["perspective:600px", "transform-style:preserve-3d", "transform:rotateY(180deg)", "backface-visibility:hidden", `.${scope}.${scope}.${scope} .custom-flip input:checked ~ .custom-inner`]) expect(sheet).toContain(piece);
});

test("two copies of one message share no id or radio group, so each card works on its own", async () => {
  const one = await mount(TAB_CARD);
  const two = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(two);
  const { createRoot } = await import("react-dom/client");
  const { flushSync } = await import("react-dom");
  const { Prose } = await import("./prose");
  flushSync(() => createRoot(two).render(<Prose text={TAB_CARD} />));
  const ids = (e: Element): string[] => [...e.querySelectorAll("[id]")].map((n) => n.id);
  expect(ids(one).length).toBeGreaterThan(0);
  expect(ids(one).filter((i) => ids(two).includes(i))).toEqual([]);
  const names = (e: Element): string[] => [...e.querySelectorAll<HTMLInputElement>("input")].map((n) => n.name);
  expect(names(one).filter((n) => names(two).includes(n))).toEqual([]);
  click(one.querySelector("label[for$='tab-b']")!);
  expect([...one.querySelectorAll<HTMLInputElement>("input")].map((i) => i.checked)).toEqual([false, true]);
  expect([...two.querySelectorAll<HTMLInputElement>("input")].map((i) => i.checked)).toEqual([true, false]);
  two.remove();
});

test("a hostile stylesheet restyles only its own message, not a neighbour, the composer or the protected layer", async () => {
  const { createRoot } = await import("react-dom/client");
  const { flushSync } = await import("react-dom");
  const { Prose } = await import("./prose");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const chrome = dom.window.document.createElement("div");
  chrome.className = "host-protected";
  chrome.id = "protected";
  const composer = dom.window.document.createElement("textarea");
  composer.id = "composer";
  host.append(chrome, composer);
  const victim = dom.window.document.createElement("div");
  const attacker = dom.window.document.createElement("div");
  host.append(victim, attacker);
  const evil = "body,html,:root,*{display:none} .blk{display:none} .host-protected,#composer,textarea,div{display:none} ~ .blk{display:none} :is(body,.blk) + .blk{display:none}";
  flushSync(() => {
    createRoot(victim).render(<Prose text={"Victim line one.\n\nVictim line two."} />);
    createRoot(attacker).render(<Prose text={`<style>${evil}</style>\n<div class="host-protected">mine</div>`} />);
  });
  const shown = (e: Element | null): string => dom.window.getComputedStyle(e!).display;
  expect(shown(attacker.querySelector(".custom-host-protected"))).toBe("none");
  expect(shown(victim.querySelector(".blk"))).not.toBe("none");
  expect(shown(host.querySelector("#protected"))).not.toBe("none");
  expect(shown(host.querySelector("#composer"))).not.toBe("none");
  expect(shown(victim.querySelector(".prose"))).not.toBe("none");
});

test("the first </style> ends the sheet, as in HTML: what follows is message text, never a script", async () => {
  const el = await mount('<style>.a::after{content:"</style><script>window.__p=1</script>"}</style>\n\nhi');
  expect(el.querySelector("script")).toBeNull();
  expect(el.querySelector("style")).toBeNull(); // the half sheet has an open string, so it is dropped whole
  expect((dom.window as unknown as { __p?: number }).__p).toBeUndefined();
});

test("a stylesheet that is too big or will not parse is dropped and the message still renders", async () => {
  const big = await mount(`<style>.a{color:red}${" ".repeat(70_000)}</style>\n\n<div class="a">still here</div>`);
  expect(big.querySelector("style")).toBeNull();
  expect(big.textContent).toContain("still here");
  const bad = await mount('<style>.a{color:red</style>\n\n<div class="a">still here too</div>');
  expect(bad.querySelector("style")).toBeNull();
  expect(bad.textContent).toContain("still here too");
});

test("while a card streams, the sheet appears once it closes and is not rebuilt as the text grows", async () => {
  const { createRoot } = await import("react-dom/client");
  const { flushSync } = await import("react-dom");
  const { Prose } = await import("./prose");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  const render = (text: string): void => flushSync(() => root.render(<Prose text={text} />));
  render("<style>\n.a{color:red}");
  expect(host.querySelector("style")).toBeNull();
  render('<style>\n.a{color:red}\n</style>\n<div class="a">card</div>');
  const sheet = host.querySelector("style");
  expect(sheet?.textContent).toContain(".custom-a{color:red}");
  render('<style>\n.a{color:red}\n</style>\n<div class="a">card, and more</div>');
  expect(host.querySelector("style")).toBe(sheet);
  expect(host.textContent).toContain("card, and more");
});
