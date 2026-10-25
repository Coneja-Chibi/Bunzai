/**
 * The browser half of the perf harness: seeds a
 * throwaway studio with realistic data, boots the real dev server on it, drives it with a headless
 * Chrome over CDP (playwright-core), and prints the section 11 matrix. Its legacy invocation stays
 * informational; S21's explicit release-evidence mode writes numeric rows and fails on missing data,
 * route errors, or budget breaches. Neither mode runs in `verify:ci`.
 *
 * NEVER run this against a real studio folder. It refuses to start without an explicit `--sandbox`
 * directory, and never defaults to `~/Documents/Bunraku Studio`. It also never touches the owner's
 * own running instance: pick a `--port` and `--cdp-port` you know are free.
 *
 * playwright-core's CDP transport hangs under `bun run` (observed 2026-09-29, both `chromium.launch`
 * and `chromium.connectOverCDP`; the same script completes in under 200 ms under `node`). So this
 * file spawns Chrome itself with `--remote-debugging-port`, and drives it from a small generated
 * script run under `node`, not `bun`. Everything else here (seeding, spawning the server, printing
 * the table) runs under `bun`, matching the rest of `scripts/`.
 *
 * Run: bun run perf-browser -- --sandbox <empty-or-throwaway-dir> [--port 8410] [--cdp-port 9410]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, type ChildProcess } from "node:child_process";
import type { JsonObject } from "../src/stage/contracts/chat-store";
import { driverScript } from "./scale/browser-driver";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..");

function parseArgs(argv: string[]): { sandbox: string; port: number; cdpPort: number; skipSeed: boolean; releaseEvidence: boolean; profile: string; chromePath?: string; matrixOutput?: string; assetFile?: string; fontFile?: string; svgFile?: string; backgroundFile?: string; importFile?: string; complexityStudio?: string } {
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const sandbox = flag("sandbox");
  if (!sandbox) {
    console.error(
      "perf-browser: refuses to run without --sandbox <dir>. It will seed and boot a throwaway " +
        "studio there; never point it at a real studio folder or the default ~/Documents/Bunraku Studio.",
    );
    process.exit(2);
  }
  return {
    sandbox,
    port: Number(flag("port") ?? 8410),
    cdpPort: Number(flag("cdp-port") ?? 9410),
    // scripts/scale/timed.ts's own use: it seeds the sandbox itself (from scripts/scale/fixtures,
    // at a caller-given N) before handing this file the already-seeded studio to drive.
    skipSeed: argv.includes("--skip-seed"),
    releaseEvidence: argv.includes("--release-evidence"),
    profile: flag("profile") ?? "informational",
    ...(flag("chrome-path") ? { chromePath: flag("chrome-path") } : {}),
    ...(flag("matrix-output") ? { matrixOutput: flag("matrix-output") } : {}),
    ...(flag("asset-file") ? { assetFile: flag("asset-file") } : {}),
    ...(flag("font-file") ? { fontFile: flag("font-file") } : {}),
    ...(flag("svg-file") ? { svgFile: flag("svg-file") } : {}),
    ...(flag("background-file") ? { backgroundFile: flag("background-file") } : {}),
    ...(flag("import-file") ? { importFile: flag("import-file") } : {}),
    ...(flag("complexity-studio") ? { complexityStudio: flag("complexity-studio") } : {}),
  };
}

/** Stops only the process tree started here and settles within a bounded deadline. */
async function stopTree(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once("exit", resolve));
  const wait = (ms: number) => new Promise<"done" | "timeout">((resolve) => {
    const timer = setTimeout(() => resolve("timeout"), ms);
    void exited.then(() => { clearTimeout(timer); resolve("done"); });
  });
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    const stopped = await Promise.race([new Promise<boolean>((resolve) => killer.once("exit", () => resolve(true))), wait(3_000).then((result) => result === "done")]);
    if (!stopped) { killer.kill(); throw new Error(`taskkill deadline expired for owned process ${child.pid}`); }
  } else {
    try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
  }
  if (await wait(5_000) === "timeout") {
    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      const stopped = await Promise.race([new Promise<boolean>((resolve) => killer.once("exit", () => resolve(true))), wait(3_000).then((result) => result === "done")]);
      if (!stopped) { killer.kill(); throw new Error(`taskkill deadline expired for owned process ${child.pid}`); }
    } else {
      try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
    }
  }
  if (await wait(3_000) === "timeout") throw new Error(`owned child process ${child.pid} did not exit after termination`);
}

