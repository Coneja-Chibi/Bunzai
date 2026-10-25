/**
 * TrackHare's own styles (approved wireframe design/wireframes/props/trackhare.html, states `stage`,
 * `panel`, `miss`, `chains`, `settings`): the stage button and badge, the popover, the options card,
 * and the full-stage sheet frame Chains and Tokens both use (`.sheet`/`.sh-hd`/`.sh-ft` - this file
 * owns that shared frame; Tokens' own inner classes are tokens-style.ts's, T2b's). Every class not
 * already unique to TrackHare (`.r`, `.tags`, `.tk`) is scoped under a TrackHare parent so it cannot
 * collide with another scene sheet once every style joins in one sheet (the trap lore-style.ts
 * records). Registered in scenes/index.tsx alongside the other scene style sheets.
 */
export const HARE_STYLE = `
.scs .hare-btn{position:absolute;z-index:44;display:grid;place-items:center;background:var(--stage-panel);border:1px solid color-mix(in srgb,var(--prop-hare) 45%,transparent);color:var(--prop-hare);cursor:pointer;box-shadow:4px 4px 0 var(--stage-black);touch-action:none}
.scs .hare-btn .n{position:absolute;top:-8px;right:-8px;min-width:20px;height:20px;padding:0 5px;display:grid;place-items:center;background:var(--prop-hare);color:var(--stage-black);font:700 11px var(--font-mono)}
.scs .hare-btn .rh{position:absolute;bottom:-4px;right:-4px;width:12px;height:12px;border-radius:0;background:var(--prop-hare);cursor:se-resize;touch-action:none}
.scs .hare-pop{position:absolute;z-index:44;width:min(440px,calc(100% - 32px));max-height:calc(100% - 150px);overflow:auto;background:var(--stage-panel);border:1px solid color-mix(in srgb,var(--prop-hare) 40%,transparent);box-shadow:6px 6px 0 var(--stage-black);font-family:var(--font-big);animation:hare-in .15s ease-out}
.scs .hp-hd{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--stage-seam)}
.scs .hp-hd svg.logo{color:var(--prop-hare)}
.scs .hp-hd b{font-size:.92rem;color:var(--stage-card)}
.scs .hp-hd .cnt{font: 600 var(--text-meta) var(--font-mono);color:var(--stage-black);background:var(--prop-hare);padding:1px 6px}
.scs .hp-hd .grow{flex:1}
.scs .hp-hd .close{border:0;background:none;color:var(--stage-soft);cursor:pointer;display:grid;place-items:center}
.scs .seg2{display:inline-flex;border:1px solid var(--stage-seam)}
.scs .seg2 button{padding:3px 8px;font-size: var(--text-control);color:var(--stage-mute);cursor:pointer;border:0;background:none;font-family:inherit}
.scs .seg2 button.on{background:var(--stage-row);color:var(--stage-card)}
.scs .hp-sub{display:flex;justify-content:space-between;padding:6px 12px;font: 500 var(--text-meta) var(--font-mono);color:var(--stage-mute);letter-spacing:.06em;text-transform:uppercase;border-bottom:1px solid var(--stage-seam)}
.scs .bkh{display:flex;align-items:center;gap:6px;padding:8px 12px 4px;font-size: var(--text-meta);font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--deck-lorebook)}
.scs .he{margin:4px 10px;padding:8px 10px;background:var(--stage-row);border:0;border-left:3px solid var(--c);width:calc(100% - 20px);display:grid;grid-template-columns:18px 1fr auto;gap:8px;align-items:start;cursor:pointer;text-align:left;color:inherit;font-family:inherit}
.scs .he:hover{background:color-mix(in srgb,var(--stage-row) 70%,var(--stage-card) 6%)}
.scs .he>svg{color:var(--c);margin-top:2px}
.scs .he b{display:block;font-size:.86rem;font-weight:600;color:var(--stage-card)}
.scs .he .rs{display:inline-block;margin-top:4px;padding:1px 6px;font: 600 var(--text-meta) var(--font-mono);color:var(--c)}
.scs .he .rs+.rs{margin-left:4px;color:var(--stage-warn)}
.scs .he .tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.scs .he .tags span{font-size: var(--text-meta);padding:1px 5px;color:var(--stage-soft);background:color-mix(in srgb,var(--stage-black) 40%,transparent)}
.scs .he .tk{font: 500 var(--text-meta) var(--font-mono);color:var(--stage-mute)}
.scs.compact .he .tags,.scs.compact .he .tk{display:none}
.scs .hare-miss{margin:8px 10px 4px;border:1px dashed var(--stage-seam)}
.scs .hare-miss .mh{display:flex;width:100%;justify-content:space-between;padding:8px 10px;font-size: var(--text-control);font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--stage-soft);border:0;background:none;cursor:pointer;font-family:inherit}
.scs .hare-miss .mi{display:grid;grid-template-columns:1fr auto;gap:8px;padding:6px 10px;border-top:1px solid var(--stage-seam);font-size:.82rem;color:var(--stage-text-dim)}
.scs .hare-miss .mi em{font-style:normal;font: 500 var(--text-meta) var(--font-mono);color:var(--stage-mute)}
.scs .hp-ft{display:flex;gap:6px;padding:10px 12px;border-top:1px solid var(--stage-seam);position:sticky;bottom:0;background:var(--stage-panel)}
.scs .hbtn{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;font-size: var(--text-control);color:var(--stage-card);background:var(--stage-row);border:1px solid var(--stage-seam);cursor:pointer;font-family:inherit}
.scs .hbtn:disabled{opacity:.4;cursor:default}
.scs .hbtn.pri{background:var(--prop-hare);color:var(--stage-black);border-color:var(--prop-hare)}
.scs .hbtn.pri svg{color:var(--stage-black)}
.scs .hbtn svg{color:var(--prop-hare)}
.scs .hare-replies{padding:8px 12px;display:flex;flex-direction:column;gap:4px}
.scs .hare-replies button{text-align:left;padding:6px 8px;border:0;background:none;color:var(--stage-card);cursor:pointer;font:var(--text-control) var(--font-big)}
.scs .hare-replies button:hover{background:var(--stage-row)}
.scs .hare-none{padding:20px 16px;color:var(--stage-mute);font-size:.86rem}
.scs .hare-none .hint{display:block;margin-top:6px;font-size: var(--text-body);color:var(--stage-mute)}
.scs .hare-err{padding:10px 12px;color:var(--stage-danger-text);font-size:.8rem}

.scs .cfg{position:absolute;z-index:44;width:300px;background:var(--stage-panel);border:1px solid color-mix(in srgb,var(--prop-hare) 40%,transparent);box-shadow:6px 6px 0 var(--stage-black);font-family:var(--font-big);animation:hare-in .15s ease-out}
.scs .cfg .r{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;border-top:1px solid var(--stage-seam);font-size:.84rem;color:var(--stage-card)}
.scs .cfg .r small{display:block;font-size: var(--text-body);color:var(--stage-mute)}
.scs .cfg select{padding:5px 8px;background:var(--stage-row);border:1px solid var(--stage-seam);font: var(--text-control) var(--font-big);color:var(--stage-card)}

.scs .sheet{position:absolute;inset:24px 96px;z-index:60;background:var(--stage-well);border:1px solid color-mix(in srgb,var(--prop-hare) 40%,transparent);box-shadow:8px 8px 0 var(--stage-black);display:flex;flex-direction:column;font-family:var(--font-big);animation:hare-in .15s ease-out}
.scs .sh-hd{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--stage-seam)}
.scs .sh-hd b{font-size:1rem;color:var(--stage-card)}
.scs .sh-hd small{font-size: var(--text-body);color:var(--stage-mute)}
.scs .sh-hd .grow{flex:1}
.scs .sh-ft{display:flex;gap:6px;padding:10px 16px;border-top:1px solid var(--stage-seam)}

.scs .chains{padding:16px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.scs .cg{border-top:3px solid var(--c)}
.scs .cg h4{padding:10px 12px 4px;font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;color:var(--c)}
.scs .cg p{padding:0 12px 8px;font-size: var(--text-body);color:var(--stage-mute)}
.scs .cg .cl{padding:8px 12px;border-top:1px solid var(--stage-seam);font-size:.82rem;color:var(--stage-card)}
.scs .cg .cl small{display:block;margin-top:3px;font-size: var(--text-body);color:var(--stage-soft)}
.scs .cg .none{padding:8px 12px;font-size:.78rem;color:var(--stage-mute)}

@keyframes hare-in{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion: reduce){
.scs .hare-pop,.scs .cfg,.scs .sheet{animation:none}
}
`;
