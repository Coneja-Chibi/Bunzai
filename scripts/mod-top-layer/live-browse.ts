/** The browser half of live.ts, under Node. Prints one RESULT line of facts and writes screenshots into the work folder. */
import { readFileSync, writeFileSync } from "node:fs";
import type { Page } from "playwright-core";
import { launch } from "../theme-measure/driver.ts";

const [url, work, port] = process.argv.slice(2) as [string, string, string];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pkgs = { scale: JSON.parse(readFileSync(`${work}/hostile-scale.json`, "utf8")), overlay: JSON.parse(readFileSync(`${work}/hostile-overlay.json`, "utf8")) };
const ID = "bunzai.theme.modtest";

const api = (page: Page, method: string, path: string, body?: unknown) => page.evaluate(async ([method, path, body]) => {
  const token = document.querySelector('meta[name="vaude-session"]')?.getAttribute("content") ?? "";
  const res = await fetch(path as string, { method: method as string, headers: { "content-type": "application/json", "X-Bunzai-Token": token }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: await res.json().catch(() => null) as any };
}, [method, path, body] as const);

/** What the page says about the mod and the protected surface right now. */
const facts = (page: Page) => page.evaluate(() => {
  const style = document.getElementById("bk-mod-style") as HTMLStyleElement | null;
  const dialog = document.querySelector("dialog.host-protected") as HTMLDialogElement | null;
  const inline = document.querySelector(".host-protected:not(dialog)") as HTMLElement | null;
  const at = (el: Element | null) => { if (!el) return null; const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!hit && el.contains(hit); };
  const text = (dialog ?? inline)?.querySelector("h1,h2,strong,p");
  return {
    modStyleOnPage: !!style && !style.disabled,
    rootFontSize: getComputedStyle(document.documentElement).fontSize,
    pin: document.documentElement.style.getPropertyValue("--host-type-zoom"),
    dialogOpen: dialog?.open ?? null, dialogModal: dialog?.matches(":modal") ?? null,
    backdrop: dialog ? getComputedStyle(dialog, "::backdrop").backgroundColor : null,
    surfaceHitAtCenter: at(dialog ?? inline),
    surfaceTextBox: text ? (({ width, height }) => ({ w: Math.round(width), h: Math.round(height) }))(text.getBoundingClientRect()) : null,
    statusNote: document.body.innerText.includes("covered a protected prompt"),
  };
}).then(async (f) => {
  // the host's own record: is the package still granted, or was it marked broken
  const packages = (await api(page, "GET", "/api/themes/packages")).json as { id: string; enabled: boolean; grantedScopes: string[] }[];
  const mine = packages.find((p) => p.id === ID);
  return { ...f, packageEnabled: mine?.enabled ?? null, packageGranted: mine?.grantedScopes.length ?? null };
});

const out: Record<string, unknown> = {};
const browser = await launch(work, Number(port));
try {
  const page = browser.page;
  await page.goto(url); await sleep(1500);
  await api(page, "PATCH", "/api/settings", { setupComplete: true, theme: "theater" });

  // The agent's turn stream, held open after one gate frame: the app clears a gate when its stream ends.
  await page.addInitScript(() => {
    const real = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const u = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!u.includes("/api/agent/turn")) return real(input, init);
      const gate = { id: "t:1:0", name: "preset_delete", verdict: { level: "write", why: "This removes a preset from your library." }, review: { title: "Delete House Style", warnings: ["this removes 60 blocks", "a scene still uses this preset"], lines: ["preset house", "60 blocks"] } };
      const nl = String.fromCharCode(10);
      const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("event: gate" + nl + "data: " + JSON.stringify(gate) + nl + nl)); init?.signal?.addEventListener("abort", () => { try { c.close(); } catch { /* closed */ } }); } });
      return Promise.resolve(new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } }));
    };
  });
  const scenes = {
    // loaded unlocked so the mod is painted, then locked the way the app learns of it: a 423 event
    lock: async () => { await page.goto("about:blank"); await page.goto(url); await sleep(3000); await page.route("**/api/library/status", (r) => r.fulfill({ json: { phase: "locked", hasPassword: true, hasWords: true } })); await page.evaluate(() => window.dispatchEvent(new Event("bunzai:library-locked"))); await sleep(1500);
      // the shell paints core while locked, so the mod is gone here; put the worst of it back, unscoped and unchecked, to see the door survive it
      await page.addStyleTag({ content: "body::after { content: ''; position: fixed; inset: 0; z-index: 2147483647; background: #c00000; opacity: 0.5; }" }); await sleep(800); },
    kit: async () => {
      await page.unroute("**/api/library/status");
      await page.route("**/api/agent/provider", (r) => r.fulfill({ json: { connected: true, provider: "Fake", model: "fake-model" } }));
      await page.goto("about:blank"); await page.goto(url + "#agent"); await sleep(2500);
      const box = page.locator("textarea").first();
      await box.fill("delete the house preset"); await box.press("Enter"); await sleep(2500);
    },
    manager: async () => {
      await page.unroute("**/api/agent/provider"); await page.goto("about:blank"); await page.goto(url + "#settings/appearance"); await sleep(3500);
      for (let i = 0; i < 4 && (await page.getByText(/^skip$/i).count()); i++) { await page.getByText(/^skip$/i).first().click({ timeout: 2000 }).catch(() => {}); await sleep(400); }
      await sleep(1500);
    },
  } as const;

  const install = async (pkg: unknown) => {
    // not from a page with a protected surface mounted: a mod painted over the Settings manager would be dropped on the spot
    await page.goto("about:blank"); await page.goto(url + "#library"); await sleep(1500);
    const offer = await api(page, "POST", "/api/themes/inspect", pkg);
    if (!offer.json?.challenge) throw new Error("hostile package refused: " + JSON.stringify(offer).slice(0, 300));
    const done = await api(page, "POST", "/api/themes/install", { challenge: offer.json.challenge, digest: offer.json.preview.digest, decision: "approve" });
    if (done.status !== 200) throw new Error("install " + done.status);
    await api(page, "PATCH", "/api/settings", { theme: ID });
  };
  for (const phase of ["core", "scale", "overlay"] as const) {
    if (phase !== "core") await install(pkgs[phase]);
    for (const name of ["lock", "kit", "manager"] as const) {
      await scenes[name]();
      await page.screenshot({ path: `${work}/${phase}-${name}.png` });
      out[`${phase}.${name}`] = await facts(page);
    }
    await page.unroute("**/api/library/status").catch(() => {});
  }
  const status = await api(page, "GET", "/api/themes/packages");
  out.packages = status.json;
} finally { await browser.close(); }
writeFileSync(`${work}/live-result.json`, JSON.stringify(out, null, 1));
console.log("RESULT" + JSON.stringify(out));
