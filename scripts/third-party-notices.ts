/**
 * Writes or checks THIRD-PARTY-NOTICES.md: name, version, license and repository of every package in the
 * production dependency closure (package.json `dependencies`, followed through each installed package's own
 * `dependencies`; dev dependencies and per-platform optional binaries are excluded so the file is the same on every machine), plus the Go sidecar's modules.
 * Run: bun run notices [--check]. Needs an installed node_modules; it never touches the network.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const OUT = "THIRD-PARTY-NOTICES.md";
const ROOT = process.cwd();
interface Manifest { name?: string; version?: string; license?: string | { type?: string }; licenses?: { type?: string }[]; repository?: string | { url?: string }; dependencies?: Record<string, string>; optionalDependencies?: Record<string, string> }
interface Row { name: string; version: string; license: string; repo: string }

const readManifest = (dir: string): Manifest => JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Manifest;

/** Node resolution: the requesting package's own node_modules first, then each parent folder's. */
function locate(name: string, from: string): string | null {
  for (let dir = from; ; dir = dirname(dir)) {
    const candidate = join(dir, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return candidate;
    if (dirname(dir) === dir) return null;
  }
}

function licenseOf(m: Manifest): string {
  if (typeof m.license === "string") return m.license;
  if (m.license?.type) return m.license.type;
  return m.licenses?.map((l) => l.type ?? "").filter(Boolean).join(" OR ") || "see package";
}

const repoOf = (m: Manifest): string =>
  (typeof m.repository === "string" ? m.repository : m.repository?.url ?? "").replace(/^git\+/, "").replace(/\.git$/, "").replace(/^git:\/\//, "https://") || "-";

function npmRows(): Row[] {
  const seen = new Map<string, Row>();
  const queue: [string, string][] = Object.keys(readManifest(ROOT).dependencies ?? {}).map((n) => [n, ROOT]);
  while (queue.length > 0) {
    const [name, from] = queue.shift()!;
    const dir = locate(name, from);
    if (!dir) continue; // an optional platform package that is not installed here
    const m = readManifest(dir);
    const key = `${name}@${m.version}`;
    if (seen.has(key)) continue;
    seen.set(key, { name, version: m.version ?? "?", license: licenseOf(m), repo: repoOf(m) });
    for (const dep of Object.keys(m.dependencies ?? {})) queue.push([dep, dir]);
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

/** Go modules from sidecar/go.mod; licenses live upstream because no module cache is read here. */
function goModules(): { path: string; version: string }[] {
  const text = readFileSync("sidecar/go.mod", "utf8");
  return [...text.matchAll(/^\s*(?:require\s+)?([a-z0-9.-]+\.[a-z]+\/[^\s]+|tailscale\.com)\s+(v\S+)/gm)]
    .map((m) => ({ path: m[1]!, version: m[2]! }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

const cell = (s: string): string => s.replace(/\|/g, "\|");

function render(): string {
  const rows = npmRows();
  const mods = goModules();
  return `# Third-party notices

Bunzai is AGPL-3.0-or-later (see [LICENSE](LICENSE)). This file lists what ships with it. Regenerate it with
\`bun run notices\`; \`bun run notices:check\` fails when it is stale.

## Notes

- \`dompurify\` is dual-licensed (MPL-2.0 OR Apache-2.0) and is used under Apache-2.0.
- \`caniuse-lite\` (CC-BY-4.0) is a build-time data package pulled in by the toolchain; it is not part of the production closure listed below.
- The bundled fonts under \`src/ui/theme/fonts/\` are licensed under the SIL Open Font License; each family's license text sits beside it as \`OFL-<family>.txt\`.

## npm packages (production closure)

| Package | Version | License | Repository |
| --- | --- | --- | --- |
${rows.map((r) => `| ${cell(r.name)} | ${r.version} | ${cell(r.license)} | ${cell(r.repo)} |`).join("\n")}

## Go sidecar modules

Taken from \`sidecar/go.mod\`. Each module's license is the one its upstream repository publishes; the notice text
for each is in that module's source.

| Module | Version | License |
| --- | --- | --- |
${mods.map((m) => `| ${m.path} | ${m.version} | license per upstream |`).join("\n")}
`;
}

const text = render();
if (process.argv[2] === "--check") {
  if (!existsSync(OUT) || readFileSync(OUT, "utf8") !== text) {
    console.error(`notices:check: ${OUT} is stale; run \`bun run notices\`.`);
    process.exit(2);
  }
  console.log(`notices:check: ${OUT} is current`);
} else {
  writeFileSync(OUT, text);
  console.log(`notices: wrote ${OUT}`);
}
