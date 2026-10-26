/** The Prompt Inspector dialog's styles (.pi). Portaled to the body like the Correction Tools sheet, so nothing hangs off .scs. */
export const INSPECTOR_STYLE = `
.pi-sheet.pi-sheet{width:min(52rem,calc(100vw - 32px));max-width:none;padding:0;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;background:var(--stage-panel);color:var(--stage-card);border:3px solid var(--stage-black);border-top-color:var(--bk-accent);box-shadow:7px 7px 0 0 var(--stage-black);font-family:var(--font-big)}
.pi{display:flex;flex-direction:column;min-height:0;flex:1}
.pi-top{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:2px solid var(--stage-black);background:color-mix(in srgb,var(--stage-card) 5%,var(--stage-panel))}
.pi-top>[data-control]{margin-left:auto}
.pi-top h2{margin:0;font-family:var(--font-fancy);font-weight:900;font-size:1.1rem;letter-spacing:.04em;text-transform:uppercase}
.pi-chip{padding:2px 8px;border:2px solid var(--stage-line);background:var(--stage-sunken);font:700 var(--text-meta) var(--font-mono);color:var(--stage-soft)}
.pi textarea:focus-visible{outline:2px solid var(--focus-ring);outline-offset:1px}
.pi-body{display:flex;flex-direction:column;gap:10px;padding:16px;min-height:0;overflow-y:auto}
.pi-msg{display:flex;flex-direction:column;gap:4px}
.pi-msg span{font:700 var(--text-meta) var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--stage-soft)}
.pi-msg textarea{width:100%;box-sizing:border-box;resize:vertical;padding:8px 10px;background:var(--stage-sunken);border:2px solid var(--stage-line);font:var(--text-control)/1.5 var(--font-body);color:var(--stage-card)}
.pi-acts{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:2px solid var(--stage-black)}
.pi-paused{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:150}
`;
