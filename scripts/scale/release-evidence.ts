/** Enforces a fresh, source-matched S21 artifact before a release accepts UI or storage evidence. */
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, isAbsolute, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { assess, BUDGETS, PROFILE, type Evidence } from "./matrix-contract";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const path = args.find((arg) => !arg.startsWith("--"));
const packagedAt = args.indexOf("--packaged-cli");
const packagedCli = packagedAt >= 0 ? args[packagedAt + 1] : undefined;
const desktopAt = args.indexOf("--packaged-desktop");
const packagedDesktop = desktopAt >= 0 ? args[desktopAt + 1] : undefined;
if (!path || !isAbsolute(path) || !packagedCli || !isAbsolute(packagedCli) || !packagedDesktop || !isAbsolute(packagedDesktop)) throw new Error("usage: bun run scale:release-evidence -- <absolute-artifact.json> --packaged-cli <absolute-compiled-cli> --packaged-desktop <absolute-desktop-executable>");
const errors: string[] = [];
let evidence: Evidence | undefined;
try {
  evidence = JSON.parse(await readFile(resolve(path), "utf8")) as Evidence;
} catch (error) {
  errors.push(`missing or unreadable artifact: ${String(error)}`);
}
if (evidence) {
  if (evidence.schemaVersion !== 1) errors.push("unsupported artifact schema");
  if (evidence.scope !== "dev-server+compiled-cli-launch") errors.push("release evidence requires dev-server rows plus a separately launched compiled CLI");
  if (evidence.packagedProof !== "compiled-cli-launch") errors.push("compiled CLI launch proof is missing or failed");
  if (!evidence.packaged || !/^[a-f0-9]{64}$/.test(evidence.packaged.sha256) || !evidence.packaged.fileName) errors.push("compiled CLI artifact identity is missing or invalid");
  if (evidence.packaged) {
    if (basename(packagedCli) !== evidence.packaged.fileName) errors.push("compiled CLI filename differs from the measured artifact");
    try {
      const currentCliHash = await new Promise<string>((resolveHash, rejectHash) => {
        const hash = createHash("sha256");
        const stream = createReadStream(packagedCli);
        stream.on("data", (chunk) => hash.update(chunk));
        stream.once("error", rejectHash);
        stream.once("end", () => resolveHash(hash.digest("hex")));
      });
      if (currentCliHash !== evidence.packaged.sha256) errors.push("compiled CLI bytes differ from the artifact measured by S21");
    } catch (error) { errors.push(`compiled CLI is missing or unreadable: ${String(error)}`); }
  }
  if (!evidence.desktopArtifact || evidence.desktopArtifact.validation !== "identity-only" || !/^[a-f0-9]{64}$/.test(evidence.desktopArtifact.sha256) || !evidence.desktopArtifact.fileName) {
    errors.push("desktop executable identity is missing or invalid; desktop runtime behavior is not proven by this harness");
  } else {
    if (basename(packagedDesktop) !== evidence.desktopArtifact.fileName) errors.push("desktop executable filename differs from the artifact identity");
    try {
      const currentDesktopHash = await new Promise<string>((resolveHash, rejectHash) => {
        const hash = createHash("sha256");
        const stream = createReadStream(packagedDesktop);
        stream.on("data", (chunk) => hash.update(chunk));
        stream.once("error", rejectHash);
        stream.once("end", () => resolveHash(hash.digest("hex")));
      });
      if (currentDesktopHash !== evidence.desktopArtifact.sha256) errors.push("desktop executable bytes differ from the identity recorded by S21");
    } catch (error) { errors.push(`desktop executable is missing or unreadable: ${String(error)}`); }
  }
  if (evidence.sourceDirty !== false) errors.push("artifact source tree was dirty or source cleanliness is unknown");
  if (!/^[a-f0-9]{64}$/.test(evidence.sourceDigest)) errors.push("artifact source digest is missing or invalid");
  const current = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (evidence.sourceRevision !== current) errors.push(`artifact revision ${evidence.sourceRevision} does not match ${current}`);
  const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" }).trim();
  const diff = execFileSync("git", ["diff", "--binary", "HEAD", "--", "scripts/scale", "scripts/perf-browser.ts", "package.json", ".github/workflows/ci.yml", ".github/workflows/release.yml"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  const currentDigest = createHash("sha256").update(`${current}\n${status}\n${diff}`).digest("hex");
  if (evidence.sourceDigest !== currentDigest) errors.push("artifact source digest does not match the current source tree");
  const at = Date.parse(evidence.capturedAt);
  if (!Number.isFinite(at) || at > Date.now() || Date.now() - at > 30 * 86400_000) errors.push("artifact timestamp is invalid or older than 30 days");
  if (evidence.runtime.profile !== PROFILE) errors.push(`artifact profile must be ${PROFILE}`);
  if (evidence.runtime.cpuThrottle !== 4) errors.push("artifact CPU throttle must be exactly 4x");
  if (evidence.runtime.heapLimitMB !== 512) errors.push("artifact renderer heap limit must be exactly 512 MB");
  for (const key of ["bun", "browser", "platform", "profile"] as const) if (typeof evidence.runtime[key] !== "string" || !evidence.runtime[key].trim()) errors.push(`runtime.${key} is missing`);
  for (const key of ["cpuCount", "ramBytes", "cpuThrottle", "heapLimitMB"] as const) if (!Number.isFinite(evidence.runtime[key]) || evidence.runtime[key] <= 0) errors.push(`runtime.${key} is missing or invalid`);
  if (typeof evidence.runtime.ciRunner !== "boolean") errors.push("runtime.ciRunner must state whether this was a hosted runner");
  const assessment = assess(evidence.metrics ?? {});
  if (!evidence.metrics?.["search.build_ms"]?.method?.startsWith("Conservative upper bound:")) errors.push("search.build_ms must identify its cold-query conservative upper-bound definition");
  if (!evidence.metrics?.["save.server_ms"]?.method?.startsWith("Workbench click-to-public-patch-response")) errors.push("save.server_ms must identify its actual Workbench request timing boundary");
  if (!evidence.metrics?.["import_30mb_server_ms"]?.method?.startsWith("End-to-end public /api/inspect upload")) errors.push("import_30mb_server_ms must identify its public upload and staged-commit timing boundary");
  if (!evidence.metrics?.["packaged.cli_start_ms"]?.method?.startsWith("Elapsed from spawned compiled CLI")) errors.push("packaged.cli_start_ms must identify its compiled-CLI smoke timing boundary");
  if (assessment.missing.length) errors.push(`required rows missing: ${assessment.missing.join(", ")}`);
  errors.push(...assessment.failures);
  if (evidence.missing?.length) errors.push(`artifact reports missing rows: ${evidence.missing.join(", ")}`);
  if (evidence.failures?.length) errors.push(...evidence.failures);
  if (JSON.stringify(evidence.budgets) !== JSON.stringify(BUDGETS)) errors.push("artifact budgets differ from this source contract");
  if (evidence.status !== "pass") errors.push(`artifact status is ${String(evidence.status)}`);
  if (Object.keys(evidence.fixtures?.counts ?? {}).length === 0 || Object.keys(evidence.fixtures?.bytes ?? {}).length === 0) errors.push("fixture counts or byte totals are missing");
}
if (errors.length) {
  console.error(`scale:release-evidence FAIL (${errors.length})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else console.log(`scale:release-evidence PASS (${BUDGETS.length} low-end-emulated dev-server rows; compiled CLI launch proof present; desktop binary identity matched only, with no desktop runtime proof)`);
