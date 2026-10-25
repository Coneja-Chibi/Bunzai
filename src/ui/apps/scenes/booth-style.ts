/**
 * The Control Booth's styles, copied from RoleCall's QuickPlayPanel.tsx (Tailwind converted to values; the section heads are its 10px / 2px-tracked
 * labels, the cards its p-3 zinc-900/50 boxes) and ChatCharacterNavigator.tsx:316-376 for the character card. The wing opens at RoleCall's 550
 * (GroupLayout.tsx:2731) plus the 50px of rail padding the panel counts inside its width, as `--wing-w` so a saved width can replace it.
 * RoleCall's 8 to 11px sizes have no plan 19 token, so they are written as px here. Sizes, corners and the zinc palette read the plan 19 tokens.
 * The switches (.tg) and the sliders' range are the shared controls'.
 */
export const BOOTH_STYLE = `
@container (min-width:1024px){.scs .wing-panel[data-wing="booth"]{width:min(calc(var(--wing-w,550px) + 50px),100%)}}
.scs .wbody.bth{gap:0;padding:0;line-height:1.5;--w-soft:color-mix(in srgb,var(--w) 12%,transparent);font-family:var(--font-ui)}
.scs .bth-top{padding-bottom:0}
.scs .bth-top>[data-part="scene.booth.loadouts"]{margin-top:12px}
.scs .bth-map{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}
.scs .bth-map.two{grid-template-columns:repeat(2,minmax(0,1fr));margin-top:0}
.scs .bth-map>div{min-width:0;padding:8px 10px;border:1px solid var(--rc-zinc-800);background:color-mix(in srgb,var(--rc-zinc-950) 60%,transparent)}
.scs .bth-map small{display:block;font:600 var(--rc-text-8, 8px) var(--font-ui);letter-spacing:1.6px;text-transform:uppercase;color:var(--rc-zinc-500)}
.scs .bth-map b{display:block;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 var(--rc-text-11, 11px)/1.5 var(--font-ui);color:var(--rc-zinc-200)}
.scs .bth-link{border:0;background:none;padding:0;font:inherit;color:var(--w);text-decoration:underline;cursor:pointer}
.scs .bth-link:focus-visible{outline:2px solid var(--focus-ring);outline-offset:2px}
.scs .bth-note{margin:12px 0 0;padding:8px 12px;border-left:4px solid var(--rc-zinc-700);background:color-mix(in srgb,var(--stage-card) 5%,transparent);font:var(--rc-text-wing)/1.5 var(--font-ui);color:var(--rc-zinc-300)}
.scs .bth-note.warn{border-left-color:var(--stage-warn);background:color-mix(in srgb,var(--stage-warn) 10%,transparent);color:var(--stage-card)}
.scs .bth-sec{position:relative;display:flex;flex-direction:column;margin-top:20px;padding:0 16px}
.scs .bth-sec>.bth-note{margin:8px 0 0}
.scs .bth-sec[data-part="scene.booth.lore"],.scs .bth-sec[data-part="scene.booth.model"],.scs .bth-sec[data-part="scene.booth.generation"]{margin-top:24px}
.scs .bth-sec[data-part="scene.booth.generation"],.scs .bth-sec[data-part="scene.booth.runtime"]{padding-bottom:24px}
.scs .bth-sec[data-part="scene.booth.runtime"]{margin-top:8px}
.scs .bth-sec[data-part="scene.booth.preset"] h3{margin-bottom:8px}
.scs .bth-sec h3{margin:0 0 12px;font:600 var(--rc-text-10, 10px) var(--font-ui);letter-spacing:2px;text-transform:uppercase;color:var(--rc-zinc-300)}
.scs .bth-quiet{display:flex;align-items:center;gap:8px;margin:0;font-size:var(--rc-text-sm);line-height:1.25rem;color:var(--rc-zinc-400)}
.scs .bth-empty{display:block;width:100%;box-sizing:border-box;padding:8px 12px;text-align:left;border:1px dashed var(--rc-zinc-700);background:none;color:var(--rc-zinc-300);font:var(--rc-text-sm)/1.25rem var(--font-ui);cursor:pointer;transition:border-color .15s,color .15s}
.scs .bth-empty:hover{border-color:var(--w);color:var(--stage-card)}
.scs .bth-nums{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;text-align:center}
.scs .bth-nums b{display:block;font:700 1.25rem/1.75rem var(--font-ui);color:var(--w)}
.scs .bth-nums small{display:block;font-size:var(--rc-text-9, 9px);letter-spacing:.05em;text-transform:uppercase;color:var(--rc-zinc-300)}
.scs .bth-sec[data-part="scene.booth.context"]{gap:6px}
.scs .bth-cx{display:flex;align-items:center;justify-content:space-between;font-size:var(--rc-text-10, 10px);letter-spacing:.05em;text-transform:uppercase;color:var(--rc-zinc-300)}
.scs .bth-bar{position:relative;height:8px;width:100%;overflow:hidden;border-radius:var(--rc-radius-full);background:var(--rc-zinc-800)}
.scs .bth-bar i{position:absolute;inset:0 auto 0 0;border-radius:var(--rc-radius-full);background:linear-gradient(90deg,color-mix(in srgb,var(--bar) 38%,transparent) 0%,var(--bar) 100%);box-shadow:0 0 6px color-mix(in srgb,var(--bar) 25%,transparent);transition:width .5s}
.scs .bth-bar.hot i{box-shadow:0 0 12px var(--bar)}
.scs .bth-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px;border:1px solid var(--rc-zinc-800);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-900) 50%,transparent);color:var(--w)}
.scs .bth-row+.bth-row{margin-top:8px}
.scs .bth-row.off{opacity:.6}
.scs .bth-row>svg{flex:none}
.scs .bth-row .pn{flex:1;min-width:0}
.scs .bth-row .pn span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:500 var(--rc-text-sm)/1.25rem var(--font-ui);color:var(--rc-zinc-200)}
.scs .bth-row .pn small{display:block;font-size:var(--rc-text-10, 10px);color:var(--rc-zinc-300)}
.scs .bth-pickwrap{position:relative}
.scs .bth-pick{display:flex;width:100%;box-sizing:border-box;align-items:center;gap:12px;padding:12px;text-align:left;border:1px solid var(--rc-zinc-800);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-900) 50%,transparent);color:inherit;cursor:pointer;transition:border-color .15s}
.scs .bth-pick:hover{border-color:var(--rc-zinc-700)}
.scs .bth-sec[data-part="scene.booth.preset"] .bth-pick:hover{border-color:var(--w)}
.scs .bth-pick .pn,.scs .bth-opt .pn{flex:1;min-width:0}
.scs .bth-pick .pn>span,.scs .bth-opt .pn>span{display:flex;align-items:center;gap:8px;font:500 var(--rc-text-sm)/1.25rem var(--font-ui);color:var(--stage-card)}
.scs .bth-pick .pn>span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.scs .bth-pick small,.scs .bth-opt small{display:block;font:var(--rc-text-10, 10px)/1.5 var(--font-ui);color:var(--rc-zinc-300)}
.scs .bth-tile{width:40px;height:40px;flex:none;display:grid;place-items:center;border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--w) 12.5%,transparent);color:var(--w)}
.scs .bth-tile.sm{width:32px;height:32px}
.scs .bth-chev{flex:none;display:grid;color:var(--rc-zinc-300);transition:transform .15s}
.scs .bth-chev.up{transform:rotate(180deg)}
.scs .bth-drop{position:absolute;left:0;right:0;top:100%;z-index:50;margin-top:8px;overflow:hidden;border:1px solid var(--rc-zinc-700);border-radius:var(--rc-radius-sm);background:var(--rc-zinc-900);box-shadow:0 20px 25px -5px color-mix(in srgb,var(--stage-black) 10%,transparent),0 8px 10px -6px color-mix(in srgb,var(--stage-black) 10%,transparent)}
.scs .bth-df,.scs .bth-ds{padding:8px;border-bottom:1px solid var(--rc-zinc-800)}
.scs .bth-dl{margin-bottom:6px;font:600 var(--rc-text-9, 9px) var(--font-ui);letter-spacing:1.5px;text-transform:uppercase;color:var(--rc-zinc-400)}
.scs .bth-chips{display:flex;gap:4px;overflow-x:auto;scrollbar-width:thin}
.scs .bth-fc{flex:none;padding:6px 10px;border:1px solid var(--rc-zinc-800);background:none;font:600 var(--rc-text-10, 10px) var(--font-ui);letter-spacing:1px;text-transform:uppercase;color:var(--rc-zinc-400);cursor:pointer;transition:color .15s,background .15s}
.scs .bth-fc:hover{color:var(--stage-card);background:color-mix(in srgb,var(--rc-zinc-800) 70%,transparent)}
.scs .bth-fc.on{border-color:var(--w);background:var(--rc-zinc-800);color:var(--stage-card)}
.scs .bth-fc i{margin-left:6px;font-style:normal;color:var(--rc-zinc-500)}
.scs .bth-ds input{box-sizing:border-box;width:100%;padding:8px 12px;border:1px solid var(--rc-zinc-700);border-radius:var(--rc-radius-sm);background:var(--rc-zinc-800);font:var(--rc-text-sm)/1.25rem var(--font-ui);color:var(--stage-card);outline:none}
.scs .bth-ds input::placeholder{color:var(--rc-zinc-400)}
.scs .bth-ds input:focus{border-color:var(--w)}
.scs .bth-dlist{max-height:16rem;overflow-y:auto;scrollbar-width:thin}
.scs .bth-dnote{margin:0;padding:16px;text-align:center;font-size:var(--rc-text-sm);line-height:1.25rem;color:var(--rc-zinc-300)}
.scs .bth-grp{display:block}
.scs .bth-grp .grp-hd{position:sticky;top:0;z-index:10;display:block;margin:0;padding:12px 12px 4px;background:var(--rc-zinc-900);font:600 var(--rc-text-9, 9px) var(--font-ui);letter-spacing:1.5px;text-transform:uppercase;color:var(--rc-zinc-300)}
.scs .bth-opt{display:flex;width:100%;box-sizing:border-box;align-items:center;gap:12px;padding:12px;text-align:left;border:0;background:none;color:inherit;cursor:pointer;transition:background .15s}
.scs .bth-opt:hover:not(:disabled){background:var(--rc-zinc-800)}
.scs .bth-opt.cur{background:color-mix(in srgb,var(--rc-zinc-800) 50%,transparent)}
.scs .bth-opt:disabled{opacity:.5;cursor:not-allowed}
.scs .bth-badge{flex:none;padding:2px 6px;border-radius:var(--rc-radius);background:var(--w-soft);font:400 var(--rc-text-9, 9px) var(--font-ui);font-style:normal;color:var(--w)}
.scs .bth-ck{flex:none;display:grid;color:var(--stage-ok)}
.scs .bth-fb{margin-top:12px;padding:10px;border:1px solid var(--rc-zinc-800);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-900) 50%,transparent)}
.scs .bth-fb h4{margin:0 0 8px;font:600 var(--rc-text-10, 10px) var(--font-ui);letter-spacing:2px;text-transform:uppercase;color:var(--rc-zinc-300)}
.scs .bth-fb p{margin:4px 0 0;font:var(--rc-text-10, 10px)/1.625 var(--font-ui);color:var(--rc-zinc-400)}
.scs .bth-fb small{display:block;margin-top:6px;font-size:var(--rc-text-9, 9px);color:var(--rc-zinc-500)}
.scs .bth-modes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:8px}
.scs .bth-mode{padding:6px 8px;border:1px solid var(--rc-zinc-700);background:color-mix(in srgb,var(--rc-zinc-950) 50%,transparent);font:700 var(--rc-text-9, 9px) var(--font-ui);letter-spacing:1px;text-transform:uppercase;color:var(--rc-zinc-400);cursor:pointer;transition:color .15s,border-color .15s}
.scs .bth-mode:hover{border-color:var(--rc-zinc-500)}
.scs .bth-mode.on{border-color:var(--w);background:var(--rc-zinc-800);color:var(--stage-card)}
.scs .bth-fb .bth-pickwrap{margin-top:8px}
.scs .sliders.quick{grid-template-columns:1fr;gap:8px;padding:0}
.scs .sl.plain .slh{font-size:var(--rc-text-sm);line-height:1.25rem}
.scs .sl.plain .slv{padding:0;font-weight:600;cursor:default}
.scs .sl.plain .slv:hover{background:none}
.scs .sl.plain .slf{font-size:var(--rc-text-sm);color:var(--rc-zinc-300)}
.scs .sl.ctxcard{display:block}
.scs .sl.ctxcard .slm{margin-bottom:8px}
.scs .sl.ctxcard .slm>span{font-size:var(--rc-text-sm);font-weight:400;letter-spacing:0;text-transform:none;color:var(--rc-zinc-400)}
.scs .sl.ctxcard .seg button{padding:4px 10px;font-size:var(--rc-text-10, 10px);letter-spacing:.05em;text-transform:uppercase}
.scs .sl.ctxcard .seg button[aria-pressed=true]{background:var(--w);color:var(--stage-black)}
.scs .bth-maxed{margin:4px 0 0;font-size:var(--rc-text-11, 11px);line-height:1.375;color:color-mix(in srgb,var(--stage-warn) 90%,transparent)}
.scs .bth-sec .prop-row{display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--rc-zinc-700);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-800) 30%,transparent);transition:border-color .15s,background .15s}
.scs .bth-sec .prop-row+.prop-row{margin-top:8px}
.scs .bth-sec .prop-row:hover{border-color:var(--rc-zinc-600)}
.scs .bth-sec .prop-row:has(.tg.on){border-color:var(--w);background:var(--w-soft)}
.scs .bth-sec .prop-row .prop-ic{width:16px;height:16px;flex:none;display:grid;place-items:center;border:0;background:none;color:inherit}
.scs .bth-sec .prop-row .prop-ic svg{width:16px;height:16px}
.scs .bth-sec .prop-row b{display:block;font:400 var(--rc-text-sm)/1.25rem var(--font-ui);color:var(--rc-zinc-300)}
.scs .bth-sec .prop-row:has(.tg.on) b,.scs .bth-sec .prop-row:has(.tg.on) .prop-ic{color:var(--w)}
.scs .bth-sec .prop-row small{display:block;font-size:var(--rc-text-10, 10px);color:var(--rc-zinc-300)}
.scs .bth-nav{display:flex;flex-direction:column;align-items:center;margin:16px 16px 0;padding:20px;text-align:center;border:1px solid color-mix(in srgb,var(--w) 19%,transparent);border-radius:var(--rc-radius-sm);background:linear-gradient(180deg,color-mix(in srgb,var(--w) 9%,transparent) 0%,transparent 78%),color-mix(in srgb,var(--rc-zinc-950) 80%,transparent)}
.scs .bth-nav>b{font:600 1.125rem/1.75rem var(--font-ui);letter-spacing:.025em;color:var(--stage-card)}
.scs .bth-portrait{display:block;width:80px;height:80px;margin-bottom:12px;overflow:hidden;border:1px solid var(--w);border-radius:var(--rc-radius-full);background:var(--rc-zinc-950);box-shadow:0 0 20px color-mix(in srgb,var(--w) 25%,transparent)}
.scs .bth-portrait .por{position:static;width:100%;height:100%;box-shadow:none}
.scs .bth-tagline{max-width:28rem;margin-top:4px;font:var(--rc-text-sm)/1.25rem var(--font-ui);color:var(--rc-zinc-300)}
.scs .bth-tags{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:12px}
.scs .bth-tag{padding:2px 10px;border:1px solid var(--rc-zinc-700);border-radius:var(--rc-radius-sm);background:var(--rc-zinc-900);font:500 var(--rc-text-10, 10px) var(--font-ui);letter-spacing:.05em;text-transform:uppercase;color:var(--rc-zinc-300)}
.scs .bth-change{display:inline-flex;align-items:center;gap:8px;margin-top:16px;padding:6px 12px;border:1px solid color-mix(in srgb,var(--w) 31%,transparent);border-radius:var(--rc-radius-sm);background:none;color:var(--w);font:600 var(--rc-text-xs)/1rem var(--font-ui);letter-spacing:1.4px;text-transform:uppercase;cursor:pointer;transition:background .15s}
.scs .bth-change:hover{background:color-mix(in srgb,var(--stage-card) 10%,transparent)}
@container (max-width: 639px){.scs .bth-nav{margin:12px 12px 0}}
/* The Character Library dialog is portaled to the body, outside .scs, so its rules stand alone (like .bdk). */
.bth-libsheet.bth-libsheet{max-width:30rem;display:flex;flex-direction:column;max-height:calc(100vh - 2rem)}
.bth-lib{display:flex;flex-direction:column;gap:10px;min-height:0}
.bth-lib h2{margin:0;font:700 1.2rem var(--font-fancy)}
.bthl-eb{font:700 var(--text-meta) var(--font-big);letter-spacing:.16em;text-transform:uppercase;color:var(--text-dim)}
.bthl-search{display:flex;align-items:center;gap:8px;padding:6px 8px;border:2px solid var(--edge);background:var(--paper-2);color:var(--text-dim)}
.bthl-search input{flex:1;min-width:0;border:0;background:none;outline:0;color:var(--text);font:var(--text-control) var(--font-body)}
.bth-libl{display:flex;flex-direction:column;gap:2px;overflow-y:auto;min-height:6rem}
.bthl-row{display:flex;align-items:center;gap:10px;padding:6px 8px;border:0;background:none;text-align:left;color:var(--text);cursor:pointer}
.bthl-row:hover{background:var(--paper-2)}
.bthl-row .pn{display:flex;flex-direction:column;min-width:0}
.bthl-row small{font:var(--text-meta) var(--font-mono);color:var(--text-dim)}
.bthl-quiet{margin:0;padding:12px;font:var(--text-body) var(--font-big);color:var(--text-dim)}
.bth-face{width:36px;height:36px;flex:none;display:grid;place-items:center;overflow:hidden;border:2px solid var(--edge);background:var(--paper-2);font:700 1rem var(--font-fancy);color:var(--text-dim)}
.bth-face img{width:100%;height:100%;object-fit:cover}
`;
