/** Compare versions (port of RoleCall's SwipeCompareModal). The dialog is portaled to the body, so nothing here hangs off `.scs`. */
export const COMPARE_STYLE = `
.cmp-sheet.cmp-sheet{width:min(72rem,calc(100vw - 32px));max-width:none;padding:0;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;background:var(--stage-panel);color:var(--stage-card);border:3px solid var(--stage-black);border-top-color:var(--accent);box-shadow:7px 7px 0 0 var(--stage-black);font-family:var(--font-big)}
.cmp{display:flex;flex-direction:column;min-height:0;flex:1}
.cmp .top{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:2px solid var(--stage-black);background:color-mix(in srgb,var(--stage-card) 5%,var(--stage-panel))}
.cmp h2{margin:0;font-family:var(--font-fancy);font-weight:900;font-size:1.25rem;letter-spacing:.04em;text-transform:uppercase}
.cmp button{display:grid;place-items:center;min-width:28px;height:28px;padding:0;border:0;border-radius:0;background:none;color:var(--stage-soft);font:inherit;cursor:pointer}
.cmp button:hover:not(:disabled){color:var(--stage-card);background:color-mix(in srgb,var(--stage-card) 10%,transparent)}
.cmp button:disabled{color:var(--stage-line);cursor:not-allowed}
.cmp button:focus-visible{outline:2px solid var(--focus-ring);outline-offset:1px}
.cmp .panes{display:grid;grid-template-columns:1fr 1fr;min-height:0;flex:1;overflow:hidden}
.cmp .pane{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden}
.cmp .pane+.pane{border-left:2px solid var(--stage-black)}
.cmp .pane>header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:10px 12px;border-bottom:1px solid var(--stage-seam);background:var(--stage-row)}
.cmp .who{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center;font-size:var(--text-control)}
.cmp .who b{font-weight:900}
.cmp .when,.cmp .none,.cmp .unk{font-size:var(--text-meta);color:var(--stage-mute)}
.cmp .mdl{font-size:var(--text-meta);color:var(--bk-role-brand-text);overflow-wrap:anywhere}
.cmp .mdl.unk,.cmp .none{font-style:italic}
.cmp .who .fold{display:inline-flex;align-items:center;gap:4px;width:auto;height:auto;padding:2px 4px;font-size:var(--text-meta);color:var(--stage-soft)}
.cmp .gen{align-self:stretch;margin:6px 0 0;padding:8px;border:1px solid var(--stage-seam);background:var(--stage-sunken);font-size:var(--text-meta);text-align:left}
.cmp .gen div{display:flex;justify-content:space-between;gap:8px}.cmp .gen div+div{margin-top:4px}
.cmp .gen dt{color:var(--stage-mute)}.cmp .gen dd{margin:0;color:var(--stage-card);font-variant-numeric:tabular-nums}
.cmp .txt{flex:1;min-height:0;overflow-y:auto;padding:16px;font:400 16px/1.6 var(--font-body);overflow-wrap:anywhere}
.cmp .txt .prose p{margin:0}.cmp .txt .prose p+p,.cmp .txt .prose .blk+.blk{margin-top:16px}
.cmp .wait,.cmp .bad{margin:0;font-size:var(--text-body);color:var(--stage-mute)}.cmp .bad{color:var(--stage-danger-text)}
.cmp .same{margin:0;padding:10px 20px;border-top:2px solid var(--stage-black);background:color-mix(in srgb,var(--stage-warn) 10%,transparent);color:var(--stage-warn);font-size:var(--text-body);text-align:center}
@media (max-width:700px){.cmp .panes{grid-template-columns:1fr;overflow-y:auto}.cmp .pane+.pane{border-left:0;border-top:2px solid var(--stage-black)}}
`;
