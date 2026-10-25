/**
 * The Standardize banner, drawer and result cards (RoleCall `BentoDashboard.tsx:802-1448`): an amber-framed card (here the scene accent
 * `--wa`) per state, green for Complete, the danger role for Error and Revert Failed. Sizes are RoleCall's;
 * every colour is a theme token. The pane answers by its own width (`@container`), never the viewport.
 */
export const COMPENDIUM_STANDARDIZE_STYLE = `
.scs .cp-std{margin-bottom:20px}
.scs .cp-std-card{margin-bottom:20px;padding:20px;border:1px solid var(--wa-line);background:linear-gradient(135deg,color-mix(in srgb,var(--wa) 8%,transparent),color-mix(in srgb,var(--wa) 2%,transparent))}
.scs .cp-std-card.run{border-color:var(--wa-line);background:color-mix(in srgb,var(--wa) 4%,transparent);padding:16px}
.scs .cp-std-card.done{border-color:color-mix(in srgb,var(--bk-role-ok-text) 40%,transparent);background:color-mix(in srgb,var(--bk-role-ok-text) 5%,transparent);padding:16px}
.scs .cp-std-card.stopped,.scs .cp-std-card.reverted{padding:16px}
.scs .cp-std-card.bad{border-color:color-mix(in srgb,var(--bk-role-danger-text) 40%,transparent);background:color-mix(in srgb,var(--bk-role-danger-text) 5%,transparent);padding:16px}
.scs .cp-std-card .hd{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.scs .cp-std-card .hd>div:first-child{min-width:0;flex:1}
.scs .cp-std-card .kick{font:700 11px var(--font-fancy);letter-spacing:.25em;text-transform:uppercase;color:var(--wa)}
.scs .cp-std-card.done .kick{color:var(--bk-role-ok-text)}
.scs .cp-std-card.bad .kick{color:var(--bk-role-danger-text)}
.scs .cp-std-card h2{margin:4px 0 0;font:400 1.125rem var(--font-fancy);color:var(--stage-card)}
.scs .cp-std-card p{max-width:42em;margin:4px 0 0;font-size:13px;line-height:1.5;color:var(--cp-soft)}
.scs .cp-std-card .phase{margin-top:4px;font-size:12px;color:var(--cp-text)}
.scs .cp-std-card .cur{margin-top:2px;font-size:11px;color:var(--cp-soft)}
.scs .cp-std-card .line{margin-top:4px;font-size:12px;color:var(--cp-text);overflow-wrap:anywhere}
.scs .cp-std-card .line .bad{color:var(--bk-role-danger-text)}
.scs .cp-std-card .line .mute{color:var(--cp-mute)}
.scs .cp-std-card .sub{margin-top:4px;font-size:11px;color:var(--cp-soft)}
.scs .cp-std-card .types{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:6px;font:11px var(--font-fancy);letter-spacing:.1em;text-transform:uppercase;color:var(--cp-mute)}
.scs .cp-std-card .types b{color:var(--wa);font-weight:700}
.scs .cp-std-card .side{display:flex;flex-direction:column;gap:6px;flex:none}
.scs .cp-std-btn{padding:6px 12px;border-radius:var(--rc-radius-sm);border:1px solid var(--stage-line);background:none;color:var(--cp-text);font:700 11px var(--font-fancy);letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
.scs .cp-std-btn:hover:not(:disabled){background:color-mix(in srgb,var(--stage-card) 6%,transparent)}
.scs .cp-std-btn.danger{border-color:color-mix(in srgb,var(--bk-role-danger-text) 45%,transparent);color:var(--bk-role-danger-text)}
.scs .cp-std-btn.danger:hover:not(:disabled){background:color-mix(in srgb,var(--bk-role-danger-text) 10%,transparent)}
.scs .cp-std-btn:disabled,.scs .cp-std-go:disabled{opacity:.6;cursor:default}
.scs .cp-std-go{flex:none;padding:8px 20px;border-radius:var(--rc-radius-sm);border:1px solid color-mix(in srgb,var(--wa) 60%,transparent);background:color-mix(in srgb,var(--wa) 10%,transparent);color:var(--wa);font:700 12px var(--font-fancy);letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
.scs .cp-std-go:hover:not(:disabled){background:color-mix(in srgb,var(--wa) 20%,transparent)}
.scs .cp-std-go:disabled{border-color:var(--stage-line);background:color-mix(in srgb,var(--stage-black) 20%,transparent);color:var(--cp-mute)}
.scs .cp-std-card .why{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px;padding:8px 12px;border-left:2px solid color-mix(in srgb,var(--wa) 50%,transparent);background:color-mix(in srgb,var(--stage-black) 20%,transparent);font-size:12px;line-height:1.5;color:var(--cp-text)}
.scs .cp-std-card .why span{min-width:13em;flex:1}
.scs .cp-std-card .ctl{margin-top:16px;padding-top:12px;border-top:1px solid color-mix(in srgb,var(--wa) 15%,transparent)}
.scs .cp-std-card .mode{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.scs .cp-std-card label{font:700 9px var(--font-fancy);letter-spacing:.2em;text-transform:uppercase;color:color-mix(in srgb,var(--wa) 80%,transparent)}
.scs .cp-std-card .seg{display:inline-flex;border:1px solid color-mix(in srgb,var(--wa) 20%,transparent)}
.scs .cp-std-card .seg button{padding:4px 10px;border:0;background:color-mix(in srgb,var(--stage-black) 20%,transparent);color:var(--cp-mute);font:700 10px var(--font-fancy);letter-spacing:.1em;cursor:pointer}
.scs .cp-std-card .seg button+button{border-left:1px solid color-mix(in srgb,var(--wa) 20%,transparent)}
.scs .cp-std-card .seg button.on{background:color-mix(in srgb,var(--wa) 15%,transparent);color:var(--wa)}
.scs .cp-std-card .mode small,.scs .cp-std-card .fld small{font-size:10px;line-height:1.2;color:var(--cp-soft)}
.scs .cp-std-card .row{display:flex;flex-wrap:wrap;align-items:flex-end;gap:16px}
.scs .cp-std-card .fld{display:flex;flex-direction:column;gap:4px}
.scs .cp-std-card .stp{display:flex;align-items:center;gap:4px}
.scs .cp-std-card .stp button{width:24px;height:24px;border:1px solid var(--stage-line);background:none;color:var(--cp-soft);font-size:14px;cursor:pointer}
.scs .cp-std-card .stp button:hover:not(:disabled){background:color-mix(in srgb,var(--stage-card) 6%,transparent)}
.scs .cp-std-card .stp button:disabled{opacity:.3;cursor:default}
.scs .cp-std-card .stp input{width:48px;padding:4px 8px;border:1px solid var(--stage-line);background:color-mix(in srgb,var(--stage-black) 40%,transparent);color:var(--wa);font-size:12px;text-align:center}
.scs .cp-std-card .stp input.w{width:96px}
.scs .cp-std-card .stp input:first-of-type:not(.w){width:64px}
.scs .cp-std-card .stp button.all{width:auto;margin-left:4px;padding:0 8px;border-color:color-mix(in srgb,var(--wa) 30%,transparent);color:var(--wa);font:700 10px var(--font-fancy);letter-spacing:.1em}
.scs .cp-std-card .stp button.all.on{border-color:color-mix(in srgb,var(--wa) 60%,transparent);background:color-mix(in srgb,var(--wa) 15%,transparent)}
.scs .cp-std-card .echo{min-width:200px;max-width:280px;margin-left:auto;text-align:right}
.scs .cp-std-card .echo .mdl{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--cp-text)}
.scs .cp-std-card .rev{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding-top:12px;border-top:1px solid var(--cp-rule);font-size:11px;color:var(--cp-soft)}
.scs .cp-std-card .rev span{color:var(--cp-mute)}
.scs .cp-std-card .bar{height:6px;margin-top:12px;background:color-mix(in srgb,var(--stage-black) 40%,transparent)}
.scs .cp-std-card .bar i{display:block;height:100%;background:var(--wa);transition:width .3s}
.scs .cp-std-card .stats{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;margin-top:8px;font:10px var(--font-fancy);letter-spacing:.1em;color:var(--cp-mute)}
.scs .cp-std-card .stats .ok{color:var(--bk-role-ok-text)}
.scs .cp-std-card .stats .info{color:var(--bk-role-info-text)}
.scs .cp-std-card .stats .warn{color:var(--wa)}
.scs .cp-std-card .stats .bad{color:var(--bk-role-danger-text)}
.scs .cp-std-card .logw{margin-top:12px;padding-top:12px;border-top:1px solid color-mix(in srgb,var(--wa) 20%,transparent)}
.scs .cp-std-card .lh{margin-bottom:6px;font:700 9px var(--font-fancy);letter-spacing:.25em;text-transform:uppercase;color:var(--cp-mute)}
.scs .cp-std-card .log{max-height:160px;overflow-y:auto;margin-top:6px;border:1px solid var(--cp-rule);background:color-mix(in srgb,var(--stage-black) 40%,transparent);font:10px/1.2 var(--font-mono);color:var(--cp-soft)}
.scs .cp-std-card .log div{padding:2px 8px;border-bottom:1px solid var(--cp-rule);overflow-wrap:anywhere}
.scs .cp-std-card .log .warn{color:var(--wa)}
.scs .cp-std-card .log .error{color:var(--bk-role-danger-text)}
.scs .cp-std-card .log span{margin-right:6px;color:var(--cp-mute)}
.scs .cp-std-card .more{margin-top:8px}
.scs .cp-std-card .more summary{cursor:pointer;font:700 10px var(--font-fancy);letter-spacing:.1em;color:var(--wa)}
@container (max-width:600px){.scs .cp-std-card{padding:12px}.scs .cp-std-card p,.scs .cp-std-card .ctl{display:none}.scs .cp-std-card h2{font-size:.8125rem}.scs .cp-std-go{padding:4px 10px;font-size:10px}}
`;
