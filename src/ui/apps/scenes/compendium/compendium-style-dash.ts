/**
 * The Compendium Dashboard (RoleCall `BentoDashboard.tsx`, pixel for pixel): the header, the World Concepts rail, the Of Note
 * strip, and the masonry of cells (CSS columns, 3 / 2 / 1 by the pane's width) with RoleCall's 3px frame and offset shadow.
 * Each type's colour arrives as `--tc`, a theme token from the core's type table, so a theme and the accent still apply.
 * Type is RoleCall's own, 9 to 11px included. Container queries only.
 */
export const COMPENDIUM_DASH_STYLE = `
.scs .cp-body{flex:none}
.scs .cp-body.full{height:100cqh;min-height:420px;display:flex;flex-direction:column}
.scs .cp-dash{margin:20px;padding:24px;border:1px solid color-mix(in srgb,var(--wa) 20%,transparent);background:var(--stage-well);color:var(--stage-soft)}
.scs .cp-dh{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:12px;padding-bottom:18px;margin-bottom:20px;border-bottom:1px solid color-mix(in srgb,var(--wa) 15%,transparent)}
.scs .cp-dh .lh{flex:1;min-width:0}
.scs .crumb2{display:flex;flex-wrap:wrap;gap:8px;font:400 11px var(--font-fancy);letter-spacing:.2em;text-transform:uppercase;color:var(--stage-mute)}
.scs .crumb2 .cur{color:var(--wa)}
.scs .cp-dh h1{margin:8px 0 0;font:900 2.6rem/1.05 var(--font-fancy);color:var(--wa);text-shadow:4px 4px 0 var(--stage-black);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scs .cp-dh .rh{text-align:right;font:11px var(--font-fancy);letter-spacing:.25em;color:var(--stage-mute)}
.scs .cp-dh .rh>div+div{margin-top:4px}
.scs .cp-dh .acts{display:flex;justify-content:flex-end;gap:8px;margin-top:8px;letter-spacing:0}
.scs .cp-exp-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:3px solid var(--wa);background:var(--stage-black);color:var(--wa);font:700 11px var(--font-fancy);letter-spacing:.1em;text-transform:uppercase;box-shadow:3px 3px 0 0 var(--stage-black);cursor:pointer;transition:transform .15s,box-shadow .15s}
.scs .cp-exp-btn:hover:not(:disabled){transform:translate(-2px,-2px);box-shadow:6px 6px 0 0 var(--wa)}
.scs .cp-exp-btn:disabled{opacity:.5;cursor:default}
.scs .cp-lock{flex:none;display:flex;align-items:center;gap:8px;padding:6px 16px;border-bottom:1px solid var(--wa-line);background:var(--wa-soft);font-size:14px;color:var(--wa)}
.scs .cp-lock span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@container (max-width:600px){.scs .cp-dash{margin:12px;padding:12px}.scs .cp-dh .rh{text-align:left;width:100%}.scs .cp-dh h1{font-size:1.5rem}.scs .cp-dh .acts{justify-content:flex-start}}
.scs .cp-cell{position:relative;overflow:hidden;margin-bottom:14px;break-inside:avoid;padding:16px 18px;border:3px solid var(--stage-black);background:var(--stage-panel);box-shadow:3px 3px 0 0 var(--stage-black);transition:transform .15s,box-shadow .15s}
.scs .cp-cell:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 0 var(--stage-black)}
.scs .cp-cell .ct{display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid var(--stage-black);font:700 11px var(--font-fancy);letter-spacing:.22em;text-transform:uppercase;color:var(--wa)}
.scs .cp-cell .ct .dot{width:8px;height:8px;flex:none;border:1px solid var(--stage-black)}
.scs .cp-cell .ct .st{font-size:10px}
.scs .cp-empty{font-size:11px;color:var(--stage-text-dim)}
.scs .cp-hit{display:block;width:100%;padding:0;border:0;background:none;text-align:left;color:inherit;cursor:pointer}
.scs .cp-hit:hover,.scs .cp-of:not(:disabled):hover{background:color-mix(in srgb,var(--stage-card) 3%,transparent)}
.scs .cp-hit small{font-size:11px;color:var(--stage-soft)}
.scs .cp-rail{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;overscroll-behavior-x:contain}
.scs .cp-rail .chip{flex:none;width:auto;min-width:140px;max-width:200px;padding:8px 12px;border:2px solid var(--stage-black);background:color-mix(in srgb,var(--tc) 8%,transparent);box-shadow:2px 2px 0 0 var(--stage-black)}
.scs .cp-rail .chip b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:700 11px var(--font-fancy);letter-spacing:.1em;color:var(--tc)}
.scs .cp-rail .chip small{display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:10px var(--font-mono);letter-spacing:.05em;text-transform:uppercase;color:var(--stage-soft)}
.scs .cp-rail .more{flex:none;align-self:center;padding:0 8px;font:10px var(--font-fancy);letter-spacing:.1em;text-transform:uppercase;color:var(--stage-mute)}
.scs .cp-note3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:14px 0 16px}
@container (max-width:900px){.scs .cp-note3{grid-template-columns:1fr}}
.scs .cp-of{display:flex;flex-direction:column;min-height:110px;padding:12px 16px;border:3px solid var(--stage-black);background:color-mix(in srgb,var(--tc) 8%,transparent);box-shadow:3px 3px 0 0 var(--stage-black);text-align:left;color:inherit;cursor:pointer;transition:transform .15s,box-shadow .15s}
.scs .cp-of:not(:disabled):hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 0 var(--tc)}
.scs .cp-of:disabled{cursor:default}
.scs .cp-of .k{font:700 10px var(--font-fancy);letter-spacing:.1em;color:var(--tc)}
.scs .cp-of .n{margin-top:4px;font:400 16px/1.2 var(--font-fancy);text-transform:uppercase;color:var(--stage-card)}
.scs .cp-of .t{margin-top:4px;font-size:14px;line-height:1.35;color:var(--stage-card)}
.scs .cp-of .f{margin-top:auto;padding-top:8px;font-size:11px;color:var(--stage-mute)}
.scs .cp-masonry{column-gap:14px;column-count:3}
@container (max-width:900px){.scs .cp-masonry{column-count:2}}
@container (max-width:600px){.scs .cp-masonry{column-count:1}}
.scs .cp-cast{display:flex;align-items:flex-start;gap:16px}
.scs .cp-cast .por{width:86px;height:112px;flex:none;display:grid;place-items:center;border:3px solid var(--stage-black);background:color-mix(in srgb,var(--tc) 25%,var(--stage-black));box-shadow:4px 4px 0 0 var(--stage-black);font:900 1.5rem var(--font-fancy);color:var(--tc);cursor:pointer}
.scs .cp-cast .bd{flex:1;min-width:0}
.scs .cp-cast .sub{font:11px var(--font-fancy);letter-spacing:.1em;color:var(--stage-mute)}
.scs .cp-cast .nm{display:block;padding:0;border:0;background:none;text-align:left;margin-top:4px;font:900 1.7rem/1.1 var(--font-fancy);color:var(--tc);text-shadow:3px 3px 0 var(--stage-black);cursor:pointer}
.scs .cp-cast .tg{font-size:15px;line-height:1.6;color:var(--stage-card)}
.scs .cp-cast .rule{height:1px;margin:12px 0;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--wa) 40%,transparent),transparent)}
.scs .cp-cast .ar{margin-bottom:4px;font:700 12px var(--font-fancy);letter-spacing:.1em;color:var(--wa)}
.scs .cp-cast .dots{display:flex;align-items:center;gap:4px}
.scs .cp-cast .seg{display:contents}
.scs .cp-cast .dots i{width:8px;height:8px;flex:none;border-radius:50%;background:color-mix(in srgb,var(--wa) 70%,transparent)}
.scs .cp-cast .dots i.cur{width:10px;height:10px;background:var(--wa);box-shadow:0 0 8px color-mix(in srgb,var(--wa) 70%,transparent)}
.scs .cp-cast .dots u{flex:1;height:1px;background:color-mix(in srgb,var(--wa) 40%,transparent)}
.scs .cp-cast .now{margin-top:4px;font-size:12px;color:var(--wa)}
.scs .cp-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:16px}
.scs .cp-tiles>div{padding:8px;text-align:center;border:2px solid var(--stage-black);background:color-mix(in srgb,var(--stage-black) 35%,transparent);box-shadow:2px 2px 0 0 var(--stage-black)}
.scs .cp-tiles .l{display:block;font:10px var(--font-fancy);letter-spacing:.1em;color:var(--stage-mute)}
.scs .cp-tiles .v{display:block;font:400 1.125rem var(--font-fancy);color:var(--wa)}
.scs .cp-counts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.scs .cp-counts>div{padding:8px 4px;text-align:center;border:2px solid var(--stage-black);background:color-mix(in srgb,var(--stage-black) 35%,transparent);box-shadow:2px 2px 0 0 var(--stage-black)}
.scs .cp-counts .v{display:block;font:400 1.25rem var(--font-fancy);color:var(--tc)}
.scs .cp-counts .l{display:block;font:10px var(--font-fancy);letter-spacing:.15em;text-transform:uppercase;color:var(--stage-mute)}
.scs .cp-rw{padding:0 0 0 8px;margin-bottom:8px;border-left:2px solid var(--tc);font-size:11px;color:var(--stage-card)}
.scs .cp-rw .when{display:block;color:var(--stage-mute)}
.scs .cp-plot{margin-bottom:12px;font-size:11px}
.scs .cp-plot .r,.scs .cp-threat .r{display:flex;justify-content:space-between;align-items:center;gap:8px}
.scs .cp-plot .n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-fancy);color:var(--stage-card)}
.scs .cp-plot .badge{flex:none;padding:2px 8px;border:2px solid var(--tc);background:var(--stage-black);font:700 .6rem var(--font-ui);letter-spacing:.14em;text-transform:uppercase;color:var(--tc)}
.scs .cp-threat{margin-bottom:10px;font-size:11px}
.scs .cp-threat .n{color:var(--stage-card)}
.scs .cp-threat .sev{font:11px var(--font-fancy);letter-spacing:.1em}
.scs .cp-threat.danger{--sv:var(--bk-role-danger-text)}.scs .cp-threat.warn{--sv:var(--bk-role-warn-text)}.scs .cp-threat.mid{--sv:var(--bk-role-warn-text)}
.scs .cp-threat .sev{color:var(--sv)}
.scs .cp-threat .bar{display:block;height:3px;margin-top:4px;border:1px solid var(--stage-black);background:var(--stage-black);overflow:hidden}
.scs .cp-threat .bar span{display:block;height:100%;background:var(--sv)}
.scs .cp-tree{max-height:260px;overflow-y:auto;font:11px/1.6 var(--font-mono);color:var(--stage-card)}
.scs .cp-tree .tn{color:var(--wa);user-select:none}
.scs .cp-tree .tn.go{cursor:pointer}
.scs .cp-tree .te{display:block;width:100%;padding:0;border:0;background:none;text-align:left;color:var(--stage-card);cursor:pointer;font:inherit}
.scs .cp-tree .te:hover{color:var(--wa)}
.scs .cp-open{width:100%;margin-top:8px;padding:6px 0;border:2px solid var(--wa);background:var(--stage-black);box-shadow:2px 2px 0 0 var(--stage-black);font:700 11px var(--font-fancy);letter-spacing:.1em;color:var(--wa);cursor:pointer}
.scs .cp-recaps{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.scs .cp-recaps .g{padding:10px;border:2px solid var(--stage-black);background:color-mix(in srgb,var(--tc) 6%,transparent);box-shadow:2px 2px 0 0 var(--stage-black)}
.scs .cp-recaps .h{font:700 11px var(--font-fancy);letter-spacing:.1em;color:var(--tc)}
.scs .cp-recaps .row{display:flex;gap:8px;margin-top:6px;padding:0 4px;font-size:13px;line-height:1.35}
.scs .cp-recaps .row i{flex:none;font:10px var(--font-mono);color:var(--stage-mute)}
.scs .cp-recaps .row span{font-style:italic;color:var(--stage-card)}
.scs .cp-graph{display:block;width:100%;height:192px}
.scs .cp-graph .ed{stroke:var(--stage-line);stroke-width:1}
.scs .cp-graph g{cursor:pointer}
.scs .cp-graph circle{fill:color-mix(in srgb,var(--tc) 12%,var(--stage-black));stroke:color-mix(in srgb,var(--tc) 55%,transparent)}
.scs .cp-graph text{text-anchor:middle;font:600 8px var(--font-fancy);fill:var(--tc)}
.scs .cp-gnote{margin-top:4px;text-align:center;font-size:11px;color:var(--stage-card)}
.scs .cp-spot .n{display:block;font:900 1.2rem/1.2 var(--font-fancy);text-transform:uppercase;color:var(--tc);text-shadow:2px 2px 0 var(--stage-black)}
.scs .cp-spot .t{display:block;margin-top:4px;font-size:14px;font-style:italic;color:var(--stage-card)}
.scs .cp-spot .d{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin-top:8px;font-size:.84rem;line-height:1.35;color:var(--stage-soft)}
.scs .cp-spot .p{display:block;margin-top:8px;font:10px var(--font-mono);letter-spacing:.05em;color:var(--stage-mute)}
.scs .cp-creature{display:flex;align-items:flex-start;gap:16px}
.scs .cp-creature .por{width:76px;height:96px;flex:none;display:grid;place-items:center;border:3px solid var(--stage-black);background:color-mix(in srgb,var(--tc) 25%,var(--stage-black));box-shadow:4px 4px 0 0 var(--stage-black);font:900 1.25rem var(--font-fancy);color:var(--tc)}
.scs .cp-creature .bd{flex:1;min-width:0}
.scs .cp-creature .n{display:block;font:900 1.3rem/1.2 var(--font-fancy);color:var(--tc);text-shadow:2px 2px 0 var(--stage-black)}
.scs .cp-creature .t{display:block;margin-top:4px;font-size:14px;font-style:italic;color:var(--stage-card)}
.scs .cp-creature .tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.scs .cp-creature .tags b{padding:2px 6px;border:2px solid var(--stage-black);background:color-mix(in srgb,var(--stage-black) 40%,transparent);font:700 10px var(--font-fancy);letter-spacing:.1em;text-transform:uppercase;color:var(--stage-soft)}
.scs .cp-creature .tags b:first-child{background:color-mix(in srgb,var(--tc) 10%,transparent);color:var(--tc)}
.scs .cp-creature .d{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:8px;font-size:11px;color:var(--stage-card)}
.scs .cp-creature .ft{flex:none;text-align:right;font:11px var(--font-fancy);letter-spacing:.1em;color:var(--stage-mute)}
.scs .cp-creature .ft small{display:block;margin-top:2px;color:var(--stage-mute)}
`;
