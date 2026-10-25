/**
 * The Tokens sheet's styles (approved wireframe design/wireframes/props/trackhare.html?state=tokens):
 * a full-stage sheet over the scene, a donut + legend + budget bar side column, and one collapsible
 * card per category in the main column. Class names are all `tok-`-prefixed and distinct from T2a's
 * hare popover/Chains sheet, since every scene style file concats into one global sheet (index.tsx)
 * and nothing here should depend on, or collide with, what T2a names its own classes.
 */
export const TOKENS_STYLE = `
.scs .tok-sheet{position:absolute;inset:24px 96px;z-index:60;background:var(--stage-well);border:1px solid color-mix(in srgb,var(--prop-hare) 40%,transparent);box-shadow:8px 8px 0 var(--stage-black);display:flex;flex-direction:column;font-family:var(--font-big)}
.scs .tok-hd{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--stage-seam)}
.scs .tok-logo{display:flex;flex:none;color:var(--prop-hare)}
.scs .tok-hd b{font-size:1rem;color:var(--stage-card)}
.scs .tok-hd small{font-size: var(--text-body);color:var(--stage-mute)}
.scs .tok-grow{flex:1}
.scs .tok-close{width:28px;height:28px;flex:none;display:grid;place-items:center;border:0;background:none;color:var(--stage-soft);font-size:18px;line-height:1;cursor:pointer;border-radius:0}
.scs .tok-close:hover{background:color-mix(in srgb,var(--stage-card) 8%,transparent);color:var(--stage-card)}
.scs .tok-body{flex:1;min-height:0;display:grid;grid-template-columns:320px 1fr}
.scs .tok-side{border-right:1px solid var(--stage-seam);padding:16px;display:flex;flex-direction:column;gap:16px;overflow:auto}
.scs .tok-donut{position:relative;width:200px;height:200px;margin:0 auto;border-radius:0}
.scs .tok-donut::after{content:"";position:absolute;inset:42px;border-radius:0;background:var(--stage-well)}
.scs .tok-donut b{position:absolute;inset:0;z-index:1;display:grid;place-items:center;text-align:center;font-family:var(--font-mono);font-weight:700;font-size:1.3rem;color:var(--stage-card)}
.scs .tok-donut small{display:block;font-family:var(--font-big);font-weight:500;font-size: var(--text-body);color:var(--stage-mute)}
.scs .tok-leg{display:flex;flex-direction:column;gap:4px}
.scs .tok-legrow{display:flex;width:100%;align-items:center;gap:8px;padding:4px 6px;border:0;background:none;font-size:var(--text-control);color:var(--stage-soft);cursor:grab;text-align:left}
.scs .tok-legrow:hover{background:var(--stage-row)}
.scs .tok-legrow .tok-sw{width:12px;height:12px;flex:none;background:var(--c)}
.scs .tok-legrow .tok-nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scs .tok-legrow em{font-style:normal;font-family:var(--font-mono);font-weight:500;font-size: var(--text-meta);color:var(--stage-mute)}
.scs .tok-legrow .tok-grip{flex:none;color:var(--stage-faint);font-size:.7rem}
.scs .tok-legrow.tok-x{opacity:.45}
.scs .tok-legrow.tok-x .tok-nm{text-decoration:line-through}
.scs .tok-bud small{display:block;font-size: var(--text-body);color:var(--stage-mute);margin-bottom:6px}
.scs .tok-bar{display:flex;height:12px;background:var(--stage-seam)}
.scs .tok-bar i{display:block;height:100%;background:var(--c)}
.scs .tok-bl{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px;margin-top:6px;font-family:var(--font-mono);font-weight:500;font-size: var(--text-meta);color:var(--stage-soft)}
.scs .tok-model{padding:6px 10px;background:var(--stage-row);border:1px solid var(--stage-seam);font-size:.8rem;color:var(--stage-card)}
.scs .tok-main{overflow:auto;padding:14px 16px;display:flex;flex-direction:column;gap:8px}
.scs .tok-note{display:flex;gap:8px;align-items:flex-start;max-width:1020px;margin:0 0 8px;padding:8px 12px;border-left:4px solid var(--stage-danger-text);background:color-mix(in srgb,var(--stage-danger-text) 8%,transparent);font-size:var(--text-body);line-height:1.5;color:var(--stage-soft)}
.scs .tok-cat{border-left:3px solid var(--c);background:var(--stage-panel)}
.scs .tok-ch{display:flex;width:100%;align-items:center;gap:8px;padding:10px 12px;border:0;background:none;font-size:.86rem;font-weight:600;color:var(--stage-card);cursor:pointer;text-align:left}
.scs .tok-ch em{margin-left:auto;font-style:normal;font-family:var(--font-mono);font-weight:500;font-size: var(--text-meta);color:var(--stage-soft)}
.scs .tok-ch svg{flex:none;color:var(--stage-mute);transition:transform .15s}
.scs .tok-ch.tok-closed svg{transform:rotate(-90deg)}
.scs .tok-bkh{padding:6px 12px 2px 32px;font-size: var(--text-meta);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--deck-lorebook)}
.scs .tok-sec{display:flex;align-items:center;gap:10px;padding:7px 12px 7px 32px;border-top:1px solid var(--stage-seam);font-size:var(--text-control);color:var(--stage-text-dim)}
.scs .tok-sec-open{flex:1;min-width:0;text-align:left;border:0;background:none;padding:0;color:inherit;font:inherit;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scs .tok-sec-lbl{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scs .tok-sec em{flex:none;font-style:normal;font-family:var(--font-mono);font-weight:500;font-size: var(--text-meta);color:var(--stage-mute)}
.scs .tok-raw{margin:0 12px 10px 32px;padding:10px;background:var(--stage-black);font-family:var(--font-mono);font-weight:500;font-size:.76rem;line-height:1.5;color:var(--stage-soft);white-space:pre-wrap}
.scs .tok-raw-ft{margin-top:8px;display:flex;justify-content:flex-end}
.scs .tok-ft{display:flex;flex-wrap:wrap;gap:6px;padding:10px 16px;border-top:1px solid var(--stage-seam)}
.scs .tok-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--stage-seam);background:var(--stage-row);color:var(--stage-card);font-size:var(--text-control);cursor:pointer}
.scs .tok-btn:hover{background:color-mix(in srgb,var(--stage-card) 8%,transparent)}
.scs .tok-btn:disabled{opacity:.4;cursor:default}
@container (max-width:1023px){
.scs .tok-sheet{inset:12px}
.scs .tok-body{grid-template-columns:1fr}
.scs .tok-side{border-right:0;border-bottom:1px solid var(--stage-seam)}
}
`;
