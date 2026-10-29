/** Opt-in S21 low-end scale run. Release mode writes strict numeric evidence and fails on every missing row. */
import { createReadStream, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir, totalmem } from "node:os";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { execFileSync, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { assess, BUDGETS, PROFILE, type Evidence, type Metric } from "./matrix-contract";
import { seedScale } from "./seed";
import { toErrorMessage } from "../../src/error-message";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..", "..");
const argv = process.argv.slice(2);
const value = (name: string) => {
  const at = argv.indexOf(`--${name}`);
  if (at < 0) return undefined;
  if (!argv[at + 1] || argv[at + 1]!.startsWith("--")) throw new Error(`--${name} needs a value`);
  return argv[at + 1];
};
const release = argv.includes("--release-evidence");
const profile = value("profile") ?? (release ? PROFILE : "informational");
const nText = value("n");
const n = nText === undefined ? (release ? 10_000 : 300) : Number(nText);
if (!Number.isSafeInteger(n) || n < 1 || n > 10_000) throw new Error("--n must be a safe integer from 1 through 10000");
if (release && (profile !== PROFILE || n !== 10_000)) throw new Error("release evidence requires --profile low-end and --n 10000");
if (profile !== PROFILE && profile !== "informational") throw new Error("supported profiles: informational, low-end");
const sandboxArg = value("sandbox");
const artifactArg = value("artifact");
if (artifactArg && !isAbsolute(artifactArg)) throw new Error("--artifact must be an absolute path");
if (release && !artifactArg) throw new Error("release evidence requires --artifact <absolute-output.json>");
const packagedCli = value("packaged-cli");
const packagedCliValid = !!packagedCli && isAbsolute(packagedCli) && existsSync(packagedCli) && lstatSync(packagedCli).isFile();
const packagedDesktop = value("packaged-desktop");
const packagedDesktopValid = !!packagedDesktop && isAbsolute(packagedDesktop) && existsSync(packagedDesktop) && lstatSync(packagedDesktop).isFile();
const originalLocalAppData = process.env["LOCALAPPDATA"];
const tempRoot = realpathSync(tmpdir());
const repository = realpathSync(ROOT);
const safeTempChild = (candidate: string): boolean => {
  const rel = relative(tempRoot, candidate);
  return rel !== "" && rel !== "." && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
};
if (sandboxArg && !isAbsolute(sandboxArg)) throw new Error("--sandbox must be an absolute path under the OS temporary directory");
const sandbox = sandboxArg ? resolve(sandboxArg) : join(tempRoot, `bunzai-scale-${randomUUID()}`);
if (!safeTempChild(sandbox)) throw new Error("sandbox must be a child of the OS temporary directory; repository and user libraries are refused");
const isDescendant = (parent: string, candidate: string): boolean => {
  const rel = relative(parent, candidate);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
};
if (sandbox === repository || isDescendant(sandbox, repository) || isDescendant(repository, sandbox)) throw new Error("sandbox cannot contain or be inside the repository");
const createdByRun = !sandboxArg;
if (existsSync(sandbox)) {
  const stat = lstatSync(sandbox);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("sandbox must be a real directory, not a symlink or file");
  if (readdirSync(sandbox).length) throw new Error("caller sandbox must be empty; existing libraries are never seeded");
} else mkdirSync(sandbox, { recursive: false });
const canonicalSandbox = realpathSync(sandbox);
if (canonicalSandbox !== sandbox) throw new Error("sandbox path resolves through a link and is refused");
if (artifactArg) {
  const artifactPath = resolve(artifactArg);
  const fromSandbox = relative(sandbox, artifactPath);
  if (fromSandbox === "" || (!fromSandbox.startsWith(`..${sep}`) && fromSandbox !== ".." && !isAbsolute(fromSandbox))) throw new Error("evidence artifact cannot be written inside the disposable sandbox that this run removes");
}
const marker = join(sandbox, ".bunzai-scale-owner.json");
const owner = randomUUID();
writeFileSync(marker, JSON.stringify({ owner, createdAt: new Date().toISOString() }), { flag: "wx" });

// Resolve the cached browser before LOCALAPPDATA redirects to the throwaway workspace.
let chrome = "";
let chromeVersion = "";
try {
  const { chromium } = await import("playwright-core");
  chrome = process.env["CHROME_PATH"] ?? chromium.executablePath();
  if (!isAbsolute(chrome)) throw new Error("resolved Chrome path must be absolute");
  const chromeVersionRun = spawnSync(chrome, ["--version"], { encoding: "utf8", timeout: 10_000, windowsHide: true });
  chromeVersion = chromeVersionRun.status === 0 ? chromeVersionRun.stdout.trim() : "";
} catch (error) {
  if (createdByRun) {
    const contents = JSON.parse(readFileSync(marker, "utf8")) as { owner?: string };
    if (contents.owner !== owner || realpathSync(sandbox) !== sandbox || !safeTempChild(sandbox)) throw new Error("temporary workspace ownership changed; refusing cleanup");
    rmSync(sandbox, { recursive: true, force: false });
  }
  throw error;
}

for (const [key, dir] of Object.entries({
  BUNZAI_HOME: join(sandbox, "home"),
  LOCALAPPDATA: join(sandbox, "local-app-data"),
  CODEX_HOME: join(sandbox, "codex"),
  CLAUDE_CONFIG_DIR: join(sandbox, "claude"),
  XDG_STATE_HOME: join(sandbox, "xdg-state"),
})) process.env[key] = dir;

const metrics: Record<string, Metric> = {};
const fixtureCounts: Record<string, number> = {};
const fixtureBytes: Record<string, number> = {};
const missing: string[] = [];
const failures: string[] = [];
let uiScreens: string[] = [];
let packagedEvidence: { name: string; sha256: string } | undefined;
let desktopEvidence: { name: string; sha256: string; validation: "identity-only" } | undefined;
async function measureDomComplexityPairs(): Promise<void> {
  const { libraryShelvesDomCount, presetBlockListDomCount, presetLiveBuildDomCount, presetLivePreviewDomCount } = await import("./dom-count");
  const { preset } = await import("./fixtures/preset");
  type Summary = import("../../src/ui/app-contract").StudioEntitySummary;
  const results: Record<string, [number, number]> = {};
  const bodies = [preset(300).body, preset(3_000).body];
  const counts = [300, 3_000];
  for (const [index, n] of counts.entries()) {
    const entities = Array.from({ length: n }, (_, i) => ({ id: `scale-character-${i}`, kind: "character", name: `Scale Character ${i}`, hasPortrait: false })) as Summary[];
    const body = bodies[index]!;
    results["library_shelves"] = [...(results["library_shelves"] ?? []), await libraryShelvesDomCount(entities)] as [number, number];
    results["preset_block_list"] = [...(results["preset_block_list"] ?? []), await presetBlockListDomCount(body.prompts)] as [number, number];
    results["preset_live_build"] = [...(results["preset_live_build"] ?? []), await presetLiveBuildDomCount(body)] as [number, number];
    results["preset_live_preview"] = [...(results["preset_live_preview"] ?? []), await presetLivePreviewDomCount(body)] as [number, number];
  }
  for (const [path, [small, big]] of Object.entries(results)) {
    metrics[`complexity.dom.${path}_n_300`] = { value: small, unit: "nodes", samples: 1, method: "Real Studio component mounted with 300 items using the existing JSDOM owner." };
    metrics[`complexity.dom.${path}_n_3000`] = { value: big, unit: "nodes", samples: 1, method: "Same real component and viewport mounted with 3,000 items." };
    if (!small) throw new Error(`complexity DOM baseline was zero for ${path}`);
    metrics[`complexity.dom.${path}_ratio_10x`] = { value: big / small, unit: "ratio", samples: 2, method: "Observed DOM-node count ratio at N=3000 divided by N=300." };
  }
}

async function measurePresetSaveComplexityPair(): Promise<void> {
  const { openLibrary } = await import("../../src/ui/library-root");
  const { libraryFor } = await import("../../src/studio/library-content");
  const { preset } = await import("./fixtures/preset");
  const growth: number[] = [];
  for (const blocks of [300, 3_000]) {
    const dir = join(sandbox, `complexity-preset-${blocks}`);
    mkdirSync(dir);
      const library = await openLibrary(dir);
      try {
        const stores = libraryFor(dir);
        if (!stores) throw new Error("opened complexity library did not register its stores");
        const { content } = stores;
      const original = preset(blocks, 1, `complexity-preset-${blocks}`);
      await content.save(original);
      await library.database.scrub();
      const before = statSync(join(dir, "library.db")).size;
      const first = original.body.prompts[0]!;
      await content.save({ ...original, body: { ...original.body, prompts: [{ ...first, content: first.content + " edited" }, ...original.body.prompts.slice(1)] } }, { overwrite: true });
      await library.database.scrub();
      const bytes = statSync(join(dir, "library.db")).size - before;
      growth.push(bytes);
      metrics[`complexity.preset_save_growth_n_${blocks}`] = { value: bytes, unit: "bytes", samples: 1, method: `Real whole-entity ContentStore edit/save at N=${blocks} preset blocks, with database scrub before and after file-size capture.` };
    } finally { library.close(); }
  }
  if (growth[0] === 0) throw new Error("preset save complexity baseline had zero database growth");
  metrics["complexity.preset_save_growth_ratio_10x"] = { value: growth[1]! / growth[0]!, unit: "ratio", samples: 2, method: "Observed whole-entity save file-growth ratio at 3,000 versus 300 blocks." };
}

async function freePort(): Promise<number> {
  const net = await import("node:net");
  return await new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("could not allocate loopback port"));
      server.close((error) => error ? reject(error) : resolvePort(address.port));
    });
  });
}

