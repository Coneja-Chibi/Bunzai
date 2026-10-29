/** Signal-driven server sampler used by S21; it adds no polling timer to the process under measurement. */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

const output = process.env["BUNZAI_SCALE_PROBE_OUTPUT"];
const phaseFile = process.env["BUNZAI_SCALE_PROBE_PHASE"];
const readyFile = process.env["BUNZAI_SCALE_PROBE_READY"];
if (!output || !phaseFile || !readyFile) throw new Error("S21 server probe requires isolated output, phase, and readiness files");
let previousCpu = process.cpuUsage();
let previousAt = performance.now();
let previousPhase = "startup";
let timeoutFires = 0;
let intervalFires = 0;
const nativeTimeout = globalThis.setTimeout;
const nativeInterval = globalThis.setInterval;
globalThis.setTimeout = ((callback: TimerHandler, ms?: number, ...args: unknown[]) =>
  nativeTimeout(typeof callback === "function" ? (...cbArgs: unknown[]) => { timeoutFires++; callback(...cbArgs); } : callback, ms, ...args)) as typeof setTimeout;
globalThis.setInterval = ((callback: TimerHandler, ms?: number, ...args: unknown[]) =>
  nativeInterval(typeof callback === "function" ? (...cbArgs: unknown[]) => { intervalFires++; callback(...cbArgs); } : callback, ms, ...args)) as typeof setInterval;

const sample = (): void => {
  try {
    const phase = readFileSync(phaseFile, "utf8").trim();
    const at = performance.now();
    if (phase !== previousPhase) {
      previousPhase = phase;
      previousCpu = process.cpuUsage();
      previousAt = at;
      timeoutFires = 0;
      intervalFires = 0;
      appendFileSync(output, `${JSON.stringify({ phase, elapsedMs: 0, userMicros: 0, systemMicros: 0,
        rssBytes: process.memoryUsage().rss, timerFires: 0 })}\n`);
      return;
    }
    const cpu = process.cpuUsage(previousCpu);
    const elapsedMs = Math.max(1, at - previousAt);
    appendFileSync(output, `${JSON.stringify({ phase, elapsedMs, userMicros: cpu.user, systemMicros: cpu.system,
      rssBytes: process.memoryUsage().rss, timerFires: timeoutFires + intervalFires })}\n`);
    previousCpu = process.cpuUsage();
    previousAt = at;
    timeoutFires = 0;
    intervalFires = 0;
  } catch (error) {
    console.error("scale server probe sample failed", error);
  }
};
process.on(process.platform === "win32" ? "SIGBREAK" : "SIGUSR2", sample);
writeFileSync(readyFile, String(process.pid), { flag: "wx" });
