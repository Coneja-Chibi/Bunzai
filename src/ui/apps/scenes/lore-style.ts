/**
 * The World wing's Lorebook tab, shell and lists (RoleCall's LorebookPanel, pixel for pixel): the
 * header row, the Active lorebooks column, the entries panel (action row, search, grouped virtual
 * list, the row "..." menu) and the pickers. Sizes, radii and fonts are RoleCall's own Tailwind values (plan 19: the default theme is RoleCall,
 * so no type floor). RoleCall's colors map to roles so a theme and
 * the scene accent still apply: its amber world highlight is `--wa` (the scene accent), purple is the
 * select role, green ok, blue action, red danger, cyan info. Every class is `wl-` prefixed: the wing
 * shares one scene stylesheet. The editor's own styles are in lore-style-entry.ts.
 */
export const LORE_STYLE = `
.scs .wl{--wa:var(--bk-scene-accent-text,var(--bk-role-brand-text));--wa-soft:color-mix(in srgb,var(--wa) 12%,transparent);--wa-line:color-mix(in srgb,var(--wa) 40%,transparent);--wl-k:var(--stage-black);--wl-raised:var(--bk-surface-raised);--wl-panel:var(--stage-panel);--wl-sunk:var(--stage-sunken);--wl-faint:color-mix(in srgb,var(--stage-card) 5%,transparent);--wl-rule:color-mix(in srgb,var(--stage-card) 10%,transparent);--v:var(--bk-role-select-text);--v-fill:color-mix(in srgb,var(--bk-role-select) 15%,transparent);--v-line:color-mix(in srgb,var(--bk-role-select) 30%,transparent);--g:var(--bk-role-ok-text);--g-fill:color-mix(in srgb,var(--bk-role-ok) 15%,transparent);--g-line:color-mix(in srgb,var(--bk-role-ok) 30%,transparent);--b:var(--bk-role-action-text);--b-fill:color-mix(in srgb,var(--bk-role-action) 15%,transparent);--b-line:color-mix(in srgb,var(--bk-role-action) 40%,transparent);--r:var(--bk-role-danger-text);--r-fill:color-mix(in srgb,var(--bk-role-danger) 15%,transparent);--r-line:color-mix(in srgb,var(--bk-role-danger) 30%,transparent);--c:var(--bk-role-info-text);--c-fill:color-mix(in srgb,var(--bk-role-info) 10%,transparent);--c-line:color-mix(in srgb,var(--bk-role-info) 25%,transparent);position:relative;flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:var(--stage-well);color:var(--stage-soft);font-family:var(--font-ui);scrollbar-width:thin;scrollbar-color:var(--stage-line) transparent}
.scs .wl :where(button,input,select,textarea){font:inherit}
.scs .wl-hd{flex:none;display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:3px solid var(--wl-k);background:var(--wl-panel)}
.scs .wl-sq{width:28px;height:28px;flex:none;display:grid;place-items:center;border:2px solid var(--wl-k);background:var(--wl-raised);color:var(--stage-card);box-shadow:2px 2px 0 var(--wl-k);cursor:pointer;transition:transform .1s,box-shadow .1s}
.scs .wl-sq:hover{transform:translate(-2px,-2px);box-shadow:3px 3px 0 var(--wl-k)}
.scs .wl-ic{width:28px;height:28px;flex:none;display:grid;place-items:center;border:2px solid var(--wa);color:var(--wa)}
.scs .wl-tt{flex:1;min-width:0;display:flex;align-items:baseline;gap:8px}
.scs .wl-t{font:800 .92rem var(--font-fancy);letter-spacing:.02em;text-transform:uppercase;color:var(--stage-card);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:2px 2px 0 var(--wl-k)}
.scs .wl-st{font:.62rem var(--font-mono);color:var(--stage-mute);white-space:nowrap}
.scs .wl-body{position:relative;z-index:1;flex:1;min-width:0;min-height:0;display:flex;overflow:hidden}
.scs .wl-books{width:240px;flex:none;display:flex;flex-direction:column;background:var(--wl-panel);border-right:3px solid var(--wl-k)}
.scs .wl-bh{display:flex;align-items:center;justify-content:space-between;gap:4px;padding:8px 12px;border-bottom:2px solid var(--wl-k)}
.scs .wl-bh span:first-child{font:700 .62rem var(--font-ui);letter-spacing:.14em;text-transform:uppercase;color:var(--stage-mute)}
.scs .wl-bh span:last-child{font:700 .72rem var(--font-mono);color:var(--wa)}
.scs .wl-bl{flex:1;min-height:0;overflow-y:auto}
.scs .wl-bk{margin:4px 8px;border-radius:var(--rc-radius-sm);padding:8px 12px;cursor:pointer;border:1px solid var(--wl-faint);background:color-mix(in srgb,var(--wl-raised) 50%,transparent);transition:background .15s,border-color .15s}
.scs .wl-bk:hover{background:var(--wl-raised);border-color:var(--wl-rule)}
.scs .wl-bk.sel{border-color:var(--wa-line);background:var(--wa-soft)}
.scs .wl-bk.off{opacity:.5}
.scs .wl-bk.missing{cursor:default}
.scs .wl-bk-r{display:flex;align-items:center;gap:8px}
.scs .wl-bk .dot{width:8px;height:8px;flex:none;border-radius:50%;background:var(--stage-mute)}
.scs .wl-bk .dot.on{background:var(--wa);opacity:.6}
.scs .wl-bk.sel .dot.on{opacity:1;animation:wlPulse 2s ease-in-out infinite}
@keyframes wlPulse{50%{opacity:.5}}
.scs .wl-bn{flex:1;min-width:0;font:600 14px/20px var(--font-ui);color:var(--stage-card);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.scs .wl-bk.sel .wl-bn,.scs .wl-bk.sel .wl-bc,.scs .wl-bk.sel .wl-by{color:var(--wa)}
.scs .wl-bc{font-size:13.12px;color:var(--stage-soft)}
.scs .wl-by{margin-left:16px;font-size:13.12px;color:var(--stage-mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.scs .wl-act{display:flex;justify-content:flex-end;gap:4px;margin-top:6px;opacity:0;transition:opacity .15s}
.scs .wl-bk:hover .wl-act,.scs .wl-bk:focus-within .wl-act{opacity:1}
@media (hover:none){.scs .wl-act{opacity:1}}
.scs .wl-ab{width:20px;height:20px;display:grid;place-items:center;border:0;border-radius:var(--rc-radius);background:none;color:var(--stage-soft);cursor:pointer}
.scs .wl-ab:hover{background:color-mix(in srgb,var(--stage-line) 50%,transparent)}
.scs .wl-ab.on{color:var(--g)}
.scs .wl-ab.on:hover{background:var(--g-fill)}
.scs .wl-ab.red{color:color-mix(in srgb,var(--r) 60%,transparent)}
.scs .wl-ab.red:hover{color:var(--r);background:var(--r-fill)}
.scs .wl-none{display:flex;flex-direction:column;align-items:center;padding:32px 16px;text-align:center}
.scs .wl-none .box{width:48px;height:48px;display:grid;place-items:center;margin-bottom:12px;border:2px solid var(--wa);background:var(--wa-soft);color:var(--wa)}
.scs .wl-none b{font:700 14px/20px var(--font-ui);letter-spacing:.1em;text-transform:uppercase;color:var(--stage-card)}
.scs .wl-none small{margin-top:4px;font-size:13.12px;color:var(--stage-soft)}
.scs .wl-addf{position:relative;padding:8px;border-top:2px solid var(--wl-k)}
.scs .wl-add{width:100%;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 0;border:2px dashed var(--stage-line);background:none;color:var(--stage-soft);font:600 .72rem var(--font-ui);letter-spacing:.04em;text-transform:uppercase;cursor:pointer;transition:color .15s,border-color .15s}
.scs .wl-add:hover{border-color:var(--wa);color:var(--wa)}
.scs .wl-hint{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}
.scs .wl-hint .box{width:56px;height:56px;display:grid;place-items:center;margin:0 auto 12px;border:2px solid var(--wl-k);background:var(--wl-raised);color:var(--stage-soft)}
.scs .wl-hint b{display:block;font:700 14px/20px var(--font-ui);color:var(--stage-card)}
.scs .wl-hint small{display:block;margin-top:4px;font-size:13.12px;color:var(--stage-mute)}
.scs .wl-ents{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden}
.scs .wl-ar{flex:none;padding:6px 12px;border-bottom:2px solid var(--wl-k);background:var(--wl-panel)}
.scs .wl-ar-r{display:flex;align-items:center;justify-content:flex-end;gap:6px}
.scs .wl-sv{margin-right:auto;display:inline-flex;align-items:center;gap:4px;font:600 .74rem var(--font-ui);color:var(--g)}
.scs .wl-pl,.scs .wl-ex{width:28px;height:28px;display:grid;place-items:center;border-radius:var(--rc-radius-sm);cursor:pointer;transition:filter .15s,background .15s}
.scs .wl-pl{border:1px solid var(--wa);background:var(--wa-soft);color:var(--wa)}
.scs .wl-pl:hover{filter:brightness(1.1)}
.scs .wl-ex{border:0;background:var(--wl-faint);color:var(--stage-soft)}
.scs .wl-ex:hover{background:var(--wl-rule);color:var(--stage-card)}
.scs .wl-se{margin-top:8px;display:flex;align-items:center;gap:8px;min-height:40px;padding:0 10px;border:2px solid var(--wl-k);background:var(--wl-sunk);box-shadow:2px 2px 0 var(--wl-k);color:var(--stage-soft)}
.scs .wl-se:focus-within{border-color:var(--wa)}
.scs .wl-se input{flex:1;min-width:0;border:0;background:transparent;outline:none;font:14px/20px var(--font-ui);color:var(--stage-card)}
.scs .wl-se input::placeholder{color:var(--stage-mute)}
.scs .wl-se button{padding:4px 6px;border:0;background:none;font:700 .65rem var(--font-mono);letter-spacing:.025em;text-transform:uppercase;color:var(--stage-soft);cursor:pointer}
.scs .wl-split{flex:1;min-height:0;display:flex;overflow:hidden}
.scs .wl-list{width:180px;flex:none;display:flex;flex-direction:column;overflow:hidden;background:var(--wl-panel);border-right:2px solid var(--wl-k)}
.scs .wl-scroll{flex:1;min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--stage-line) transparent}
.scs .wl-inner{position:relative;width:100%}
.scs .wl-vr{position:absolute;top:0;left:0;width:100%}
.scs .wl-gh{width:100%;height:34px;display:flex;align-items:center;gap:6px;padding:0 10px;border:0;border-bottom:2px solid var(--wl-k);background:var(--wl-raised);font:700 .62rem var(--font-ui);letter-spacing:.14em;text-transform:uppercase;color:var(--wa);cursor:pointer;text-align:left}
.scs .wl-gh:hover{background:color-mix(in srgb,var(--wl-raised) 80%,var(--stage-card))}
.scs .wl-gh.v{color:var(--v)}
.scs .wl-gh em{margin-left:auto;font:normal .62rem var(--font-mono);letter-spacing:0;color:var(--stage-soft)}
.scs .wl-en{height:64px;padding:6px 8px;border-left:2px solid transparent;cursor:pointer;transition:background .15s}
.scs .wl-en:hover{background:color-mix(in srgb,var(--wl-raised) 50%,transparent)}
.scs .wl-en.sel{border-left-color:var(--v);background:color-mix(in srgb,var(--bk-role-select) 10%,transparent)}
.scs .wl-en.off{opacity:.5}
.scs .wl-en-r{display:flex;align-items:center;gap:4px}
.scs .wl-en-n{flex:1;min-width:0;font-size:.82rem;line-height:20px;color:var(--stage-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.scs .wl-en.sel .wl-en-n{color:var(--stage-card)}
.scs .wl-en-t{margin-top:2px;padding-left:16px;font-size:.7rem;line-height:16px;color:var(--stage-mute)}
.scs .wl-more{width:40px;height:40px;margin:-4px 0;flex:none;display:grid;place-items:center;border:1px solid var(--wl-rule);background:var(--wl-sunk);color:var(--stage-soft);cursor:pointer;transition:color .15s,border-color .15s}
.scs .wl-more:hover{border-color:color-mix(in srgb,var(--c) 60%,transparent);color:var(--c)}
.scs .wl-why{flex:none;padding:0 5px;font-size:var(--text-meta);line-height:16px;border:1px solid;white-space:nowrap}
.scs .wl-why.c-con{color:var(--wa);border-color:var(--wa-line)}
.scs .wl-why.c-key{color:var(--g);border-color:var(--g-line)}
.scs .wl-why.c-stk{color:var(--r);border-color:var(--r-line)}
.scs .wl-why.c-cut{color:var(--stage-mute);border-color:var(--stage-seam);text-decoration:line-through}
.scs .wl-foot{flex:none;display:flex;align-items:center;gap:6px;padding:6px 10px;border-top:2px solid var(--wl-k);font-size:var(--text-meta);color:var(--stage-mute)}
.scs .wl-foot b{font-weight:600;color:var(--stage-soft)}
.scs .wl-lempty{display:flex;flex-direction:column;align-items:center;padding:32px 12px;text-align:center}
.scs .wl-lempty .box{width:44px;height:44px;display:grid;place-items:center;margin-bottom:12px;border:2px solid var(--wl-k);background:var(--wl-raised);box-shadow:2px 2px 0 var(--wl-k);color:var(--stage-mute)}
.scs .wl-lempty b{font:700 .72rem var(--font-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--stage-soft)}
.scs .wl-lempty small{margin-top:4px;font-size:.7rem;line-height:1.375;color:var(--stage-mute)}
.scs .wl-cta{display:inline-flex;align-items:center;gap:6px;margin-top:12px;padding:6px 12px;border:2px solid var(--wl-k);background:var(--wa);box-shadow:2px 2px 0 var(--wl-k);font:800 .66rem var(--font-ui);letter-spacing:.04em;text-transform:uppercase;color:var(--stage-black);cursor:pointer}
.scs .wl-cta.big{margin-top:16px;padding:8px 16px;border-width:3px;box-shadow:3px 3px 0 var(--wl-k)}
.scs .wl-detail{flex:1;min-width:0;display:flex;overflow:hidden}
.scs .wl-pick{flex:1;display:flex;align-items:center;justify-content:center;min-width:0;padding:24px}
.scs .wl-pick>div{max-width:260px;text-align:center}
.scs .wl-pick .box{width:56px;height:56px;display:grid;place-items:center;margin:0 auto 16px;border:3px solid var(--wl-k);background:var(--wl-raised);box-shadow:4px 4px 0 var(--wl-k);color:var(--wa)}
.scs .wl-pick b{display:block;font:800 1rem var(--font-fancy);letter-spacing:.04em;text-transform:uppercase;color:var(--stage-card);text-shadow:2px 2px 0 var(--wl-k)}
.scs .wl-pick small{display:block;margin-top:6px;font-size:13.12px;line-height:1.6;color:var(--stage-mute)}
.scs .wl-ov{position:absolute;inset:0;z-index:90;border:0;background:none;cursor:default}
.scs .wl-menu{position:absolute;z-index:100;width:224px;max-height:min(70%,32rem);overflow-y:auto;border:2px solid var(--wl-k);background:var(--wl-raised);box-shadow:4px 4px 0 var(--wl-k);font-size:14px}
.scs .wl-menu button{display:flex;align-items:center;gap:8px;width:100%;min-height:44px;padding:0 12px;border:0;border-top:1px solid var(--wl-faint);background:none;font-weight:500;text-align:left;color:var(--stage-soft);cursor:pointer;transition:color .15s,background .15s}
.scs .wl-menu>button:first-child{border-top:0}
.scs .wl-menu button:hover:not(:disabled){background:var(--c-fill);color:var(--c)}
.scs .wl-menu button:disabled{opacity:.3;cursor:not-allowed}
.scs .wl-menu .red{color:var(--r)}
.scs .wl-menu .red:hover:not(:disabled){background:var(--r-fill);color:var(--r)}
.scs .wl-menu .two{display:grid;grid-template-columns:1fr 1fr;border-top:2px solid var(--wl-k)}
.scs .wl-menu .two button:first-child{border-top:0}
.scs .wl-menu .two button:last-child{border-top:0}
.scs .wl-pop{position:absolute;left:8px;bottom:56px;width:280px;z-index:100;display:flex;flex-direction:column;max-height:500px;overflow:hidden;border:1px solid var(--stage-line);border-radius:var(--rc-radius-sm);background:var(--wl-raised);box-shadow:0 10px 24px color-mix(in srgb,var(--wl-k) 60%,transparent)}
.scs .wl-new{padding:8px 12px;border-bottom:1px solid var(--wl-rule)}
.scs .wl-new>button{width:100%;display:flex;align-items:center;gap:8px;padding:8px;border-radius:var(--rc-radius-sm);border:1px solid var(--wa);background:var(--wa-soft);font:600 14px/20px var(--font-ui);color:var(--stage-card);cursor:pointer}
.scs .wl-new>button:disabled{opacity:.6;cursor:not-allowed}
.scs .wl-new .nm{display:flex;flex-direction:column;gap:6px}
.scs .wl-new input{width:100%;padding:8px;border-radius:var(--rc-radius-sm);border:1px solid var(--wa-line);background:color-mix(in srgb,var(--wl-k) 40%,transparent);font:14px/20px var(--font-ui);color:var(--stage-card);outline:none}
.scs .wl-new input:focus{border-color:var(--wa)}
.scs .wl-new .row{display:flex;gap:6px}
.scs .wl-new .row button{display:flex;align-items:center;justify-content:center;gap:4px;padding:6px 8px;border-radius:var(--rc-radius-sm);border:1px solid var(--stage-seam);background:var(--wl-sunk);font:14px/20px var(--font-ui);color:var(--stage-soft);cursor:pointer}
.scs .wl-new .row button:first-child{flex:1;border-color:var(--wa);background:var(--wa-soft);font-weight:600;color:var(--stage-card)}
.scs .wl-new .row button:disabled{opacity:.6;cursor:not-allowed}
.scs .wl-lib{flex:1;min-height:0;display:flex;flex-direction:column}
.scs .wl-ls{padding:8px 12px;border-bottom:1px solid color-mix(in srgb,var(--stage-seam) 50%,transparent)}
.scs .wl-ls label{position:relative;display:block}
.scs .wl-ls svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--stage-soft)}
.scs .wl-ls input{width:100%;padding:8px 12px 8px 32px;border-radius:var(--rc-radius-sm);border:1px solid var(--stage-seam);background:color-mix(in srgb,var(--wl-raised) 50%,transparent);font:14px/20px var(--font-ui);color:var(--stage-card);outline:none}
.scs .wl-ls input:focus{border-color:var(--wa)}
.scs .wl-ls input::placeholder{color:var(--stage-mute)}
.scs .wl-lh{padding:8px 12px;border-bottom:1px solid color-mix(in srgb,var(--stage-seam) 50%,transparent);font:700 .74rem var(--font-ui);letter-spacing:.18em;text-transform:uppercase;color:var(--stage-soft)}
.scs .wl-lr{width:100%;display:flex;align-items:flex-start;gap:12px;padding:8px 12px;border:0;border-left:2px solid transparent;background:none;text-align:left;cursor:pointer;transition:background .15s}
.scs .wl-lr:hover:not(:disabled){background:color-mix(in srgb,var(--wl-raised) 50%,transparent)}
.scs .wl-lr:disabled{opacity:.6;cursor:not-allowed}
.scs .wl-lr .ico{width:32px;height:32px;flex:none;display:grid;place-items:center;border:1px solid var(--stage-seam);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--wl-raised) 50%,transparent);color:var(--wa)}
.scs .wl-lr b{display:block;font:600 14px/20px var(--font-ui);color:var(--stage-card);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.scs .wl-lr small{display:block;font-size:13.12px;color:var(--stage-soft)}
.scs .wl-lr .tx{flex:1;min-width:0}
.scs .wl-lib .scroll{flex:1;min-height:0;overflow-y:auto;padding:4px 0}
.scs .wl-note{margin:0 12px 12px;display:flex;align-items:flex-start;gap:6px;padding:6px 10px;font-size:var(--text-meta);color:var(--g);border:1px solid var(--g-line);background:var(--g-fill)}
.scs .wl-note.warn{color:var(--stage-warn);border-color:color-mix(in srgb,var(--stage-warn) 40%,transparent);background:color-mix(in srgb,var(--stage-warn) 10%,transparent)}
@container (min-width:1280px){.scs .wl-list{width:200px}}
@container (max-width:767px){
.scs .wl-books{width:100%;border-right:0}
.scs .wl-hint{display:none}
.scs .wl-list{width:100%;border-right:0}
.scs .wl-split[data-open="true"] .wl-list{display:none}
.scs .wl-split:not([data-open="true"]) .wl-detail{display:none}
}
`;
