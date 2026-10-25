/** The draft tools' strip above the composer (.ds, inside .scs). */
export const DRAFT_STYLE = `
.scs .ds{display:flex;flex-direction:column;gap:6px;max-width:768px;margin:0 auto 6px}
.scs .ds-rib{display:flex;align-items:center;flex-wrap:wrap;gap:6px 12px;padding:6px 10px;border:1px solid var(--stage-seam);border-left:3px solid var(--stage-ok);background:color-mix(in srgb,var(--stage-panel) 85%,transparent);font:var(--text-control) var(--font-big);color:var(--stage-text-dim)}
.scs .ds-rib.bad{border-left-color:var(--stage-danger-text);color:var(--stage-danger-text)}
.scs .ds-eye{display:inline-flex;align-items:center;gap:6px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--stage-ok)}
.scs .ds-help{flex:1;min-width:12rem;color:var(--stage-soft)}
.scs .ds-btn{display:inline-flex;align-items:center;padding:3px 8px;border:1px solid var(--stage-line);background:none;color:var(--stage-text-dim);font:700 var(--text-meta) var(--font-big);letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
.scs .ds-btn:hover{color:var(--stage-card);border-color:var(--stage-mute)}
.scs .ds-btn:focus-visible,.scs .ds-pill button:focus-visible{outline:2px solid var(--focus-ring);outline-offset:1px}
.ds-pill{display:inline-flex;align-self:flex-start;border:2px solid var(--stage-black);background:var(--stage-sunken)}
.ds-pill button{padding:4px 10px;border:0;border-right:2px solid var(--stage-black);background:none;color:var(--stage-soft);font:800 var(--text-meta) var(--font-fancy);letter-spacing:.1em;cursor:pointer}
.ds-pill button:last-child{border-right:0}
.ds-pill button[aria-pressed="true"]{background:var(--bk-accent);color:var(--stage-black)}
.ds-pill button:disabled{cursor:not-allowed;opacity:.5}
.scs .ds-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));gap:8px}
.scs .ds-cols h4{margin:0;padding:3px 8px;font:700 var(--text-meta) var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--stage-soft);border-bottom:1px solid var(--stage-seam)}
.scs .ds-cols section{border:1px solid var(--stage-seam);background:var(--stage-sunken);min-width:0}
.scs .ds-cols pre{margin:0;padding:8px;max-height:12rem;overflow-y:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:var(--text-control) var(--font-body);color:var(--stage-card)}
.scs .menu .ds-pill{margin:0 12px 8px 40px}
.scs .menu .ds-pill button{display:inline-block;width:auto;min-height:0;padding:4px 10px;border-right:2px solid var(--stage-black);gap:0;font:800 var(--text-meta) var(--font-fancy);letter-spacing:.1em}
.scs .menu .ds-pill button:last-child{border-right:0}
.scs .menu .ds-pill button[aria-pressed="true"]{background:var(--bk-accent);color:var(--stage-black)}
`;
