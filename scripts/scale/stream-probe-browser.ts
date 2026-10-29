/**
 * Tab side of the S0 streaming probe: a headless system Chrome on its own profile opens the Library, sends
 * the first pack to the Workbench, and reports, per step, the peak working set of every Chrome process of
 * that profile (by type), the peak JS heap, and what the page fetched. Run by stream-probe.ts
 * (scenarios open-pack-browser, press-pack-browser); not meant to be run on its own.
 *   bun scripts/scale/stream-probe-browser.ts <abs sandbox> <base url> <steps: open|press>
 */
import { chromium, type BrowserContext, type CDPSession, type Page } from "playwright-core";
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [sandbox, base, mode] = process.argv.slice(2);
if (!sandbox || !base || !mode) throw new Error("usage: stream-probe-browser.ts <sandbox> <base> <open|press>");
const profile = join(sandbox, `chrome-profile-${Date.now()}`);
const wsFile = join(sandbox, "samples", `chrome-${Date.now()}.tsv`);
const chrome = process.env["CHROME_PATH"] ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
if (!existsSync(chrome)) throw new Error("system Chrome not found; set CHROME_PATH");
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const mb = (n: number): number => Math.round(n / 1048576);

// One long-lived PowerShell loop samples the working set of this profile's Chrome processes (twice a second).
const needle = profile.replace(/\//g, "\\");
const sampler = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `
  $needle = '${needle.replace(/'/g, "''")}'
  while ($true) {
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($needle) } | ForEach-Object {
      $type = if ($_.CommandLine -match '--type=([a-z-]+)') { $Matches[1] } else { 'browser' }
      $ws = (Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue).WorkingSet64
      if ($ws) { Add-Content -Path '${wsFile.replace(/\\/g, "/")}' -Value "$now\`t$type\`t$($_.ProcessId)\`t$ws" }
    }
    Start-Sleep -Milliseconds 400
  }`], { stdio: "ignore", windowsHide: true });

interface Ws { t: number; type: string; pid: number; ws: number }
const readWs = (): Ws[] =>
  existsSync(wsFile) ? readFileSync(wsFile, "utf8").split("\n").filter(Boolean).map((l) => { const [t, type, pid, ws] = l.split("\t"); return { t: Number(t), type: type!, pid: Number(pid), ws: Number(ws) }; }) : [];

const requests = new Map<string, { url: string; bytes: number }>();
async function stepOf(name: string, cdp: CDPSession, run: () => Promise<void>): Promise<void> {
  await sleep(1200);
  const t0 = Date.now();
  requests.clear();
  let heapPeak = 0;
  let sampling = true;
  const heapLoop = (async () => {
    while (sampling) {
      const m = (await cdp.send("Performance.getMetrics")) as { metrics: { name: string; value: number }[] };
      heapPeak = Math.max(heapPeak, m.metrics.find((x) => x.name === "JSHeapUsedSize")?.value ?? 0);
      await sleep(150);
    }
  })();
  await run();
  await sleep(2500);
  sampling = false;
  await heapLoop;
  const t1 = Date.now();
  const all = readWs();
  // Sum of the latest working set of every process seen in the last 3 s (carry-forward, so a slow sample tick never reads as zero).
  const totalAt = (t: number, types?: string[]): number => {
    const latest = new Map<number, number>();
    for (const x of all) if (x.t <= t && x.t >= t - 3000 && (!types || types.includes(x.type))) latest.set(x.pid, x.ws);
    return [...latest.values()].reduce((p, q) => p + q, 0);
  };
  const peak = (from: number, to: number, types?: string[]): number => {
    let best = 0;
    for (let t = from; t <= to; t += 250) best = Math.max(best, totalAt(t, types));
    return best;
  };
  const before = totalAt(t0);
  const after = totalAt(t1);
  const byUrl = (re: RegExp): { count: number; mb: number } => {
    const list = [...requests.values()].filter((r) => re.test(r.url));
    return { count: list.length, mb: Math.round(list.reduce((a, r) => a + r.bytes, 0) / 10485.76) / 100 };
  };
  console.log(JSON.stringify({
    step: name, ms: t1 - t0,
    tabRendererPeakMb: mb(peak(t0, t1, ["renderer"])), allChromePeakMb: mb(peak(t0, t1)), allChromeBeforeMb: mb(before), allChromeAfterMb: mb(after),
    gpuPeakMb: mb(peak(t0, t1, ["gpu-process"])), browserPeakMb: mb(peak(t0, t1, ["browser"])),
    jsHeapPeakMb: mb(heapPeak),
    sampleUrls: [...requests.values()].filter((r) => r.url.includes("/api/")).slice(0, 4).map((r) => `${r.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 110)} ${r.bytes}`),
    studioGet: byUrl(/\/api\/studio\/get/), assetsFull: byUrl(/size=full/), assets96: byUrl(/size=96/), assets256: byUrl(/size=256/), assets512: byUrl(/size=512/), exportPack: byUrl(/export-pack/), exportPost: byUrl(/\/api\/export/),
  }));
}