const { sandbox, port, cdpPort, skipSeed, releaseEvidence, profile, chromePath, matrixOutput, assetFile, fontFile, svgFile, backgroundFile, importFile, complexityStudio } = parseArgs(process.argv.slice(2));
if (releaseEvidence && (!skipSeed || profile !== "low-end" || !matrixOutput || !assetFile || !fontFile || !svgFile || !backgroundFile || !importFile || !complexityStudio || !Bun.file(join(sandbox, ".bunraku-scale-owner.json")).size)) {
  throw new Error("release mode requires a marked sandbox, --skip-seed, low-end profile, matrix output, all asset/import fixtures, and an isolated 1k complexity studio");
}
const studioDir = join(sandbox, "studio");
const homeDir = join(sandbox, "home");
const localAppData = join(sandbox, "local-app-data");
const chromeProfile = join(sandbox, "chrome-profile");
for (const d of [studioDir, homeDir, localAppData, chromeProfile]) mkdirSync(d, { recursive: true });

// Resolve Chrome's real path BEFORE LOCALAPPDATA is redirected below: playwright-core's own
// browser cache lives under the real LOCALAPPDATA, and `executablePath()` reads that env var, not
// a value baked in at install time. Resolving it after the redirect below made this look for Chrome
// inside the throwaway sandbox and fail (observed 2026-09-29).
const { chromium } = await import("playwright-core");
const CHROME = chromePath ?? process.env["CHROME_PATH"] ?? chromium.executablePath();
if (!CHROME.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(CHROME)) throw new Error("resolved Chrome executable path must be absolute");

// Redirect every per-user location this run could touch, before any module that reads them loads
// (scripts/test-sandbox.ts documents the same list). This process never writes to the real home.
process.env["BUNRAKU_HOME"] = homeDir;
process.env["LOCALAPPDATA"] = localAppData;
process.env["CODEX_HOME"] = join(sandbox, "codex");
process.env["CLAUDE_CONFIG_DIR"] = join(sandbox, "claude");
process.env["XDG_STATE_HOME"] = join(sandbox, "xdg-state");

console.log(`perf-browser: sandbox ${sandbox}`);
console.log(`perf-browser: studio  ${studioDir}`);
console.log(`perf-browser: BUNRAKU_HOME redirected to ${homeDir}`);

// ---- 1. Seed a realistic library: 300 character pieces (1-3 MB bodies) and one 4,000-message
// scene carrying a ~20 MB snapshot. Through the real composition root (library-root.ts) and the
// real device vault, so the server started in step 2 can open the same library the normal way
// (device-lock, no password) instead of a fake keyring it could never unlock (freeze.ts's pattern).
async function seed(): Promise<void> {
  const { loadFormats } = await import("../src/core");
  const { openLibrary } = await import("../src/ui/library-root");
  const { libraryFor } = await import("../src/studio/library-content");
  const { SettingsStore } = await import("../src/studio/settings");
  const { FOUR_K_MESSAGE_COUNT, REALISTIC_CARD_COUNT, realisticCard, realisticSnapshotMedia, reply } = await import(
    "./perf-gate-data"
  );

  await loadFormats();
  const t0 = performance.now();
  const opened = await openLibrary(studioDir);
  const stores = libraryFor(studioDir);
  if (!stores) throw new Error("opened browser fixture library did not register its stores");
  const { content, chats } = stores;

  // A truly fresh studio lands on the first-run setup wizard (App.tsx: `if (!stored.setupComplete)`),
  // not the dock; nothing here is testing that wizard, so skip it the same way a real first run's
  // last step would, by writing the flag it sets (App.tsx / setup/wizard.tsx `onComplete`).
  await new SettingsStore(studioDir).update({ setupComplete: true });

  for (let i = 0; i < REALISTIC_CARD_COUNT; i++) await content.save(realisticCard(i));
  console.log(`perf-browser: seeded ${REALISTIC_CARD_COUNT} realistic pieces in ${(performance.now() - t0).toFixed(0)} ms`);

  // One chat only, deliberately: with one scene in the library the browser script's click on "the
  // first scene card" is unambiguous, and that one scene is the 4k-message, ~20 MB-snapshot case
  // the plan's target budgets ask for (section 4: "Open any scene ... under 250 ms (4k)").
  const t1 = performance.now();
  const frozenCard = { ...realisticCard(0), body: { ...realisticCard(0).body, media: realisticSnapshotMedia() } };
  const chat = await chats.createChat({
    title: "The Long Watch",
    cast: { character: { id: "realistic-card-0", version: 1 } },
    snapshot: { character: frozenCard as unknown as JsonObject },
  });
  for (let m = 0; m < FOUR_K_MESSAGE_COUNT; m++) {
    await chats.appendMessage(chat.activeBranchId, { role: m % 2 ? "assistant" : "user", content: reply });
  }
  console.log(`perf-browser: seeded a ${FOUR_K_MESSAGE_COUNT}-message scene in ${(performance.now() - t1).toFixed(0)} ms`);

  opened.close();
}
if (skipSeed) console.log("perf-browser: --skip-seed, using the studio the caller already seeded");
else await seed();