async function probePackagedCli(studio: string): Promise<void> {
  const port = await freePort();
  const child = spawn(packagedCli!, ["ui", String(port), studio], {
    cwd: ROOT, windowsHide: true, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "inherit"],
    env: { ...process.env },
  });
  const start = performance.now();
  let output = "";
  const ready = new Promise<string>((resolveReady, rejectReady) => {
    const timer = setTimeout(() => rejectReady(new Error("compiled CLI did not announce readiness within 60 seconds")), 60_000);
    child.stdout?.on("data", (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-16_384);
      const match = /Bunzai\. is up: (\S+)/.exec(output);
      if (match) { clearTimeout(timer); resolveReady(match[1]!); }
    });
    child.once("error", (error) => { clearTimeout(timer); rejectReady(error); });
    child.once("exit", (code, signal) => { clearTimeout(timer); rejectReady(new Error(`compiled CLI exited before readiness: code=${code} signal=${signal}`)); });
  });
  try {
    const url = await ready;
    const html = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const body = await html.text();
    if (!html.ok || !body.includes('name="vaude-session"')) throw new Error(`compiled CLI returned no authenticated Studio shell (HTTP ${html.status})`);
    metrics["packaged.cli_start_ms"] = { value: performance.now() - start, unit: "ms", samples: 1, method: "Elapsed from spawned compiled CLI to a successful authenticated Studio HTML shell response; not desktop packaging validation." };
    metrics["packaged.ui_shell_bytes"] = { value: Buffer.byteLength(body), unit: "bytes", samples: 1, method: "UTF-8 byte length of the first compiled-CLI Studio HTML shell response." };
    const digest = await new Promise<string>((resolveDigest, rejectDigest) => {
      const hash = createHash("sha256");
      const stream = createReadStream(packagedCli!);
      stream.on("data", (chunk) => hash.update(chunk));
      stream.once("error", rejectDigest);
      stream.once("end", () => resolveDigest(hash.digest("hex")));
    });
    fixtureCounts["packaged.cli_artifact"] = 1;
    fixtureBytes["packaged.cli_executable"] = statSync(packagedCli!).size;
    packagedEvidence = { name: basename(packagedCli!), sha256: digest };
  } finally { await killOwnedTree(child); }
}

