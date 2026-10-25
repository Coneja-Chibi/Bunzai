/** Build the apply pipeline into one browser script and run the Node browser half against it. Returns what it measured. */
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const CHROME_PATHS = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
export const hasChrome = (): boolean => CHROME_PATHS.some((p) => p && existsSync(p));

export async function measure(work: string, port = 9591): Promise<Record<string, any>> {
  mkdirSync(work, { recursive: true });
  const built = await Bun.build({ entrypoints: [resolve("scripts/mod-top-layer/entry.ts")], target: "browser", format: "iife", naming: "mod-iife.js", outdir: work });
  if (!built.success) throw new Error("bundle failed: " + built.logs.join("\n"));
  const child = Bun.spawn(["node", "scripts/mod-top-layer/check.ts", join(work, "mod-iife.js"), resolve("src/ui/theme/tokens.css"), work, String(port)], { stdout: "pipe", stderr: "inherit" });
  const text = await new Response(child.stdout).text();
  if ((await child.exited) !== 0) throw new Error("the browser half failed:\n" + text.slice(-800));
  const line = text.split("\n").find((l) => l.startsWith("RESULT"));
  if (!line) throw new Error("no result:\n" + text.slice(-800));
  return JSON.parse(line.slice(6));
}

if (import.meta.main) {
  const work = process.argv[2] ?? "top-layer-work";
  console.log(JSON.stringify(await measure(work), null, 1));
}
