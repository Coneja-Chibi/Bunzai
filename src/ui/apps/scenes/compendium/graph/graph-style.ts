/**
 * The Cross-Reference Graph explorer and its Dashboard cell's explore affordances (RoleCall `GraphExploreModal.tsx`,
 * `BentoDashboard.tsx:1900-1927`). The explorer is a modal sheet portaled to the body by InkDialog, so its rules sit under `.cp-gx`
 * and name only global tokens; the cell's sit under `.scs`. Sizes follow RoleCall (260px side and detail columns, 32px zoom buttons,
 * the sheet up to 1600 by 940) with RoleCall's own type sizes; the sheet answers to its own width (`@container`).
 */
export const GRAPH_STYLE = `
.scs .cp-gwrap{cursor:pointer}
.scs .cp-gbtn{display:none}
@container (max-width:600px){.scs .cp-gwrap{display:none}.scs .cp-gbtn{display:block}}
.cp-gx.cp-gx{container-type:inline-size;display:grid;grid-template-rows:auto 1fr auto;width:100%;height:100%;max-width:1600px;max-height:940px;padding:0;overflow:hidden;background:var(--bk-surface-well);color:var(--bk-text);font-family:var(--font-ui)}
.cp-gx .gx-hd{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;border-bottom:1px solid var(--bk-line-track)}
.cp-gx .gx-hd .l{display:flex;align-items:center;gap:16px;min-width:0}
.cp-gx .gx-hd small{display:block;font:700 9px var(--font-fancy);letter-spacing:.25em;text-transform:uppercase;color:var(--bk-text-dim)}
.cp-gx .gx-hd h3{margin:2px 0 0;font:700 18px var(--font-fancy);color:var(--bk-role-brand-text)}
.cp-gx .gx-hd h3 i{margin-left:10px;font:italic 400 13px var(--font-ui);color:var(--bk-text-dim)}
.cp-gx .gx-body{display:grid;grid-template-columns:260px 1fr;min-height:0;overflow:hidden}
.cp-gx .gx-side{display:flex;flex-direction:column;gap:20px;padding:16px;overflow-y:auto;background:var(--bk-surface-base);border-right:1px solid var(--bk-line-track)}
.cp-gx .fg{display:flex;align-items:center;gap:6px;margin-bottom:8px;font:700 9px var(--font-fancy);letter-spacing:.15em;text-transform:uppercase;color:var(--bk-text-dim)}
.cp-gx .fg span{color:var(--bk-role-brand-text);opacity:.6}
.cp-gx .gx-side input{width:100%;padding:8px 10px;border:1px solid var(--bk-line-control);background:var(--bk-surface-field);color:var(--bk-text);font:11px var(--font-ui)}
.cp-gx .hint{margin-top:6px;font:700 8px var(--font-fancy);letter-spacing:.1em;text-transform:uppercase;color:var(--bk-text-dim)}
.cp-gx .dot{flex:none;width:8px;height:8px;border-radius:50%;opacity:.4}
.cp-gx [aria-pressed=true] .dot{opacity:1}
.cp-gx .sw{flex:none;width:20px;height:0;opacity:.4}
.cp-gx [aria-pressed=true] .sw{opacity:.9}
.cp-gx .box{flex:none;width:8px;height:8px;border:1px solid var(--bk-line-control)}
.cp-gx .gx-stage{position:relative;min-width:0;overflow:hidden;background:radial-gradient(circle,color-mix(in srgb,var(--bk-text) 5%,transparent) 1px,transparent 1px) 0 0/36px 36px,var(--bk-surface-well)}
.cp-gx .gx-svg{position:absolute;inset:0;width:100%;height:100%;cursor:grab;touch-action:none}
.cp-gx .ln line{stroke:var(--ek);stroke-width:1.3;opacity:.45}
.cp-gx .ln.on line{stroke-width:2;opacity:.85}
.cp-gx .ln.dim line{opacity:.1}
.cp-gx .ln text{font:italic 12px var(--font-ui);fill:var(--bk-text-dim);text-anchor:middle}
.cp-gx .gn{cursor:pointer}
.cp-gx .gn:focus{outline:none}
.cp-gx .gn:focus-visible .body{stroke:var(--bk-role-warn);stroke-width:3}
.cp-gx .gn.dim{opacity:.25}
.cp-gx .gn .body{fill:var(--bk-surface-sunken);stroke:color-mix(in srgb,var(--tc) 60%,transparent);stroke-width:2}
.cp-gx .gn.sel .body{stroke:var(--tc)}
.cp-gx .gn .halo{fill:color-mix(in srgb,var(--tc) 13%,transparent)}
.cp-gx .gn .ring{fill:none;stroke:var(--bk-role-warn);stroke-width:1.5;stroke-dasharray:4 3}
.cp-gx .gn .ini{font:600 12px var(--font-fancy);fill:var(--tc);text-anchor:middle}
.cp-gx .gn .nm{font:600 12px var(--font-fancy);fill:var(--bk-text-dim);text-anchor:middle}
.cp-gx .gn.sel .nm{fill:var(--bk-role-warn-text)}
.cp-gx .gx-none{position:absolute;inset:0;display:grid;place-items:center;margin:0;pointer-events:none;font:italic 14px var(--font-ui);color:var(--bk-text-dim)}
.cp-gx .gx-detail{position:absolute;top:0;right:0;bottom:0;z-index:2;display:flex;flex-direction:column;gap:14px;width:260px;padding:20px;background:color-mix(in srgb,var(--bk-surface-base) 97%,transparent);border-left:1px solid var(--bk-line-track)}
.cp-gx .gx-detail .chip{display:inline-block;border-radius:var(--rc-radius-sm);padding:2px 8px;border:1px solid color-mix(in srgb,var(--tc) 35%,transparent);background:color-mix(in srgb,var(--tc) 8%,transparent);color:var(--tc);font:700 8px var(--font-fancy);letter-spacing:.2em;text-transform:uppercase}
.cp-gx .gx-detail h4{margin:4px 0 0;font:700 20px/1.2 var(--font-fancy);color:var(--bk-role-brand-text)}
.cp-gx .gx-detail .rule{height:1px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--bk-role-brand-text) 40%,transparent),transparent)}
.cp-gx .gx-detail .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid color-mix(in srgb,var(--bk-text) 4%,transparent);font:10px var(--font-fancy);letter-spacing:.08em;text-transform:uppercase;color:var(--bk-text-dim)}
.cp-gx .gx-detail .row b{color:var(--ek,var(--bk-role-brand-text))}
.cp-gx .gx-detail .conn{flex:1;min-height:0;overflow-y:auto}
.cp-gx .gx-detail .cap{margin-bottom:8px;font:700 8px var(--font-fancy);letter-spacing:.2em;text-transform:uppercase;color:var(--bk-text-dim)}
.cp-gx .gx-detail .conn .dot{width:6px;height:6px;background:var(--ek);opacity:1}
.cp-gx .gx-detail .conn small{color:var(--ek)}
.cp-gx .gx-detail .none{margin:0;font:italic 12px var(--font-ui);color:var(--bk-text-dim)}
.cp-gx .gx-zoom{position:absolute;left:20px;bottom:20px;z-index:3;display:flex;flex-direction:column;gap:2px}
.cp-gx .gx-status{display:flex;flex-wrap:wrap;align-items:center;gap:6px 20px;padding:8px 20px;border-top:1px solid var(--bk-line-track);background:var(--bk-surface-base);font:700 9px var(--font-fancy);letter-spacing:.12em;text-transform:uppercase;color:var(--bk-text-dim)}
.cp-gx .gx-status b{color:var(--bk-text-soft)}
.cp-gx .gx-status b.hot{color:var(--bk-role-brand-text)}
.cp-gx .gx-status .grow{flex:1}
@container (max-width:700px){.cp-gx .gx-body{grid-template-columns:1fr;grid-template-rows:auto 1fr}.cp-gx .gx-side{max-height:30vh;border-right:0;border-bottom:1px solid var(--bk-line-track)}.cp-gx .gx-detail{width:min(260px,70%)}.cp-gx .gx-hd h3 i,.cp-gx .gx-status .how{display:none}}
`;