async function measureUiSavedHistory(studio: string): Promise<void> {
  const { openLibrary } = await import("../../src/ui/library-root");
  const { libraryFor } = await import("../../src/studio/library-content");
  const library = await openLibrary(studio);
  try {
    const stores = libraryFor(studio);
    if (!stores) throw new Error("opened history library did not register its stores");
    const { content } = stores;
    const targets = [
      ["character", "scale-character-0"], ["lorebook", "scale-lorebook"], ["persona", "scale-persona-0"],
      ["pack", "scale-pack"], ["regex", "scale-regex"], ["preset", "scale-preset-1k"],
      ["htmldoc", "scale-htmldoc-0"], ["quickreply", "scale-quickreply"],
    ] as const;
    let totalVersions = 0;
    const restores: number[] = [];
    for (const [kind, id] of targets) {
      const history = await content.versions(kind, id);
      if (history.quarantined.length || history.versions.length < 2) throw new Error(`${kind}/${id} has no healthy UI-saved historical version`);
      totalVersions += history.versions.length;
      const startedAt = performance.now();
      if (!(await content.restoreVersion(kind, id, 1))) throw new Error(`${kind}/${id} historical version restore refused`);
      restores.push(performance.now() - startedAt);
    }
    metrics["history.per_kind_version_count"] = { value: totalVersions, unit: "versions", samples: targets.length, method: "Historical versions observed after public Workbench edits for each Studio entity kind." };
    metrics["restore.per_kind_count"] = { value: restores.length, unit: "kinds", samples: restores.length, method: "ContentStore.restoreVersion version 1 after each kind's public Workbench edit/save; the public UI does not expose a persisted version picker." };
    metrics["restore.per_kind_mean_ms"] = { value: restores.reduce((sum, value) => sum + value, 0) / restores.length, unit: "ms", samples: restores.length, method: "Mean source-store restore latency for the eight UI-edited fixture kinds." };
  } finally { library.close(); }
}

