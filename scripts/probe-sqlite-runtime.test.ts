/**
 * Contract tests for the SQLite runtime probe. The version comparison matters most: a bug there
 * would let the guard pass on a SQLite too old for the generated columns the `documents` table
 * needs, which is exactly the failure the probe exists to catch.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  formatResult,
  meetsMinimumVersion,
  parseVersion,
  probeSqliteRuntime,
  MINIMUM_SQLITE_VERSION,
} from "./probe-sqlite-runtime";

describe("parseVersion", () => {
  test("reads a normal version triple", () => {
    expect(parseVersion("3.51.1")).toEqual([3, 51, 1]);
  });

  test("treats unparseable segments as zero rather than NaN", () => {
    expect(parseVersion("3.x.1")).toEqual([3, 0, 1]);
  });
});

describe("meetsMinimumVersion", () => {
  test("accepts the exact minimum", () => {
    expect(meetsMinimumVersion(MINIMUM_SQLITE_VERSION.join("."))).toBe(true);
  });

  test("rejects the release just below the minimum", () => {
    expect(meetsMinimumVersion("3.30.1")).toBe(false);
  });

  test("compares minor versions numerically, not as text", () => {
    // "3.9" sorts after "3.31" as a string. It is older as a version.
    expect(meetsMinimumVersion("3.9.0")).toBe(false);
    expect(meetsMinimumVersion("3.310.0")).toBe(true);
  });

  test("accepts a newer major", () => {
    expect(meetsMinimumVersion("4.0.0")).toBe(true);
  });

  test("treats a missing patch segment as zero", () => {
    expect(meetsMinimumVersion("3.31")).toBe(true);
    expect(meetsMinimumVersion("3.30")).toBe(false);
  });
});

describe("probeSqliteRuntime", () => {
  test("every capability the data model needs is present in this runtime", () => {
    const result = probeSqliteRuntime();
    const failed = result.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.detail}`);
    expect(failed).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test("names each capability the plan depends on", () => {
    const names = probeSqliteRuntime().checks.map((c) => c.name);
    for (const needed of [
      "write-ahead logging",
      "generated columns, stored and virtual",
      "index over a generated column",
      "json1 functions",
      "fts5 virtual tables",
      "fts5 name trigram tokenizer",
      "metadata-only sealed-cell byte counts",
      "rollback leaves no partial write",
      "close releases the file",
      "data survives close and reopen",
    ]) {
      expect(names).toContain(needed);
    }
  });

  test("leaves no database or write-ahead sidecar behind", () => {
    const path = join(tmpdir(), `bunzai-probe-cleanup-${process.pid}-${Date.now()}.db`);
    const result = probeSqliteRuntime(path);
    expect(result.ok).toBe(true);

    const leaked = ["", "-wal", "-shm"].filter((suffix) => existsSync(path + suffix));
    expect(leaked).toEqual([]);
  });

  test("a second run against the same path is not blocked by the first", () => {
    const path = join(tmpdir(), `bunzai-probe-reuse-${process.pid}-${Date.now()}.db`);
    expect(probeSqliteRuntime(path).ok).toBe(true);
    expect(probeSqliteRuntime(path).ok).toBe(true);
    expect(existsSync(path)).toBe(false);
  });
});

describe("formatResult", () => {
  test("a failed check is visible in the output and the run is marked failed", () => {
    const text = formatResult({
      version: "3.30.0",
      checks: [{ name: "write-ahead logging", ok: false, detail: "journal_mode is delete" }],
      ok: false,
    });
    expect(text).toContain("FAIL write-ahead logging");
    expect(text).toContain("journal_mode is delete");
    expect(text).toContain("probe-sqlite-runtime: FAILED");
  });

  test("a passing run says so", () => {
    const text = formatResult({ version: "3.51.1", checks: [{ name: "x", ok: true, detail: "y" }], ok: true });
    expect(text).toContain("all checks passed");
    expect(text).not.toContain("FAIL");
  });
});