// ---- 2. Boot the real dev server on the seeded studio. Not the packaged exe: `build-desktop.ts`
// and `ui-bundle.ts` are not this file's to duplicate (AGENTS rule 7), so this is `src/cli.ts ui`,
// the same dev server `bun run dev` runs. That means every number below is a DEV-SERVER number,
// not a packaged-artifact one; R3/R9's prod-bake gap is real and unmeasured here.
function waitFor(pattern: RegExp, child: ChildProcess, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = "";
    const finish = (error?: Error, value?: string) => {
      clearTimeout(timer);
      child.stdout?.off("data", onData);
      child.off("error", onError);
      child.off("exit", onExit);
      if (error) reject(error);
      else resolve(value!);
    };
    const timer = setTimeout(() => finish(new Error(`timed out waiting for ${pattern}`)), timeoutMs);
    const onData = (chunk: Buffer) => {
      buf += chunk.toString();
      const m = pattern.exec(buf);
      if (m) finish(undefined, m[0]);
    };
    const onError = (error: Error) => finish(error);
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => finish(new Error(`child exited before ${pattern}: code=${code} signal=${signal}`));
    child.stdout?.on("data", onData);
    child.once("error", onError);
    child.once("exit", onExit);
  });
}

const probeOutput = join(sandbox, "server-probe.jsonl");
const probePhase = join(sandbox, "server-probe-phase.txt");
if (releaseEvidence) {
  writeFileSync(probeOutput, "", "utf8");
  writeFileSync(probePhase, "startup", "utf8");
}
const serverArgs = [
  ...(releaseEvidence ? ["--preload", "scripts/scale/server-probe.ts"] : []),
  "run", "src/cli.ts", "ui", String(port), studioDir,
];
const server = spawn(process.execPath, serverArgs, {
  cwd: REPO_ROOT,
  env: {
    ...process.env,
    ...(releaseEvidence ? {
      BUNRAKU_SCALE_PROBE_OUTPUT: join(sandbox, "server-probe.jsonl"),
      BUNRAKU_SCALE_PROBE_PHASE: join(sandbox, "server-probe-phase.txt"),
      BUNRAKU_SCALE_PROBE_READY: join(sandbox, "server-probe-ready"),
    } : {}),
  },
  stdio: ["ignore", "pipe", "inherit"],
  detached: process.platform !== "win32",
});
let serverUrl: string;
try {
  const line = await waitFor(/Bunraku\. is up: (\S+)/, server, 60_000);
  serverUrl = /Bunraku\. is up: (\S+)/.exec(line)![1]!;
  if (releaseEvidence) {
    const ready = join(sandbox, "server-probe-ready");
    const until = Date.now() + 5_000;
    while (!existsSync(ready) && Date.now() < until) await new Promise((resolve) => setTimeout(resolve, 50));
    if (!existsSync(ready) || Number(readFileSync(ready, "utf8")) !== server.pid) throw new Error("server sampler did not attach to the launched Bun process");
  }
} catch (e) {
  await stopTree(server);
  console.error(`perf-browser: dev server did not come up: ${(e as Error).message}`);
  throw e;
}
console.log(`perf-browser: dev server up at ${serverUrl} (pid ${server.pid})`);

let complexityServer: ChildProcess | undefined;
let complexityUrl = "";
if (releaseEvidence) {
  try {
    const net = await import("node:net");
    const complexityPort = await new Promise<number>((resolvePort, reject) => {
      const probe = net.createServer();
      probe.once("error", reject);
      probe.listen(0, "127.0.0.1", () => {
        const address = probe.address();
        if (!address || typeof address === "string") return reject(new Error("could not allocate complexity server port"));
        probe.close((error) => error ? reject(error) : resolvePort(address.port));
      });
    });
    complexityServer = spawn(process.execPath, ["run", "src/cli.ts", "ui", String(complexityPort), complexityStudio!], {
      cwd: REPO_ROOT, env: { ...process.env }, stdio: ["ignore", "pipe", "inherit"], detached: process.platform !== "win32",
    });
    const line = await waitFor(/Bunraku\. is up: (\S+)/, complexityServer, 60_000);
    complexityUrl = /Bunraku\. is up: (\S+)/.exec(line)![1]!;
  } catch (error) {
    if (complexityServer) await stopTree(complexityServer);
    await stopTree(server);
    throw new Error(`1k complexity server did not start: ${(error as Error).message}`);
  }
}