async function identifyPackagedDesktop(): Promise<void> {
  if (!packagedDesktopValid) throw new Error("a built desktop executable is required for release artifact identity");
  const sha256 = await new Promise<string>((resolveDigest, rejectDigest) => {
    const hash = createHash("sha256");
    const stream = createReadStream(packagedDesktop!);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("error", rejectDigest);
    stream.once("end", () => resolveDigest(hash.digest("hex")));
  });
  desktopEvidence = { name: basename(packagedDesktop!), sha256, validation: "identity-only" };
  fixtureCounts["packaged.desktop_artifact"] = 1;
  fixtureBytes["packaged.desktop_executable"] = statSync(packagedDesktop!).size;
}

async function killOwnedTree(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  const settle = (ms: number): Promise<boolean> => new Promise((resolveSettle) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolveSettle(true);
    const timer = setTimeout(() => resolveSettle(false), ms);
    child.once("exit", () => { clearTimeout(timer); resolveSettle(true); });
  });
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    const killed = await Promise.race([new Promise<boolean>((resolveKilled) => killer.once("exit", () => resolveKilled(true))), new Promise<boolean>((resolveWait) => setTimeout(() => resolveWait(false), 3_000))]);
    if (!killed) { killer.kill(); throw new Error(`taskkill timed out for owned process ${child.pid}`); }
  } else {
    try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
    if (!(await settle(5_000))) {
      try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
      if (!(await settle(3_000))) throw new Error(`owned process tree ${child.pid} did not exit after SIGKILL`);
    }
  }
}

function runBrowser(out?: string): Promise<number> {
  return new Promise((resolveCode, reject) => {
    let child: ChildProcess;
    void (async () => {
      const port = await freePort();
      let cdp = await freePort();
      while (cdp === port) cdp = await freePort();
      const command = ["run", "scripts/perf-browser.ts", "--sandbox", sandbox, "--skip-seed",
        "--port", String(port), "--cdp-port", String(cdp), "--chrome-path", chrome,
          ...(release ? ["--release-evidence", "--profile", PROFILE, "--matrix-output", out!, "--asset-file", join(sandbox, "matrix-served-portrait.png"), "--font-file", join(sandbox, "matrix-font.ttf"), "--svg-file", join(sandbox, "matrix-vector.svg"), "--background-file", join(sandbox, "matrix-background.png"), "--import-file", join(sandbox, "matrix-large-preset.json"), "--complexity-studio", join(sandbox, "complexity-1k")] : [])];
      child = spawn(process.execPath, command, {
        cwd: ROOT, stdio: "inherit", windowsHide: true, detached: process.platform !== "win32",
        env: { ...process.env, ...(originalLocalAppData === undefined ? {} : { LOCALAPPDATA: originalLocalAppData }) },
      });
      let timedOut = false;
      const deadline = setTimeout(() => {
        timedOut = true;
        void killOwnedTree(child).catch((error) => reject(new Error(`browser matrix timeout cleanup failed: ${String(error)}`)));
      }, 20 * 60_000);
      child.once("error", (error) => { clearTimeout(deadline); reject(error); });
      child.once("exit", (code, signal) => {
        clearTimeout(deadline);
        if (timedOut) reject(new Error("browser matrix exceeded its 20 minute deadline; only this run's process tree was terminated"));
        else if (signal) reject(new Error(`browser matrix exited on ${signal}`));
        else resolveCode(code ?? 1);
      });
    })().catch(reject);
  });
}