let context: BrowserContext | undefined;
try {
  context = await chromium.launchPersistentContext(profile, { executablePath: chrome, headless: true, viewport: { width: 1400, height: 900 } });
  const page: Page = context.pages()[0] ?? (await context.newPage());
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  context.on("requestfinished", (request) => {
    void request.sizes().then((sizes) => requests.set(request.url() + Math.random(), { url: request.url(), bytes: sizes.responseBodySize })).catch(() => undefined);
  });

  await stepOf("library loaded", cdp, async () => {
    await page.goto(`${base}/#library`);
    await page.getByText(/skip all/i).click({ timeout: 4000 }).catch(() => undefined);
    await page.getByText(/^open bunzai/i).first().click({ timeout: 3000 }).catch(() => undefined);
    await page.getByText(/^skip$/i).first().click({ timeout: 3000 }).catch(() => undefined);
    await page.getByText(/^packs$/i).first().click({ timeout: 8000 }).catch(() => undefined);
    await page.getByText(/^pictures$/i).first().waitFor({ timeout: 30000 });
  });
  if (mode === "open") {
    await stepOf("send pack to Workbench and open", cdp, async () => {
      await page.getByText(/^pictures$/i).first().click();
      await page.getByText(/send it to the workbench/i).click();
      await page.getByRole("button", { name: /^yes$/i }).click({ timeout: 5000 }).catch(() => undefined);
      await sleep(8000);
      let images = 0;
      let decodedBytes = 0;
      for (const frame of page.frames()) {
        const got = await frame.evaluate(() => {
          const list = [...document.images].filter((img) => img.naturalWidth > 0);
          return { n: list.length, px: list.reduce((a, img) => a + img.naturalWidth * img.naturalHeight, 0) };
        }).catch(() => ({ n: 0, px: 0 }));
        images += got.n;
        decodedBytes += got.px * 4;
      }
      console.log(JSON.stringify({ step: "decoded images in all frames", images, decodedRgbaMb: mb(decodedBytes) }));
      await page.screenshot({ path: join(sandbox, "out", "workbench-open.png") });
    });
  } else {
    await stepOf("open the Press, stage the pack, pick PICTURE ZIP", cdp, async () => {
      await page.getByText(/^the press/i).first().click({ timeout: 5000 });
      await page.getByText(/^skip$/i).first().click({ timeout: 3000 }).catch(() => undefined);
      await page.getByText("pictures", { exact: true }).first().click({ timeout: 10000 });
      await page.getByText(/^picture zip$/i).first().click({ timeout: 5000 });
      await page.getByText(/run the press/i).waitFor({ timeout: 15000 });
      await sleep(3000);
      await page.screenshot({ path: join(sandbox, "out", "press-staged.png") });
    });
    await stepOf("run the Press (picture zip of the pack)", cdp, async () => {
      await page.getByText(/run the press/i).click({ timeout: 5000 });
      await page.getByText(/download|save/i).first().waitFor({ timeout: 60000 }).catch(() => undefined);
      await sleep(4000);
      await page.screenshot({ path: join(sandbox, "out", "press-run.png") });
    });
  }
} finally {
  sampler.kill();
  await context?.close();
  appendFileSync(join(sandbox, "out", "browser-done.txt"), `${mode} done\n`);
  writeFileSync(`${wsFile}.done`, "1");
}
