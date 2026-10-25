/** Collect one child process's output while preserving caller-selected text encodings. */
import { spawn } from "node:child_process";

export interface SpawnResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export function spawnCollect(
  command: string,
  args: readonly string[],
  options: { stdin?: string; stdoutEncoding?: BufferEncoding; stderrEncoding?: BufferEncoding } = {},
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(options.stdoutEncoding ?? "utf8"); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(options.stderrEncoding ?? "utf8"); });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    if (options.stdin !== undefined) child.stdin.write(options.stdin);
    child.stdin.end();
  });
}