let success = false;
let dbPath: string | undefined;
let sourceRoot = ROOT;
let sourceRevision = "unknown";
let sourceDigest = "";
let sourceDirty = true;
const output = artifactArg ? resolve(artifactArg) : join(sandbox, "scale-evidence.json");
try {
  sourceRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: ROOT, encoding: "utf8" }).trim();
  sourceRevision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: sourceRoot, encoding: "utf8" }).trim();
  // A release workflow may check out a selected tag/ref whose commit differs from the event SHA.
  // HEAD is the measured identity; only an explicit SOURCE_REVISION is a consistency assertion.
  const requestedRevision = process.env["SOURCE_REVISION"];
  if (requestedRevision && requestedRevision !== sourceRevision) throw new Error(`checkout HEAD ${sourceRevision} does not match requested source identity ${requestedRevision}`);
  const sourceStatus = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: sourceRoot, encoding: "utf8" }).trim();
    const sourceDiff = execFileSync("git", ["diff", "--binary", "HEAD", "--", "scripts/scale", "scripts/perf-browser.ts", "package.json", ".github/workflows/ci.yml", ".github/workflows/release.yml"], { cwd: sourceRoot, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  sourceDirty = sourceStatus.length > 0;
  sourceDigest = createHash("sha256").update(`${sourceRevision}\n${sourceStatus}\n${sourceDiff}`).digest("hex");
  const started = performance.now();
    const seeded = await seedScale({ sandbox, release, n, metrics, fixtureCounts, fixtureBytes });
    dbPath = seeded.dbPath;
    fixtureCounts["library.entities"] = n;
    if (release) {
      try { await measureDomComplexityPairs(); }
      catch (error) {
        for (const path of ["library_shelves", "preset_block_list", "preset_live_build", "preset_live_preview"]) {
          missing.push(`complexity.dom.${path}_n_300`, `complexity.dom.${path}_n_3000`, `complexity.dom.${path}_ratio_10x`);
        }
        failures.push(`N/10N real component DOM comparison failed: ${String(error)}`);
      }
      try { await measurePresetSaveComplexityPair(); }
      catch (error) { missing.push("complexity.preset_save_growth_n_300", "complexity.preset_save_growth_n_3000", "complexity.preset_save_growth_ratio_10x"); failures.push(`N/10N preset edit/save comparison failed: ${String(error)}`); }
    }
  const browserOutput = release ? join(sandbox, "browser-matrix.json") : undefined;
  let browserCode = 1;
  try { browserCode = await runBrowser(browserOutput); }
  catch (error) { if (!release) throw error; failures.push(`browser matrix launch/cleanup failed: ${String(error)}`); }
  if (!release) {
    if (browserCode !== 0) throw new Error(`informational browser process exited ${browserCode}`);
    success = true;
    console.log(`scale:timed informational run finished in ${((performance.now() - started) / 1000).toFixed(1)} s`);
  } else {
    if (browserCode !== 0) failures.push(`browser matrix process exited ${browserCode}`);
    if (existsSync(browserOutput!)) {
      const observed = JSON.parse(readFileSync(browserOutput!, "utf8")) as { metrics?: Record<string, Metric>; missing?: string[]; failures?: string[]; coverage?: { uiScreens?: string[] } };
      Object.assign(metrics, observed.metrics ?? {});
      missing.push(...(observed.missing ?? []));
      failures.push(...(observed.failures ?? []));
      uiScreens = observed.coverage?.uiScreens ?? [];
      fixtureCounts["coverage.ui_screens"] = observed.coverage?.uiScreens?.length ?? 0;
    } else failures.push("browser matrix did not produce its result envelope");
    try { await measureUiSavedHistory(seeded.studio); }
    catch (error) { missing.push("history.per_kind_version_count", "restore.per_kind_count", "restore.per_kind_mean_ms"); failures.push(`per-kind stored history/restore after UI edits failed: ${String(error)}`); }
    if (existsSync(dbPath)) fixtureBytes["library.database_bytes_after_seed"] = statSync(dbPath).size;
    if (!packagedCliValid) missing.push("packaged.cli_artifact");
    else {
      try { await probePackagedCli(seeded.studio); }
      catch (error) { failures.push(`compiled CLI proof failed: ${String(error)}`); }
    }
    if (!packagedDesktopValid) missing.push("packaged.desktop_artifact");
    else {
      try { await identifyPackagedDesktop(); }
      catch (error) { failures.push(`desktop executable identity failed: ${String(error)}`); }
    }
    if (!chromeVersion) missing.push("exact browser version");
    const assessment = assess(metrics);
    missing.push(...assessment.missing);
    failures.push(...assessment.failures);
    const evidence: Evidence = {
      schemaVersion: 1,
      status: missing.length || failures.length ? "fail" : "pass",
      scope: packagedEvidence ? "dev-server+compiled-cli-launch" : "dev-server",
      packagedProof: packagedEvidence ? "compiled-cli-launch" : (packagedCliValid ? "failed" : "not-run"),
      packaged: packagedEvidence ? { fileName: packagedEvidence.name, sha256: packagedEvidence.sha256 } : null,
      desktopArtifact: desktopEvidence ?? null,
      sourceRevision,
      sourceDigest,
      sourceDirty,
      capturedAt: new Date().toISOString(),
      runtime: {
        bun: Bun.version, browser: `${chromeVersion} (${chrome})`, platform: `${process.platform}-${process.arch}`, profile,
        cpuCount: availableParallelism(), ramBytes: totalmem(), cpuThrottle: 4, heapLimitMB: 512,
        ciRunner: process.env["GITHUB_ACTIONS"] === "true",
      },
      fixtures: { counts: fixtureCounts, bytes: fixtureBytes },
      metrics,
      coverage: { uiScreens, unavailablePaths: [...new Set(missing)] },
      budgets: BUDGETS,
      missing: [...new Set(missing)],
      failures: [...new Set(failures)],
    };
    mkdirSync(resolve(output, ".."), { recursive: true });
    writeFileSync(output, JSON.stringify(evidence, null, 2));
    console.log(`scale:timed ${profile} finished in ${((performance.now() - started) / 1000).toFixed(1)} s; evidence ${output}`);
    if (evidence.status === "fail") {
      console.error(`scale:timed RELEASE EVIDENCE FAIL: ${evidence.missing.length} missing rows, ${evidence.failures.length} failures`);
      process.exitCode = 1;
    } else success = true;
  }
} catch (error) {
  failures.push(toErrorMessage(error));
  console.error("scale:timed failed before complete evidence:", error);
  if (release) {
    const assessment = assess(metrics);
    const evidence: Evidence = {
      schemaVersion: 1, status: "fail", scope: packagedEvidence ? "dev-server+compiled-cli-launch" : "dev-server", packagedProof: packagedEvidence ? "compiled-cli-launch" : (packagedCliValid ? "failed" : "not-run"), packaged: packagedEvidence ? { fileName: packagedEvidence.name, sha256: packagedEvidence.sha256 } : null, desktopArtifact: desktopEvidence ?? null, sourceRevision, sourceDigest, sourceDirty,
      capturedAt: new Date().toISOString(),
      runtime: { bun: Bun.version, browser: chromeVersion ? `${chromeVersion} (${chrome})` : "unavailable", platform: `${process.platform}-${process.arch}`, profile,
        cpuCount: availableParallelism(), ramBytes: totalmem(), cpuThrottle: 4, heapLimitMB: 512, ciRunner: process.env["GITHUB_ACTIONS"] === "true" },
      fixtures: { counts: fixtureCounts, bytes: fixtureBytes }, metrics, coverage: { uiScreens, unavailablePaths: [...new Set([...missing, ...assessment.missing])] }, budgets: BUDGETS,
      missing: [...new Set([...missing, ...assessment.missing])], failures: [...new Set([...failures, ...assessment.failures])],
    };
    try {
      mkdirSync(resolve(output, ".."), { recursive: true });
      writeFileSync(output, JSON.stringify(evidence, null, 2));
    } catch (artifactError) { console.error("could not persist failure evidence:", artifactError); }
  }
  process.exitCode = 1;
} finally {
  if (createdByRun) {
    const contents = JSON.parse(readFileSync(marker, "utf8")) as { owner?: string };
    if (contents.owner !== owner || realpathSync(sandbox) !== sandbox || !safeTempChild(sandbox)) throw new Error("temporary workspace ownership changed; refusing cleanup");
    rmSync(sandbox, { recursive: true, force: false });
  }
}
