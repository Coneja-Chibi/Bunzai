/** The Final Cut activity dialog (.fa, on top of the Correction Tools skeleton, .cx). It is portaled to the body, so nothing here hangs off .scs. */
export const FINAL_CUT_ACTIVITY_STYLE = `
.tc-row{margin-bottom:8px}.tc-row section{min-width:0}.tc-row .none{display:grid;place-items:center;color:var(--stage-mute);font-size:var(--text-control)}
.tc-row del{color:var(--stage-danger-text);text-decoration:line-through}.tc-row ins{text-decoration:none;background:color-mix(in srgb,var(--bk-accent) 28%,transparent)}
.fa-passes{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.fa-pass{border:1px solid var(--stage-seam);background:var(--stage-sunken);padding:8px 10px;display:flex;flex-direction:column;gap:4px;min-width:0}
.fa-pass.failed{border-color:var(--stage-danger-text)}.fa-pass.skipped{border-color:var(--stage-warn)}.fa-pass.applied{border-color:var(--bk-accent)}
.fa-head{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline;font:var(--text-control) var(--font-mono);color:var(--stage-soft)}
.fa-head b{font-family:var(--font-ui);color:var(--stage-card);letter-spacing:.06em;text-transform:uppercase}
.fa-line,.fa-warn{margin:0;font-size:var(--text-body);color:var(--stage-card);overflow-wrap:anywhere}
.fa-warn{color:var(--stage-warn)}
.fa-review{margin:0;padding-left:16px;font-size:var(--text-control);color:var(--stage-soft)}.fa-review em{font-style:normal;color:var(--stage-mute)}
.fa-pass details{font-size:var(--text-control);color:var(--stage-soft)}
.fa-pass pre,.fa-diff{margin:0;padding:8px;max-height:16rem;overflow-y:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:var(--text-control) var(--font-body);color:var(--stage-card);border:1px solid var(--stage-seam);background:var(--stage-sunken)}
.fa-diff ins{text-decoration:none;background:color-mix(in srgb,var(--bk-accent) 28%,transparent)}
.fa-diff del{color:var(--stage-danger-text);text-decoration:line-through}
.fa-hist{display:flex;flex-direction:column;gap:8px}.fa-hist h4{margin:0;font:700 var(--text-meta) var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--stage-soft)}
.fa-hist ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}.fa-hist summary{cursor:pointer;font:var(--text-control) var(--font-mono);color:var(--stage-soft)}
.fa-rerun{display:flex;flex-direction:column;gap:8px}.fa-rerun h4{margin:0;font:700 var(--text-meta) var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--stage-soft)}
`;