// ---- 3. Launch Chrome ourselves with a debugging port (connectOverCDP to a self-launched process
// hangs the same way `chromium.launch` does under Bun; both work fine once the driver below runs
// under node). Only this PID (and its tree, on Windows) is ever killed, never anything found by
// process name.
const chromeArgs = [
  "--headless=new", `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${chromeProfile}`, "--no-first-run", "--no-default-browser-check",
  ...(releaseEvidence ? ["--js-flags=--max-old-space-size=512", "--enable-precise-memory-info"] : []),
];
const chrome = spawn(
  CHROME,
  chromeArgs,
  { stdio: "ignore", detached: process.platform !== "win32" },
);
let chromeLaunchError: Error | undefined;
chrome.once("error", (error) => { chromeLaunchError = error; });
async function waitForCdp(timeoutMs: number, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (chromeLaunchError) throw chromeLaunchError;
    if (child.exitCode !== null) throw new Error(`Chrome exited during startup (${child.exitCode})`);
    try {
      const r = await fetch(`http://127.0.0.1:${cdpPort}/json/version`, { signal: AbortSignal.timeout(500) });
      if (r.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Chrome's CDP endpoint never answered");
}
try {
  await waitForCdp(15_000, chrome);
} catch (e) {
  await stopTree(chrome);
  if (complexityServer) await stopTree(complexityServer);
  await stopTree(server);
  console.error(`perf-browser: ${(e as Error).message}`);
  throw e;
}
console.log(`perf-browser: Chrome up on CDP port ${cdpPort} (pid ${chrome.pid})`);

// ---- 4. Drive it. The generated driver is data this run produces, not a file this change owns, so
// it is written into the sandbox, run once, and left there for inspection.
const outFile = matrixOutput ?? join(sandbox, "perf-browser-result.json");
const driverFile = join(sandbox, "perf-browser-driver.cjs");
writeFileSync(driverFile, driverScript(REPO_ROOT), "utf8");
const nodePath = Bun.which("node");
if (!nodePath) {
  await stopTree(chrome);
  if (complexityServer) await stopTree(complexityServer);
  await stopTree(server);
  console.error("perf-browser: no `node` on PATH; playwright-core's CDP transport needs it (bun's hangs).");
  throw new Error("no node executable found for the CDP driver");
}
const nodeRun = spawn(nodePath, [driverFile, serverUrl, `http://127.0.0.1:${cdpPort}`, outFile, String(server.pid ?? 0), probeOutput, probePhase, String(chrome.pid ?? 0), String(releaseEvidence), studioDir, assetFile ?? "", fontFile ?? "", svgFile ?? "", backgroundFile ?? "", importFile ?? "", complexityUrl], {
  cwd: REPO_ROOT,
  stdio: "inherit",
  detached: process.platform !== "win32",
});
let driverExit = 1;
try {
  driverExit = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      void stopTree(nodeRun).then(() => reject(new Error("CDP driver exceeded its bounded deadline")), reject);
    }, releaseEvidence ? 15 * 60_000 : 5 * 60_000);
    nodeRun.once("error", (error) => { clearTimeout(timer); reject(error); });
    nodeRun.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (signal) reject(new Error(`CDP driver exited on ${signal}`));
      else resolve(code ?? 1);
    });
  });
} finally {
  await stopTree(chrome);
  if (complexityServer) await stopTree(complexityServer);
  await stopTree(server);
}

if (driverExit !== 0) {
  console.error("perf-browser: the browser driver failed; see its output above. No table to print.");
  if (releaseEvidence) process.exitCode = 1;
  else process.exit(0); // preserve the legacy informational entrypoint
}

const result = JSON.parse(await Bun.file(outFile).text()) as DriverResult;
printTable(result);

// ---- Types and the table printer ----

interface Row {
  action: string;
  value: string;
  note?: string;
}
interface DriverResult {
  rows: Row[];
  metrics?: Record<string, { value: number; unit: string; samples?: number; method?: string }>;
  missing?: string[];
  failures?: string[];
}

function printTable(r: DriverResult): void {
  console.log("\nperf-browser: section 4-shaped table (dev server, sandbox library, one run, ±20%)\n");
  const width = Math.max(...r.rows.map((row) => row.action.length));
  for (const row of r.rows) {
    const note = row.note ? `  (${row.note})` : "";
    console.log(`${row.action.padEnd(width)}  ${row.value}${note}`);
  }
}

