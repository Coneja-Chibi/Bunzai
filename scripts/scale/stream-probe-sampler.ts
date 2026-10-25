/** Preload for the S0 streaming probe: samples this process every 25 ms into PROBE_OUT (JSON lines). */
import { appendFileSync, writeFileSync } from "node:fs";

const out = process.env["PROBE_OUT"];
if (!out) throw new Error("stream-probe-sampler needs PROBE_OUT");
writeFileSync(`${out}.pid`, String(process.pid));
const timer = setInterval(() => {
  const m = process.memoryUsage();
  appendFileSync(out, `${JSON.stringify({ t: Date.now(), rss: m.rss, heap: m.heapUsed, ext: m.external, ab: m.arrayBuffers })}\n`);
}, 25);
timer.unref();
