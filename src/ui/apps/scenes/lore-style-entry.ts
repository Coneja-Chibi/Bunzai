/**
 * The World wing's entry editor (RoleCall's EntryPanel, pixel for pixel): the header with the on
 * switch, title, type, order and scan boxes, the keyword boxes, the injection cards, the timing,
 * recursion and group row, the content well, the Show advanced settings card, side effects and the
 * character filter. RoleCall draws on white at N percent; here that is the text color at N percent,
 * so a light theme still reads. Roles and sizes follow lore-style.ts (RoleCall's own sizes, default theme; `wl-` prefix).
 */
export const LORE_ENTRY_STYLE = `
.scs .wl-e{--w3:color-mix(in srgb,var(--stage-card) 3%,transparent);--w5:color-mix(in srgb,var(--stage-card) 5%,transparent);--w8:color-mix(in srgb,var(--stage-card) 8%,transparent);--w10:color-mix(in srgb,var(--stage-card) 10%,transparent);--w15:color-mix(in srgb,var(--stage-card) 15%,transparent);--w25:color-mix(in srgb,var(--stage-card) 25%,transparent);--w30:color-mix(in srgb,var(--stage-card) 30%,transparent);--w40:color-mix(in srgb,var(--stage-card) 40%,transparent);--w50:color-mix(in srgb,var(--stage-card) 50%,transparent);--w70:color-mix(in srgb,var(--stage-card) 70%,transparent);flex:1;min-width:0;height:100%;min-height:0;position:relative;display:flex;flex-direction:column;overflow:hidden;border:1px solid color-mix(in srgb,var(--wa) 20%,transparent);background:linear-gradient(135deg,color-mix(in srgb,var(--wa) 3%,transparent) 0%,var(--stage-well) 30%);border-radius:var(--rc-radius-sm);font-size:14px}
.scs .wl-eh{flex:none;padding:12px 16px;background:color-mix(in srgb,var(--stage-card) 2%,transparent);border-bottom:1px solid color-mix(in srgb,var(--stage-card) 6%,transparent)}
.scs .wl-eh1{display:flex;align-items:center;gap:10px;min-width:0}
.scs .wl-eh1 .dot{width:10px;height:10px;flex:none;border-radius:50%;background:var(--bk-role-ok)}
.scs .wl-eh1 .dot.con{background:var(--bk-role-action)}
.scs .wl-tg{position:relative;width:40px;height:24px;flex:none;border:0;border-radius:var(--rc-radius-full);background:var(--w10);cursor:pointer;transition:background .15s}
.scs .wl-tg i{position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:var(--rc-radius-full);background:var(--w40);transition:left .15s,background .15s}
.scs .wl-tg.on{background:color-mix(in srgb,var(--bk-role-ok) 30%,transparent)}
.scs .wl-tg.on i{left:18px;background:var(--g)}
.scs .wl-ti{flex:1;min-width:0;padding:4px 8px;border:1px solid transparent;border-radius:var(--rc-radius-sm);background:var(--w3);outline:none;font:600 14px/20px var(--font-ui);color:color-mix(in srgb,var(--stage-card) 90%,transparent);transition:border-color .15s,background .15s}
.scs .wl-ti:hover{border-color:var(--w10)}
.scs .wl-ti:focus{border-color:color-mix(in srgb,var(--bk-role-select) 40%,transparent);background:var(--w5)}
.scs .wl-ti::placeholder{color:var(--w30)}
.scs .wl-eh2{position:relative;margin-top:8px;display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:8px}
.scs .wl-rel{position:relative;display:inline-flex;align-items:center;gap:4px}
.scs .wl-q{width:16px;height:16px;flex:none;display:inline-grid;place-items:center;border:1px solid var(--stage-line);background:var(--stage-sunken);font:700 10px var(--font-ui);color:var(--stage-soft);cursor:help}
.scs .wl-type{display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--v-line);border-radius:var(--rc-radius-sm);background:var(--v-fill);font:500 12px/16px var(--font-ui);color:var(--v);cursor:pointer;transition:background .15s}
.scs .wl-type:hover{background:color-mix(in srgb,var(--bk-role-select) 25%,transparent)}
.scs .wl-type svg{transition:transform .15s}
.scs .wl-type.open svg{transform:rotate(180deg)}
.scs .wl-dd{position:absolute;z-index:50;top:100%;margin-top:4px;padding:4px 0;border-radius:var(--rc-radius-sm);border:1px solid var(--stage-line);background:var(--wl-raised);box-shadow:0 10px 24px color-mix(in srgb,var(--wl-k) 60%,transparent)}
.scs .wl-dd.r{right:0;min-width:120px}
.scs .wl-dd button{display:block;width:100%;padding:8px 12px;border:0;background:none;font:12px/16px var(--font-ui);text-align:left;color:var(--w70);cursor:pointer}
.scs .wl-dd button:hover{background:var(--w10)}
.scs .wl-dd button.on{background:color-mix(in srgb,var(--bk-role-select) 20%,transparent);color:var(--v)}
.scs .wl-dd small{display:block;margin-top:0;font-size:9px;color:var(--w40)}
.scs .wl-pre{display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--stage-line);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--stage-card) 4%,transparent);font:500 12px/16px var(--font-ui);color:var(--stage-soft);cursor:pointer;transition:background .15s}
.scs .wl-pre:hover{background:color-mix(in srgb,var(--stage-card) 8%,transparent);color:var(--stage-card)}
.scs .wl-pre.on{border-color:color-mix(in srgb,var(--wa) 40%,transparent);background:color-mix(in srgb,var(--wa) 20%,transparent);color:var(--wa)}
.scs .wl-ord,.scs .wl-scn{display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:var(--rc-radius-sm)}
.scs .wl-ord{border:1px solid color-mix(in srgb,var(--wa) 25%,transparent);background:color-mix(in srgb,var(--wa) 10%,transparent)}
.scs .wl-scn{border:1px solid var(--w10);background:var(--w5)}
.scs .wl-ord span,.scs .wl-scn span{font:500 11px/16px var(--font-ui)}
.scs .wl-ord span{color:color-mix(in srgb,var(--wa) 70%,transparent)}
.scs .wl-scn span{color:var(--w50)}
.scs .wl-num{border:0;outline:0;background:transparent;text-align:center;font:600 13px/20px var(--font-ui);-moz-appearance:textfield;appearance:textfield}
.scs .wl-num::-webkit-outer-spin-button,.scs .wl-num::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.scs .wl-ord .wl-num{width:48px;color:var(--wa)}
.scs .wl-scn .wl-num{width:40px;color:var(--w70)}
.scs .wl-tk{font:500 12px/16px var(--font-mono);color:var(--w50)}
.scs .wl-x{width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:var(--rc-radius-sm);background:none;color:var(--w30);cursor:pointer;transition:background .15s,color .15s}
.scs .wl-x:hover{background:var(--w8);color:var(--stage-card)}
.scs .wl-ec{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;padding:12px;overflow-y:auto;scrollbar-width:none}
.scs .wl-ec::-webkit-scrollbar,.scs .wl-e textarea::-webkit-scrollbar{display:none}
.scs .wl-lb{font:500 11px/16px var(--font-ui);letter-spacing:.025em;text-transform:uppercase;color:var(--w50)}
.scs .wl-tm{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.scs .wl-tm button{padding:0;border:0;background:none;font:500 12px/16px var(--font-ui);letter-spacing:.025em;text-transform:uppercase;color:var(--w30);cursor:pointer;transition:color .15s}
.scs .wl-tm button:hover{color:var(--w50)}
.scs .wl-tm button.on{color:var(--wa)}
.scs .wl-tm .sl{color:color-mix(in srgb,var(--stage-card) 20%,transparent)}
.scs .wl-tm em{margin-left:4px;font:italic 11px/16px var(--font-ui);color:color-mix(in srgb,var(--v) 60%,transparent)}
.scs .wl-prob{margin-left:auto;padding:4px 8px;border:1px solid var(--g-line);border-radius:var(--rc-radius-sm);background:var(--g-fill);font:500 12px/16px var(--font-ui);color:var(--g);cursor:pointer}
.scs .wl-prob:hover{background:color-mix(in srgb,var(--bk-role-ok) 25%,transparent)}
.scs .wl-prob input{width:44px;padding:0;border:0;background:transparent;outline:0;text-align:right;font:inherit;color:inherit;-moz-appearance:textfield}
.scs .wl-keys{display:flex;flex-direction:column;gap:8px;align-items:stretch}
.scs .wl-keys>.col{flex:1;min-width:0}
.scs .wl-lg{position:relative;display:flex;align-items:center;justify-content:center}
.scs .wl-lg::before{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:var(--w10)}
.scs .wl-lg>button{position:relative;z-index:10;padding:6px 10px;border:1px solid var(--w15);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--wl-k) 40%,transparent);font:500 10px/16px var(--font-ui);white-space:nowrap;color:color-mix(in srgb,var(--stage-card) 60%,transparent);cursor:pointer}
.scs .wl-lg>button:hover{border-color:var(--w30);color:color-mix(in srgb,var(--stage-card) 80%,transparent)}
.scs .wl-lg .wl-dd{left:50%;transform:translateX(-50%);min-width:180px;z-index:60}
.scs .wl-tb{width:100%;display:flex;flex-direction:column;gap:4px}
.scs .wl-tbx{width:100%;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:8px;border:1px solid var(--v-line);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--wl-k) 20%,transparent)}
.scs .wl-tbx.two{border-color:color-mix(in srgb,var(--wa) 20%,transparent)}
.scs .wl-tbx.bad{border-color:color-mix(in srgb,var(--bk-role-danger) 50%,transparent);background:color-mix(in srgb,var(--bk-role-danger) 5%,transparent)}
.scs .wl-ch{max-width:100%;min-width:0;display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border:1px solid color-mix(in srgb,var(--bk-role-select) 25%,transparent);border-radius:var(--rc-radius-sm);background:var(--v-fill);font-size:12px;line-height:16px;color:var(--v)}
.scs .wl-ch.two{border-color:color-mix(in srgb,var(--wa) 25%,transparent);background:color-mix(in srgb,var(--wa) 15%,transparent);color:var(--wa)}
.scs .wl-ch.rx{font-family:var(--font-mono);border-color:color-mix(in srgb,var(--stage-warn) 30%,transparent);background:var(--stage-sunken);color:var(--stage-warn)}
.scs .wl-ch>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scs .wl-ch button{padding:0;border:0;background:none;font-size:12px;color:inherit;opacity:.6;cursor:pointer}
.scs .wl-ch button:hover{opacity:1}
.scs .wl-ch .pc{padding:0 6px;background:color-mix(in srgb,currentColor 18%,transparent);opacity:1;font-size:12px}
.scs .wl-ch .pc input{width:36px;padding:0;border:0;background:transparent;outline:0;text-align:right;font:inherit;color:inherit;-moz-appearance:textfield}
.scs .wl-more-c{padding:4px 10px;border:1px solid var(--v-line);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--bk-role-select) 20%,transparent);display:inline-flex;align-items:center;gap:4px;font:500 11px/16px var(--font-ui);color:var(--v);cursor:pointer}
.scs .wl-more-c.two{border-color:color-mix(in srgb,var(--wa) 30%,transparent);background:color-mix(in srgb,var(--wa) 20%,transparent);color:var(--wa)}
.scs .wl-more-c.less{border-color:var(--w25);background:var(--w10);color:var(--w50)}
.scs .wl-tbx>input{flex:1;min-width:80px;border:0;background:transparent;outline:0;font-size:12px;line-height:16px;color:var(--w70)}
.scs .wl-tbx>input::placeholder{color:color-mix(in srgb,var(--stage-card) 25%,transparent)}
.scs .wl-tbx.bad>input{color:var(--r)}
.scs .wl-err{display:flex;align-items:center;gap:8px;padding:4px 8px;border:1px solid color-mix(in srgb,var(--bk-role-danger) 20%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--bk-role-danger) 10%,transparent);font-size:10px;color:var(--r)}
.scs .wl-sec{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.scs .wl-sec .r{margin-left:auto}
.scs .wl-pos{display:flex;align-items:center;gap:8px;overflow-x:auto;padding:0 4px 4px 0;white-space:nowrap}
.scs .wl-pc{flex:none;min-width:102px;display:flex;align-items:center;justify-content:center;gap:6px;padding:8px;border:1px solid var(--w8);border-radius:var(--rc-radius-sm);background:var(--w3);font:500 11px/16px var(--font-ui);color:var(--w50);cursor:pointer;transition:background .15s}
.scs .wl-pc:hover{background:var(--w5)}
.scs .wl-pc.on{border-color:var(--b-line);background:var(--b-fill);color:var(--b)}
.scs .wl-pc.am.on{border-color:color-mix(in srgb,var(--wa) 40%,transparent);background:color-mix(in srgb,var(--wa) 15%,transparent);color:var(--wa)}
.scs .wl-pc.dp,.scs .wl-pc.ap{min-width:132px}
.scs .wl-pc.pn{min-width:92px}
.scs .wl-pc input{width:32px;height:20px;border:1px solid var(--b-line);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--wl-k) 40%,transparent);text-align:center;font:600 11px var(--font-ui);color:var(--b);-moz-appearance:textfield}
.scs .wl-pc.am input{border-color:color-mix(in srgb,var(--wa) 50%,transparent);color:var(--wa)}
.scs .wl-pc select{border:0;background:transparent;font:10px var(--font-ui);color:inherit;cursor:pointer}
.scs .wl-row3{display:flex;flex-wrap:wrap;align-items:flex-start;gap:12px;margin-top:12px;padding-top:12px;border-top:1px solid color-mix(in srgb,var(--stage-card) 6%,transparent)}
.scs .wl-row3>div{display:flex;align-items:center;gap:8px}
.scs .wl-row3 .grp{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.scs .wl-tcell{display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid var(--w8);border-radius:var(--rc-radius-sm);background:var(--w3)}
.scs .wl-tcell span{font-size:10px;line-height:16px;color:var(--w50)}
.scs .wl-tcell .wl-num{width:32px;font:12px/16px var(--font-ui);color:var(--w70)}
.scs .wl-rc{padding:6px 10px;border:1px solid var(--w8);border-radius:var(--rc-radius-sm);background:var(--w3);font:500 11px/16px var(--font-ui);color:var(--w40);cursor:pointer}
.scs .wl-rc:hover{color:var(--w50)}
.scs .wl-rc.g.on{border-color:var(--g-line);background:var(--g-fill);color:var(--g)}
.scs .wl-rc.v.on{border-color:var(--v-line);background:var(--v-fill);color:var(--v)}
.scs .wl-rc.b.on{border-color:var(--b-line);background:var(--b-fill);color:var(--b)}
.scs .wl-gp{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border:1px solid var(--g-line);border-radius:var(--rc-radius-sm);background:var(--g-fill);font-size:11px;line-height:16px;color:var(--g)}
.scs .wl-gp input{width:32px;border:0;outline:0;background:transparent;text-align:center;font:10px var(--font-ui);color:inherit;-moz-appearance:textfield}
.scs .wl-gp button{padding:0;border:0;background:none;font-size:10px;color:inherit;opacity:.6;cursor:pointer}
.scs .wl-gi{width:96px;height:28px;padding:0 10px;border:1px solid var(--w8);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--wl-k) 20%,transparent);outline:0;font:11px var(--font-ui);color:var(--w70)}
.scs .wl-gi:focus{border-color:color-mix(in srgb,var(--bk-role-ok) 40%,transparent)}
.scs .wl-gi::placeholder{color:color-mix(in srgb,var(--stage-card) 25%,transparent)}
.scs .wl-ta{width:100%;min-height:200px;height:320px;padding:8px 12px;border:1px solid var(--w8);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--wl-k) 30%,transparent);outline:0;resize:vertical;font:14px/22.75px var(--font-ui);color:color-mix(in srgb,var(--stage-card) 80%,transparent);scrollbar-width:none;display:block}
.scs .wl-ta:focus{border-color:var(--w25)}
.scs .wl-ta::placeholder{color:var(--w30)}
.scs .wl-mac{display:flex;flex-wrap:wrap;align-items:center;gap:4px 16px;margin-top:8px;font-size:11px;line-height:16px;color:var(--stage-mute)}
.scs .wl-mac code{padding:2px 6px;border-radius:var(--rc-radius-sm);background:var(--w5);font:10px var(--font-mono);color:var(--w50)}
.scs .wl-mac .m{display:inline-flex;align-items:center;gap:6px}
.scs .wl-mac .tk{margin-left:auto;font:500 11px var(--font-mono);color:var(--stage-soft)}
.scs .wl-adv{width:100%;padding:12px 16px;border:2px solid var(--wl-k);background:var(--wl-raised);box-shadow:3px 3px 0 var(--wl-k);text-align:left;cursor:pointer;transition:transform .1s,box-shadow .1s}
.scs .wl-adv:hover{transform:translate(-2px,-2px)}
.scs .wl-adv:active{transform:translate(2px,2px);box-shadow:none}
.scs .wl-adv .t{display:flex;align-items:center;justify-content:space-between}
.scs .wl-adv .t b{font:800 12px var(--font-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--stage-card)}
.scs .wl-adv .t i{font:700 12px var(--font-mono);font-style:normal;color:var(--stage-soft)}
.scs .wl-adv small{display:block;margin-top:2px;font-size:12px;line-height:16px;color:var(--stage-soft)}
.scs .wl-fx{margin-top:8px;padding-top:16px;border-top:1px solid color-mix(in srgb,var(--stage-card) 6%,transparent)}
.scs .wl-fxh{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.scs .wl-fxh>button:first-child{display:flex;align-items:center;gap:8px;padding:0;border:0;background:none;color:inherit;cursor:pointer}
.scs .wl-fxh .z{display:inline-flex;color:var(--c)}
.scs .wl-fxh .n{padding:2px 6px;border-radius:var(--rc-radius-sm);background:var(--c-fill);font:500 11px var(--font-ui);color:var(--c)}
.scs .wl-fxh .cv{display:inline-flex;color:var(--w30);transition:transform .15s}
.scs .wl-fxh .cv.open{transform:rotate(180deg)}
.scs .wl-ae{margin-left:auto;display:flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid var(--c-line);border-radius:var(--rc-radius-sm);background:var(--c-fill);font:500 11px/16px var(--font-ui);color:var(--c);cursor:pointer}
.scs .wl-ae:hover{background:color-mix(in srgb,var(--bk-role-info) 20%,transparent)}
.scs .wl-fxl{display:flex;flex-direction:column;gap:8px}
.scs .wl-fr{display:flex;align-items:center;gap:8px;padding:10px;border:1px solid color-mix(in srgb,var(--stage-card) 6%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--stage-card) 2%,transparent)}
.scs .wl-fr select,.scs .wl-fr input{height:28px;padding:0 8px;border:1px solid var(--w8);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--wl-k) 30%,transparent);outline:0;font:11px var(--font-ui);color:var(--w70);-moz-appearance:textfield}
.scs .wl-fr select{width:112px}
.scs .wl-fr select.sc{width:80px;color:var(--w50)}
.scs .wl-fr input.v{flex:1;min-width:0;padding:0 10px}
.scs .wl-fr input.mono{font-family:var(--font-mono)}
.scs .wl-fr input.am{width:64px;text-align:center}
.scs .wl-fr .l{display:flex;flex:1;align-items:center;gap:6px}
.scs .wl-fr .l span,.scs .wl-fr>span{font-size:11px;color:var(--w40)}
.scs .wl-fr .rm{width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:var(--rc-radius-sm);background:none;color:var(--w30);cursor:pointer;opacity:0}
.scs .wl-fr:hover .rm,.scs .wl-fr .rm:focus-visible{opacity:1}
.scs .wl-fr .rm:hover{color:var(--r);background:var(--r-fill)}
.scs .wl-fxe{padding:16px;border:1px dashed var(--w8);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--stage-card) 2%,transparent);text-align:center;font-size:11px;line-height:16px;color:var(--w30)}
.scs .wl-fxe small{display:block;font-size:12px;color:color-mix(in srgb,var(--stage-card) 20%,transparent)}
.scs .wl-fxo{display:flex;align-items:center;gap:16px;margin-top:4px;padding-top:8px;border-top:1px solid color-mix(in srgb,var(--stage-card) 4%,transparent)}
.scs .wl-fxo label{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--w40);cursor:pointer}
.scs .wl-bst{display:flex;gap:8px}
.scs .wl-bst input[type="text"]{flex:1;min-width:0}
.scs .wl-bst input.am{width:64px;flex:none;text-align:center;-moz-appearance:textfield}
.scs .wl-bst input:focus{border-color:color-mix(in srgb,var(--wa) 40%,transparent)}
.scs .wl-cf .tag.bst{border-color:color-mix(in srgb,var(--wa) 30%,transparent);background:color-mix(in srgb,var(--wa) 15%,transparent);color:var(--wa)}
.scs .wl-cf p.err{color:var(--r)}
.scs .wl-adv2{display:flex;flex-direction:column;gap:12px;padding-top:12px;border-top:1px solid color-mix(in srgb,var(--stage-card) 6%,transparent)}
.scs .wl-lbl{display:flex;align-items:center;gap:6px;margin-bottom:8px}
.scs .wl-lbl small{font-size:10px;color:var(--w30)}
.scs .wl-cf{display:flex;flex-direction:column;gap:8px}
.scs .wl-cf .modes{display:flex;gap:8px}
.scs .wl-cf .modes button{flex:1;padding:6px 10px;border:1px solid var(--w8);border-radius:var(--rc-radius-sm);background:var(--w3);font:500 11px/16px var(--font-ui);color:var(--w40);cursor:pointer}
.scs .wl-cf .modes button:hover{color:var(--w50)}
.scs .wl-cf .modes .wl-wh.on{border-color:var(--b-line);background:var(--b-fill);color:var(--b)}
.scs .wl-cf .modes .wl-bl2.on{border-color:var(--r-line);background:var(--r-fill);color:var(--r)}
.scs .wl-cf .modes .wl-no.on{border-color:var(--w10);background:var(--w5);color:color-mix(in srgb,var(--stage-card) 60%,transparent)}
.scs .wl-cf input{width:100%;padding:6px 10px;border:1px solid var(--w8);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--wl-k) 20%,transparent);outline:0;font:11px var(--font-ui);color:var(--w70)}
.scs .wl-cf input:focus{border-color:var(--b-line)}
.scs .wl-cf .tags{display:flex;flex-wrap:wrap;gap:6px}
.scs .wl-cf .tag{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border:1px solid var(--b-line);border-radius:var(--rc-radius-sm);background:var(--b-fill);font-size:11px;color:var(--b)}
.scs .wl-cf .tag.ex{border-color:var(--r-line);background:var(--r-fill);color:var(--r)}
.scs .wl-cf .tag button{padding:0;border:0;background:none;color:inherit;opacity:.6;cursor:pointer}
.scs .wl-cf p{margin:0;font-size:10px;color:var(--w30)}
@container (min-width:1024px){
.scs .wl-keys{flex-direction:row}
.scs .wl-lg{width:132px;flex:none}
}
`;
