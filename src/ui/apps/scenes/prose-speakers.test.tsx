/** Per-speaker dialogue colours through the real Prose mount and sanitizer: each quote takes its speaker's colour, the main character's is the fallback, and no roster draws as before. */
import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { Speaker } from "../../../core/participants/roster";
import { installDom, teardownAllDoms } from "../../_shared/test-dom";

afterAll(teardownAllDoms);
let dom: JSDOM;
beforeAll(() => { dom = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8325/", extraGlobals: ["SVGElement"] }).dom; });
let host: HTMLElement | undefined;
afterEach(() => { host?.remove(); host = undefined; });

const vera: Speaker = { id: "card", name: "Vera", main: true, color: "#112233" };
const atlas: Speaker = { id: "n1", name: "Atlas Guard", main: false, color: "#445566" };

async function quotes(text: string, speakers?: readonly Speaker[]): Promise<(string | null)[]> {
  const { createRoot } = await import("react-dom/client");
  const { flushSync } = await import("react-dom");
  const { Prose } = await import("./prose");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  flushSync(() => createRoot(host!).render(<Prose text={text} {...(speakers ? { speakers } : {})} />));
  return [...host.querySelectorAll("q")].map((q) => (q as HTMLElement).style.color || null);
}

test("each quote takes its speaker's colour and an unclaimed one the main character's", async () => {
  expect(await quotes('"Halt," Atlas Guard growled. "Who goes there?"', [vera, atlas])).toEqual(["rgb(68, 85, 102)", "rgb(17, 34, 51)"]);
});

test("with no speakers the quotes keep the scene's own tone, exactly as before", async () => {
  expect(await quotes('"Halt," Atlas Guard growled.')).toEqual([null]);
  expect(await quotes('"Halt," Atlas Guard growled.', [])).toEqual([null]);
});
