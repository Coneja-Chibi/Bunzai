/** The Correction Tools modal's styles (.cx). The dialog is portaled to the body, so nothing here hangs off .scs. */
export const CORRECT_STYLE = `
.cx-sheet.cx-sheet{width:min(44rem,calc(100vw - 32px));max-width:none;padding:0;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;background:var(--stage-panel);color:var(--stage-card);border:3px solid var(--stage-black);border-top-color:var(--bk-accent);box-shadow:7px 7px 0 0 var(--stage-black);font-family:var(--font-big)}
.cx{display:flex;flex-direction:column;min-height:0;flex:1}
.cx-top{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:2px solid var(--stage-black);background:color-mix(in srgb,var(--stage-card) 5%,var(--stage-panel))}
.cx-top h2{margin:0;font-family:var(--font-fancy);font-weight:900;font-size:1.1rem;letter-spacing:.04em;text-transform:uppercase}
.cx-top button{display:grid;place-items:center;width:28px;height:28px;padding:0;border:0;background:none;color:var(--stage-soft);cursor:pointer}
.cx-top button:hover{color:var(--stage-card)}
.cx-tabs{display:flex;border-bottom:2px solid var(--stage-black)}
.cx-tabs button{flex:1;padding:8px 12px;border:0;border-bottom:3px solid transparent;background:none;color:var(--stage-mute);font:700 var(--text-control) var(--font-big);letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
.cx-tabs button[aria-selected="true"]{color:var(--stage-card);border-bottom-color:var(--bk-accent)}
.cx button:focus-visible,.cx textarea:focus-visible{outline:2px solid var(--focus-ring);outline-offset:1px}
.cx-body{display:flex;flex-direction:column;gap:12px;padding:16px;min-height:0;overflow-y:auto}
.cx-blurb,.cx-note,.cx-err{margin:0;font-size:var(--text-body);color:var(--stage-soft)}
.cx-err{padding:8px 10px;border:1px solid var(--stage-danger-text);color:var(--stage-danger-text)}
.cx-note{text-align:center;padding:12px}.cx-note b,.cx-note small{display:block}.cx-note small{margin-top:4px;color:var(--stage-mute)}
.cx-btn{padding:9px 14px;border:2px solid var(--stage-line);background:none;color:var(--stage-text-dim);font:700 var(--text-control) var(--font-big);letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
.cx-btn:hover:not(:disabled){color:var(--stage-card);border-color:var(--stage-mute)}
.cx-btn.go{border-color:var(--bk-accent);color:var(--stage-card)}
.cx-instr{width:100%;padding:8px 10px;border:1px solid var(--stage-line);background:var(--stage-sunken);color:var(--stage-card);font:var(--text-control) var(--font-body)}
.cx-instr:focus-visible{outline:2px solid var(--focus-ring);outline-offset:1px}
.cx-btn.wide{width:100%}
.cx-btn:disabled{opacity:.5;cursor:not-allowed}
.cx-guides{display:flex;flex-direction:column;gap:8px}
.cx-guide{padding:10px 12px;text-align:left;border:2px solid var(--stage-line);background:none;color:var(--stage-text-dim);cursor:pointer;font-family:var(--font-big)}
.cx-guide.on{border-color:var(--bk-accent);color:var(--stage-card)}
.cx-guide b,.cx-guide small{display:block}.cx-guide small{margin-top:4px;color:var(--stage-mute);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cx-prev{display:flex;flex-direction:column;gap:12px}
.cx-cols section.new{border-color:var(--bk-accent)}
.cx-acts{display:flex;gap:8px}.cx-acts .cx-btn{flex:1}
.cx-rw{display:flex;flex-direction:column;gap:10px}
.cx-rw textarea{width:100%;box-sizing:border-box;min-height:14rem;max-height:22rem;resize:vertical;padding:10px 12px;background:var(--stage-sunken);border:2px solid var(--stage-line);font:var(--text-body)/1.55 var(--font-body);color:var(--stage-card)}
.cx-sel{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:var(--text-meta);color:var(--stage-mute)}
.cx-sel span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cx-sel button{flex:none;border:0;background:none;color:var(--stage-soft);font:inherit;cursor:pointer}
.cx-sel button:hover{color:var(--stage-card)}
.cx-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.cx-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));gap:8px}
.cx-cols h4{margin:0;padding:3px 8px;font:700 var(--text-meta) var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--stage-soft);border-bottom:1px solid var(--stage-seam)}
.cx-cols section{border:1px solid var(--stage-seam);background:var(--stage-sunken);min-width:0}
.cx-cols pre{margin:0;padding:8px;max-height:12rem;overflow-y:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:var(--text-control) var(--font-body);color:var(--stage-card)}
`;
