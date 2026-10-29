/**
 * S0 streaming probe: peak memory of one import/export scenario at a time,
 * measured on a throwaway studio and BUNZAI_HOME. It starts its own server on a free port (never 8321),
 * samples that server's working set and heap every 25 ms (stream-probe-sampler.ts), and prints one JSON row
 * per phase. Run one scenario per invocation; nothing runs in parallel.
 *   bun scripts/scale/stream-probe.ts --sandbox <abs temp dir> --fixtures <dir> --scenario <name> [--port N]
 * Scenarios: open-pack-browser, press-pack-browser, import-pack, whole-read, open-pack, pack-download, import-chat, import-lvbak, press-export-character (--card png --target id), folder-export.
 * Fixtures come from stream-probe-fixtures.ts (pictures.zip, probe.lvbak) plus --chat <jsonl> for import-chat.
 * The tab side of "open a pack" is stream-probe-browser.ts.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..", "..");
const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const at = argv.indexOf(`--${name}`);
  return at < 0 ? undefined : argv[at + 1];
};
const sandbox = arg("sandbox") ?? "";
const fixtures = arg("fixtures") ?? "";
const scenario = arg("scenario") ?? "";
const port = Number(arg("port") ?? 18731);
if (!isAbsolute(sandbox)) throw new Error("--sandbox must be an absolute path");
const rel = relative(realpathSync(tmpdir()), resolve(sandbox));
if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) throw new Error("--sandbox must be a child of the OS temp directory");
if (port === 8321) throw new Error("port 8321 is the real studio; refused");
const studio = join(sandbox, "studio");
for (const dir of [studio, join(sandbox, "home"), join(sandbox, "samples"), join(sandbox, "out")]) mkdirSync(dir, { recursive: true });
const stateFile = join(sandbox, "state.json");
const state: Record<string, string> = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : {};
const saveState = (): void => writeFileSync(stateFile, JSON.stringify(state));

const sampleFile = join(sandbox, "samples", `${scenario}-${Date.now()}.jsonl`);
const env = {
  ...process.env,
  BUNZAI_HOME: join(sandbox, "home"),
  LOCALAPPDATA: join(sandbox, "local-app-data"),
  PROBE_OUT: sampleFile,
};
const preload = join(ROOT, "scripts", "scale", "stream-probe-sampler.ts");
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const mb = (n: number): number => Math.round(n / 1048576);

interface Sample { t: number; rss: number; heap: number; ext: number; ab: number }
const samples = (): Sample[] =>
  existsSync(sampleFile) ? readFileSync(sampleFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Sample) : [];

const rows: Record<string, unknown>[] = [];
/** The OS's own peak working set of the measured process so far; unlike the 25 ms sampler it cannot miss a spike. Only grows. */
function osPeakMb(): number | undefined {
  try {
    const pid = Number(readFileSync(`${sampleFile}.pid`, "utf8"));
    const out = Bun.spawnSync(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", `(Get-Process -Id ${pid}).PeakWorkingSet64`]).stdout.toString().trim();
    return out ? mb(Number(out)) : undefined;
  } catch { return undefined; }
}

async function phase<T>(name: string, run: () => Promise<T>, note = ""): Promise<T> {
  await sleep(700);
  const t0 = Date.now();
  const before = samples().filter((s) => s.t <= t0).at(-1);
  const result = await run();
  const t1 = Date.now();
  await sleep(2500);
  const all = samples();
  const inside = all.filter((s) => s.t >= t0 && s.t <= t1 + 300);
  const peak = (key: keyof Sample): number => Math.max(...inside.map((s) => s[key]), 0);
  const after = all.filter((s) => s.t <= t1 + 2500).at(-1);
  rows.push({
    scenario, phase: name, ms: t1 - t0,
    baselineRssMb: mb(before?.rss ?? 0), peakRssMb: mb(peak("rss")), deltaRssMb: mb(peak("rss") - (before?.rss ?? 0)),
    peakHeapMb: mb(peak("heap")), peakExternalMb: mb(peak("ext")), peakArrayBuffersMb: mb(peak("ab")),
    retainedRssMb: mb(after?.rss ?? 0), osPeakSoFarMb: osPeakMb(), note,
  });
  return result;
}

let child: ReturnType<typeof Bun.spawn> | undefined;
let base = "";
let token = "";
async function startServer(): Promise<void> {
  const log = join(sandbox, "out", `${scenario}-server.log`);
  writeFileSync(log, "");
  child = Bun.spawn([process.execPath, "--preload", preload, "src/cli.ts", "ui", String(port), studio], {
    cwd: ROOT, env, stdout: Bun.file(log), stderr: Bun.file(join(sandbox, "out", `${scenario}-server.err`)),
  });
  for (let i = 0; i < 80; i++) {
    await sleep(500);
    // The server hunts for a free port when its own is busy; follow the port this process itself reports, never assume ours.
    const up = /is up: http:\/\/127\.0\.0\.1:(\d+)/.exec(readFileSync(log, "utf8"));
    if (!up) continue;
    base = `http://127.0.0.1:${up[1]}`;
    try {
      const m = /name="vaude-session" content="([^"]+)"/.exec(await (await fetch(`${base}/`)).text());
      if (m) { token = m[1]!; await sleep(3000); return; }
    } catch { /* not answering yet */ }
  }
  throw new Error("server did not start");
}

