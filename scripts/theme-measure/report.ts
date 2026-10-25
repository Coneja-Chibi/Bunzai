/** The small HTML report written beside measure.json: per-theme shares, the controls, and every screen's six distances, for the whole window and for the app area alone. */
import { PAIRS, THEMES, distinctFor, type Pair } from "./metric.ts";

interface Row { id: string; app: string; group: string; distances: Record<Pair, number>; control: number; fontControl: number }
interface View {
  calibration: { negative: number; positive: number; threshold: number; separated: boolean; colourMax: number; fontMax: number; colourOnlyThreshold: number; fontReflow: string[] };
  themes: { theme: string; equal: number; timeWeighted: number; count: number }[];
  screens: Row[];
}
interface Result { generated: string; content: string; views: { window: View; content: View }; skipped: { id: string; app: string; why: string }[] }

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function renderView(title: string, note: string, v: View): string {
  const t = v.calibration.threshold;
  const head = PAIRS.map((p) => `<th>${p.replace("|", " / ")}</th>`).join("");
  const rows = v.screens.map((s) => {
    const cells = PAIRS.map((p) => `<td class="${s.distances[p] > t ? "y" : "n"}">${s.distances[p].toFixed(3)}</td>`).join("");
    const misses = THEMES.filter((th) => !distinctFor(th, s.distances, t)).join(", ");
    return `<tr><th>${esc(s.id)}</th><td>${esc(s.app)}</td>${cells}<td>${s.control.toFixed(3)}</td><td>${s.fontControl.toFixed(3)}</td><td>${misses}</td></tr>`;
  }).join("\n");
  const themes = v.themes.map((x) => `<tr><th>${x.theme}</th><td>${pct(x.equal)}</td><td>${pct(x.timeWeighted)}</td><td>${x.count}</td></tr>`).join("\n");
  const c = v.calibration;
  return `<h2>${title}</h2>
<p>${note} A pair counts as different above ${t.toFixed(4)}. Recolour control (Theater with Paper's colours) max ${c.colourMax.toFixed(4)}; font control (Theater with Paper's faces) max ${c.fontMax.toFixed(4)}; positive control (scene.play) min ${c.positive.toFixed(4)}${c.separated ? "" : "; THE CONTROLS OVERLAP"}. Under the recolour-only threshold (${c.colourOnlyThreshold.toFixed(4)}) fonts alone would have counted ${c.fontReflow.length} screen${c.fontReflow.length === 1 ? "" : "s"} as different${c.fontReflow.length ? ": " + c.fontReflow.map(esc).join(", ") : ""}.</p>
<table><tr><th>theme</th><th>equal weight</th><th>time weighted</th><th>screens</th></tr>${themes}</table>
<table><tr><th>screen</th><th>app</th>${head}<th>recolour</th><th>fonts</th><th>not distinct for</th></tr>
${rows}</table>`;
}

export function renderReport(r: Result): string {
  const skipped = r.skipped.map((s) => `<li>${esc(s.id)}: ${esc(s.why)}</li>`).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Theme measure</title>
<style>:root{color-scheme:light dark;--bg:Canvas;--fg:CanvasText;--y:#2e7d32;--n:#b3261e}body{font:14px/1.45 system-ui,sans-serif;margin:24px;background:var(--bg);color:var(--fg)}table{border-collapse:collapse;margin:12px 0}th,td{border:1px solid color-mix(in srgb,currentColor 25%,transparent);padding:3px 8px;text-align:right}th:first-child{text-align:left}.y{color:var(--y)}.n{color:var(--n)}</style></head>
<body><h1>Theme measure</h1>
<p>Generated ${esc(r.generated)}. Distance is 1 minus SSIM of Sobel edge maps (colour removed).</p>
${renderView("App area only (the gate)", `Measured on ${esc(r.content)}, so the shell chrome that every theme redraws does not count.`, r.views.content)}
${renderView("Whole window", "Measured on the full 1400x900 window, shell included.", r.views.window)}
${skipped ? `<h2>Skipped</h2><ul>${skipped}</ul>` : ""}
</body></html>
`;
}
