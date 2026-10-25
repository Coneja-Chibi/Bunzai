/** Verifies the production doctor catalog is folder-discovered: one check per check file, unique ids. */
import { expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { discoverDoctorChecks } from "./discover";

test("discovers exactly one check per file under checks/, with unique ids", async () => {
  const files = readdirSync(new URL("checks/", import.meta.url)).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts") && !n.startsWith("_"));
  const ids = (await discoverDoctorChecks()).map((check) => check.id);
  expect(files.length).toBeGreaterThan(0);
  expect(ids).toHaveLength(files.length);
  expect(new Set(ids).size).toBe(ids.length);
});