const headers = (extra: Record<string, string> = {}): Record<string, string> => ({ origin: base, "x-bunzai-token": token, ...extra });
const post = (path: string, body: BodyInit, extra: Record<string, string> = {}): Promise<Response> =>
  fetch(`${base}${path}`, { method: "POST", headers: headers(extra), body });
const postJson = (path: string, value: unknown): Promise<Response> => post(path, JSON.stringify(value), { "content-type": "application/json" });
type Json = Record<string, any>;
async function upload(path: string, file: string, filename: string): Promise<Json> {
  const res = await post(path, Bun.file(file), { "content-type": "application/octet-stream", "x-filename": encodeURIComponent(filename) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as Json;
}
async function save(inspected: Json): Promise<Json> {
  const res = inspected["staged"]
    ? await postJson("/api/studio/save-staged", inspected["staged"])
    : await postJson("/api/studio/save-bundle", { entity: inspected["entity"], related: inspected["related"] });
  const body = (await res.json()) as Json;
  if (!res.ok) throw new Error(`save ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}
const packId = (): string => {
  if (!state["packId"]) throw new Error("run import-pack first");
  return state["packId"];
};

async function main(): Promise<void> {
  if (scenario === "folder-export") {
    const dest = join(sandbox, "folder-export-out");
    const proc = Bun.spawn([process.execPath, "--preload", preload, "src/cli.ts", "export", dest, studio], { cwd: ROOT, env, stdout: "pipe", stderr: "pipe" });
    await phase("export library to folder (CLI process)", async () => {
      const [out, err] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
      await proc.exited;
      if (proc.exitCode !== 0) throw new Error(`export exit ${proc.exitCode}: ${err.slice(0, 300)} ${out.slice(0, 300)}`);
    });
    rows.push({ scenario, phase: "OS max RSS of the CLI process (resourceUsage)", osPeakSoFarMb: mb(proc.resourceUsage()?.maxRSS ?? 0) });
    return;
  }
  await startServer();
  try {
    if (scenario === "import-pack") {
      const inspected = await phase("inspect (zip body -> entity or staged)", () => upload("/api/inspect", join(fixtures, "pictures.zip"), "pictures.zip"));
      const saved = await phase("save (save-bundle or save-staged)", () => save(inspected), inspected["staged"] ? "staged path" : "inline entity path");
      state["packId"] = saved["primary"]?.id ?? inspected["entityId"];
      saveState();
    } else if (scenario === "whole-read") {
      await phase("GET /api/studio/get (whole piece)", async () => (await (await fetch(`${base}/api/studio/get?kind=pack&id=${encodeURIComponent(packId())}`)).arrayBuffer()).byteLength);
    } else if (scenario === "open-pack") {
      const q = `kind=pack&id=${encodeURIComponent(packId())}`;
      await phase("list + summary", async () => { await (await fetch(`${base}/api/studio/list?kind=pack`)).text(); await (await fetch(`${base}/api/studio/summary?${q}`)).text(); });
      const light = await phase("light read", async () => (await fetch(`${base}/api/studio/get?${q}&light=1`)).text());
      const shas = [...new Set(light.match(/[a-f0-9]{64}/g) ?? [])];
      const sizes = async (size: string): Promise<number> => {
        let total = 0;
        for (const sha of shas) total += (await (await fetch(`${base}/api/asset/${sha}?size=${size}`)).arrayBuffer()).byteLength;
        return total;
      };
      await phase(`thumbnails size=256 cold (${shas.length})`, () => sizes("256"));
      await phase(`thumbnails size=256 warm (${shas.length})`, () => sizes("256"));
      await phase(`full pictures one by one (${shas.length})`, () => sizes("full"));
    } else if (scenario === "open-pack-browser" || scenario === "press-pack-browser") {
      const mode = scenario === "open-pack-browser" ? "open" : "press";
      await phase(`browser ${mode} (server side; tab numbers in the child rows)`, async () => {
        const child2 = Bun.spawn([process.execPath, "scripts/scale/stream-probe-browser.ts", sandbox, base, mode], { cwd: ROOT, env, stdout: "pipe", stderr: "pipe" });
        const [out, err] = await Promise.all([new Response(child2.stdout).text(), new Response(child2.stderr).text()]);
        await child2.exited;
        for (const line of out.split("\n").filter(Boolean)) { console.log(`TAB ${line}`); appendFileSync(join(sandbox, "results.jsonl"), `TAB ${scenario} ${line}\n`); }
        if (child2.exitCode !== 0) throw new Error(`browser probe failed: ${err.slice(0, 600)}`);
      });
    } else if (scenario === "press-export-character") {
      const inspected = await phase("inspect (card png)", () => upload("/api/inspect", arg("card") ?? "", "card.png"));
      const saved = await phase("save", () => save(inspected), inspected["staged"] ? "staged" : "inline");
      const id = String(saved["primary"]?.id ?? inspected["entityId"]);
      const entity = await phase("whole read (Press fetch of the entity)", async () => (await (await fetch(`${base}/api/studio/get?kind=character&id=${encodeURIComponent(id)}`)).text()));
      await phase("export POST (entity JSON up, base64 JSON down)", async () => { const r = await postJson("/api/export", { entity: JSON.parse(entity), targetId: arg("target") ?? "sillytavern" }); const t = await r.text(); if (!r.ok) throw new Error(`export ${r.status}: ${t.slice(0, 200)}`); return t.length; });
    } else if (scenario === "pack-download") {
      await phase("GET export-pack drained (arrayBuffer)", async () => (await (await fetch(`${base}/api/studio/export-pack?id=${encodeURIComponent(packId())}`)).arrayBuffer()).byteLength);
    } else if (scenario === "import-chat") {
      // The chat needs its character in the library first; a tiny card made from the log's own header line.
      const header = JSON.parse(readFileSync(arg("chat") ?? "").toString("utf8", 0, 65536).split("\n", 1)[0]!) as { character_name?: string };
      const name = header.character_name ?? "Probe";
      const tiny = JSON.stringify({ spec: "chara_card_v2", spec_version: "2.0", data: { name, description: "probe", personality: "", scenario: "", first_mes: "hi", mes_example: "", creator_notes: "", system_prompt: "", post_history_instructions: "", alternate_greetings: [], tags: [], creator: "", character_version: "1", extensions: {} } });
      const card = await post("/api/inspect", tiny, { "content-type": "application/octet-stream", "x-filename": "card.json" });
      await save((await card.json()) as Json);
      const inspected = await phase("inspect (jsonl)", () => upload("/api/inspect", arg("chat") ?? "", "chat.jsonl"));
      await phase("save", () => save(inspected), inspected["staged"] ? "staged" : "inline");
    } else if (scenario === "import-lvbak") {
      const res = await phase("inspect-archive (upload + parse + stage)", () => upload("/api/inspect-archive", join(fixtures, "probe.lvbak"), "probe.lvbak"));
      const staged = (res["rows"] as Json[] | undefined)?.filter((r) => r["staged"]) ?? [];
      await phase(`save-staged x${staged.length}`, async () => { for (const row of staged) await save(row); });
    } else throw new Error(`unknown scenario ${scenario}`);
  } finally {
    child?.kill();
  }
}

try {
  await main();
} finally {
  for (const row of rows) {
    console.log(JSON.stringify(row));
    appendFileSync(join(sandbox, "results.jsonl"), `${JSON.stringify(row)}\n`);
  }
}
