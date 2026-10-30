/** Run the real probe entry point against fake OS tools: diagnostic cleanup must never touch an existing vault. */
import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { macosKeychainToolFor } from "../src/kit/keystore/backends/macos-keychain";
import { linuxSecretToolFor } from "../src/kit/keystore/backends/linux-secret";

test("keychain service factories preserve existing addresses and refuse command-language tokens", async () => {
  for (const factory of [macosKeychainToolFor, linuxSecretToolFor]) {
    const tool = factory();
    let commandArgs: readonly string[] = [];
    await tool.read(async (_command, args) => {
      commandArgs = args;
      return { code: tool.platform === "darwin" ? 44 : 1, stdout: "", stderr: "" };
    }, "key");
    expect(commandArgs).toContain("bunzai-kit");
    expect(commandArgs).toContain("vault-key");
    for (const service of ["bad service", "bad\ncommand", "bad;command", "x".repeat(81)]) {
      expect(() => factory(service)).toThrow("invalid keychain service name");
    }
  }
});

for (const platform of ["darwin", "linux"] as const) {
 for (const failure of ["none", "nonzero", "throw"] as const) {
  test(`the ${platform} keychain probe preserves application credentials with cleanup ${failure}`, async () => {
    const home = mkdtempSync(join(tmpdir(), "bunzai-probe-regression-"));
    const report = join(home, "report.json");
    const harness = join(home, "probe.mjs");
    const collector = fileURLToPath(new URL("../src/kit/keystore/backends/spawn-collect.ts", import.meta.url));
    const entry = new URL("./probe-keychain.ts", import.meta.url).href;
    writeFileSync(harness, `
import { mock } from "bun:test";
import { writeFileSync } from "node:fs";
Object.defineProperty(process, "platform", { value: ${JSON.stringify(platform)} });
const original = [
  [JSON.stringify(["bunzai-kit", "vault-key"]), Buffer.alloc(32, 7).toString("base64")],
  [JSON.stringify(["bunzai-kit", "vault-key-made"]), "existing-marker"],
];
const items = new Map(original);
const calls = [];
process.on("exit", () => writeFileSync(${JSON.stringify(report)}, JSON.stringify({ original, items: [...items], calls })));
mock.module(${JSON.stringify(collector)}, () => ({
  spawnCollect: async (command, args, options) => {
    const words = command === "security" && args[0] === "-i" ? options.stdin.trim().split(/\\s+/) : args;
    const service = words[words.indexOf(command === "security" ? "-s" : "service") + 1];
    const account = words[words.indexOf(command === "security" ? "-a" : "account") + 1];
    calls.push({ service, account, operation: words[0] });
    const key = JSON.stringify([service, account]);
    const result = (code, stdout = "") => ({ code, stdout, stderr: "" });
    if (["delete-generic-password", "clear"].includes(words[0])) {
      if (!items.has(key)) return result(command === "security" ? 44 : 1);
      if (items.has(key) && service !== "bunzai-kit" && account === "vault-key" && ${JSON.stringify(failure)} !== "none") {
        if (${JSON.stringify(failure)} === "throw") throw new Error("fake cleanup rejected");
        return { code: 5, stdout: "", stderr: "fake cleanup refused" };
      }
      items.delete(key);
      return result(0);
    }
    if (["find-generic-password", "lookup"].includes(words[0])) {
      return items.has(key) ? result(0, items.get(key)) : result(command === "security" ? 44 : 1);
    }
    if (words[0] === "add-generic-password") {
      if (items.has(key)) return result(45);
      items.set(key, words[words.indexOf("-w") + 1]);
      return result(0);
    }
    if (words[0] === "store") {
      items.set(key, options.stdin);
      return result(0);
    }
    throw new Error("unexpected fake-tool operation");
  },
}));
await import(${JSON.stringify(entry)});
`);
    try {
      const child = Bun.spawn([process.execPath, harness], {
        env: { ...process.env, HOME: home, USERPROFILE: home, BUNZAI_HOME: home, TMPDIR: home, TMP: home, TEMP: home },
        stdout: "pipe", stderr: "pipe",
      });
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
      expect({ code, stderr, completed: stdout.includes("every check passed") }).toEqual({ code: failure === "none" ? 0 : 1, stderr: "", completed: failure === "none" });
      const recorded = JSON.parse(readFileSync(report, "utf8")) as {
        original: [string, string][]; items: [string, string][]; calls: { service: string; account: string; operation: string }[];
      };
      expect(recorded.items.filter(([key]) => recorded.original.some(([original]) => original === key))).toEqual(recorded.original);
      if (failure === "none") expect(recorded.items).toEqual(recorded.original);
      else {
        expect(recorded.calls.filter((call) => ["delete-generic-password", "clear"].includes(call.operation)).slice(-2).map((call) => call.account)).toEqual(["vault-key", "vault-key-made"]);
        expect(stdout).toContain("FAIL");
      }
      expect(recorded.calls.length).toBeGreaterThan(0);
      expect(recorded.calls.every((call) => call.service.startsWith("bunzai-keychain-probe-"))).toBe(true);
      expect(readdirSync(home).filter((name) => name.startsWith("bunzai-keychain-probe-"))).toEqual([]);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
 }
}
