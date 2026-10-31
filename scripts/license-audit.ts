/**
 * Dependency license firewall: fail if a runtime/dev dep is AGPL, GPL, SSPL, or Elastic, or if a
 * production dependency is not open source ("SEE LICENSE IN", UNLICENSED, all rights reserved).
 * Product is AGPL-3.0-or-later; dependencies stay MIT/Apache/BSD/ISC/etc., except the owner-approved AGPL rp-core submodule.
 * A proprietary package may ride only in "optionalDependencies" AND on OPTIONAL_PROPRIETARY, so it is
 * never bundled into a release (see --external in scripts/build-desktop.ts).
 * Run: bun run scripts/license-audit.ts
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN = /\b(AGPL|GPL-3|GPL-2|LGPL|SSSPL|SSPL|Elastic|BUSL|Commons Clause)\b/i;
const PROPRIETARY = /SEE LICENSE IN|UNLICENSED|all rights reserved|proprietary/i;

/** Proprietary packages allowed ONLY as optional dependencies. Each one needs a reason. */
export const OPTIONAL_PROPRIETARY: ReadonlySet<string> = new Set([
  "@anthropic-ai/claude-agent-sdk", // Claude subscription spoke; loaded lazily, external to every compile
]);

export interface AuditInput {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
export interface AuditRow { name: string; license: string; scope: "prod" | "optional" | "dev" }
export interface AuditFailure { name: string; license: string; why: string }

/** Pure check over the three dependency groups; `licenseOf` is the filesystem boundary. */
export function auditLicenses(
  pkg: AuditInput,
  licenseOf: (name: string) => string | null,
): { rows: AuditRow[]; bad: AuditFailure[] } {
  const rows: AuditRow[] = [];
  const bad: AuditFailure[] = [];
  const groups: Array<[AuditRow["scope"], string[]]> = [
    ["prod", Object.keys(pkg.dependencies ?? {})],
    ["optional", Object.keys(pkg.optionalDependencies ?? {})],
    ["dev", Object.keys(pkg.devDependencies ?? {})],
  ];
  for (const [scope, names] of groups) {
    for (const name of names.sort()) {
      const license = licenseOf(name);
      if (license === null) {
        bad.push({ name, license: "(not installed)", why: "missing license" });
        continue;
      }
      rows.push({ name, license, scope });
      if (FORBIDDEN.test(license) && !(name === "rp-core" && license === "AGPL-3.0-or-later")) bad.push({ name, license, why: "forbidden copyleft or restricted license" });
      else if (scope !== "dev" && PROPRIETARY.test(license)) {
        if (scope === "prod") bad.push({ name, license, why: "proprietary production dependency (move it to optionalDependencies only if it is allowlisted)" });
        else if (!OPTIONAL_PROPRIETARY.has(name)) bad.push({ name, license, why: "proprietary optional dependency is not on the allowlist" });
      }
    }
  }
  return { rows, bad };
}

function packageDir(root: string, name: string): string | null {
  const dir = join(root, "node_modules", ...name.split("/"));
  return existsSync(join(dir, "package.json")) ? dir : null;
}

function licenseFromDir(dir: string): string {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
    license?: string | { type?: string };
    licenses?: Array<{ type?: string }>;
  };
  if (typeof pkg.license === "string") return pkg.license;
  if (pkg.license && typeof pkg.license === "object" && pkg.license.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses)) {
    return pkg.licenses.map((l) => l.type ?? "").join(" OR ");
  }
  // LICENSE file fallback
  for (const f of ["LICENSE", "LICENSE.md", "LICENSE.txt", "license"]) {
    const p = join(dir, f);
    if (existsSync(p) && statSync(p).isFile()) {
      const head = readFileSync(p, "utf8").slice(0, 400);
      if (/MIT/i.test(head)) return "MIT (file)";
      if (/Apache/i.test(head)) return "Apache (file)";
      if (FORBIDDEN.test(head) || PROPRIETARY.test(head)) return head.slice(0, 80);
    }
  }
  return "(unknown)";
}

if (import.meta.main) {
  const ROOT = join(import.meta.dir, "..");
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as AuditInput;
  const { rows, bad } = auditLicenses(pkg, (name) => {
    const dir = packageDir(ROOT, name);
    return dir ? licenseFromDir(dir) : null;
  });

  console.log("vaud license audit (direct deps)\n");
  for (const r of rows) {
    console.log(`  ${r.name.padEnd(34)} ${r.license.padEnd(28)} ${r.scope}`);
  }

  if (bad.length > 0) {
    console.error("\nFAIL: forbidden, proprietary, or missing license:");
    for (const b of bad) console.error(`  ${b.name}: ${b.license} (${b.why})`);
    process.exit(2);
  }

  console.log("\nOK: no restricted direct dependencies beyond the approved AGPL rp-core engine, and no proprietary production dependency.\n");
}
