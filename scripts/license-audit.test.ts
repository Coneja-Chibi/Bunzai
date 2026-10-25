/**
 * The license firewall's proprietary rule: a "SEE LICENSE IN" / UNLICENSED / all-rights-reserved package
 * may not be a production dependency, and may be optional only when allowlisted.
 */
import { describe, expect, test } from "bun:test";
import { auditLicenses, OPTIONAL_PROPRIETARY } from "./license-audit";

const SDK = "@anthropic-ai/claude-agent-sdk";
const licenses: Record<string, string> = {
  [SDK]: "SEE LICENSE IN README.md",
  mit: "MIT",
  secret: "UNLICENSED",
  viral: "AGPL-3.0",
  rights: "(c) Someone. All rights reserved.",
};
const lookup = (name: string): string | null => licenses[name] ?? null;

describe("auditLicenses", () => {
  test("fails when a proprietary package is a production dependency", () => {
    const { bad } = auditLicenses({ dependencies: { [SDK]: "^1", mit: "^1" } }, lookup);
    expect(bad.map((b) => b.name)).toEqual([SDK]);
    expect(bad[0]!.why).toContain("proprietary production dependency");
  });

  test("passes when the allowlisted proprietary package is optional", () => {
    const { bad, rows } = auditLicenses({ dependencies: { mit: "^1" }, optionalDependencies: { [SDK]: "^1" } }, lookup);
    expect(bad).toEqual([]);
    expect(rows.find((r) => r.name === SDK)?.scope).toBe("optional");
    expect(OPTIONAL_PROPRIETARY.has(SDK)).toBe(true);
  });

  test("an optional proprietary package that is not allowlisted still fails", () => {
    const { bad } = auditLicenses({ optionalDependencies: { secret: "^1", rights: "^1" } }, lookup);
    expect(bad.map((b) => b.name).sort()).toEqual(["rights", "secret"]);
  });

  test("copyleft fails in every group and a missing package fails closed", () => {
    for (const group of ["dependencies", "optionalDependencies", "devDependencies"] as const) {
      expect(auditLicenses({ [group]: { viral: "^1" } }, lookup).bad.map((b) => b.name)).toEqual(["viral"]);
    }
    expect(auditLicenses({ dependencies: { ghost: "^1" } }, lookup).bad[0]?.license).toBe("(not installed)");
  });
});
