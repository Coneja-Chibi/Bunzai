/** Verifies collected child output, stdin, and nonzero exit results. */
import { expect, test } from "bun:test";
import { spawnCollect } from "./spawn-collect";

test("collects both streams and sends optional stdin", async () => {
  const result = await spawnCollect(process.execPath, [
    "-e",
    'let input = ""; process.stdin.on("data", (part) => input += part); process.stdin.on("end", () => { process.stdout.write(input); process.stderr.write("warning"); });',
  ], { stdin: "payload", stdoutEncoding: "ascii" });
  expect(result).toEqual({ code: 0, stdout: "payload", stderr: "warning" });
});

test("returns the exit status and output instead of imposing an error policy", async () => {
  const result = await spawnCollect(process.execPath, ["-e", 'process.stderr.write("bad"); process.exit(7);']);
  expect(result).toEqual({ code: 7, stdout: "", stderr: "bad" });
});
