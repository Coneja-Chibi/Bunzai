/**
 * The Prompting wing's styles, copied from RoleCall's PresetPanel.tsx (Tailwind classes converted to their values; the
 * line cited beside each group is where RoleCall sets it): the hero's tools, the sampler bar and its cards, the split
 * (prompt list with its grip, folded rail and rows; the editor with its header, fullscreen layer and macro preview) and
 * the preset picker. RoleCall's --wing-accent is --w here (the wing's tone); its --wing-accent-soft is --w-soft.
 * Sizes, corners and the zinc palette read the plan 19 tokens, so another theme keeps its own; the switches' and
 * the slider's own rules (.sw, .tg, input[type=range]) belong to the shared controls and are left as they were.
 */
export const PRESET_STYLE = `
.scs .wbody.pp{gap:0;padding:0;line-height:1.5;--w-soft:color-mix(in srgb,var(--w) 12%,transparent);font-family:var(--font-ui)}
.scs .pp-top{flex:none;padding:20px 20px 0}
.scs .pp .hero-tools{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-top:12px}
.scs .pp .tbtn,.scs .ed .tbtn{box-sizing:border-box;width:28px;height:28px;display:grid;place-items:center;border:1px solid transparent;border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--stage-card) 5%,transparent);color:var(--rc-zinc-300);cursor:pointer;flex:none;transition:background .15s,color .15s}
.scs .ed .tbtn{color:var(--rc-zinc-400)}
.scs .pp .tbtn:hover,.scs .ed .tbtn:hover{background:color-mix(in srgb,var(--stage-card) 10%,transparent);color:var(--stage-card)}
.scs .pp .tbtn.red:hover{background:var(--stage-danger-bg);color:var(--stage-danger-text)}
.scs .pp .tbtn.on{background:var(--w-soft);border-color:color-mix(in srgb,var(--w) 40%,transparent);color:var(--w)}
.scs .pp .hero.bad{--w:var(--stage-danger-text)}
.scs .pp .note{margin:12px 20px 0;padding:8px 12px;border-left:4px solid var(--stage-warn);background:color-mix(in srgb,var(--stage-warn) 10%,transparent);font:var(--rc-text-wing)/1.5 var(--font-ui);color:var(--stage-card)}
.scs .sbar{position:relative;z-index:10;flex:none;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);background:color-mix(in srgb,var(--rc-zinc-900) 50%,transparent)}
.scs .sbar-row{display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;padding:8px 16px;font:inherit;cursor:pointer;border:0;background:none;text-align:left;color:inherit;transition:background .15s}
.scs .sbar-row:hover{background:color-mix(in srgb,var(--rc-zinc-800) 30%,transparent)}
.scs .sbar-vals{display:flex;flex-wrap:wrap;align-items:center;gap:0 16px;font-size:var(--rc-text-wing)}
.scs .sbar .lbl{color:var(--rc-zinc-300)}
.scs .qv{display:flex;align-items:center;gap:4px;white-space:nowrap}
.scs .qv .ql{color:var(--rc-zinc-400)}
.scs .qv b{color:var(--c);font-weight:400}
.scs .pp .ov{display:inline-block;flex:none;width:6px;height:6px;margin-left:6px;border-radius:var(--rc-radius-full);background:var(--w);animation:pp-pulse 2s cubic-bezier(.4,0,.6,1) infinite}
.scs .qv .ov,.scs .slh .ov{margin-left:0}
@keyframes pp-pulse{50%{opacity:.5}}
@media (prefers-reduced-motion:reduce){.scs .pp .ov{animation:none}}
.scs .sbar .chev{flex:none;display:grid;color:var(--rc-zinc-300);transition:transform .15s}
.scs .sbar .chev.up{transform:rotate(180deg)}
.scs .sliders{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px 16px}
.scs .sl{--slider-color:var(--c);min-width:0;padding:12px;border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-800) 50%,transparent)}
.scs .sl .slhd{margin-bottom:8px}
.scs .sl .slm{display:flex;align-items:center;justify-content:space-between;gap:8px}
.scs .sl .slm>span{font-size:var(--rc-text-ctl);font-weight:500;text-transform:uppercase;letter-spacing:.05em;color:var(--rc-zinc-300)}
.scs .sl .slh{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;font-size:var(--rc-text-wing)}
.scs .sl .slh>span{display:flex;align-items:center;gap:4px;color:var(--rc-zinc-400)}
.scs .sl .slh>.slh-pp{font-weight:500;color:var(--c)}
.scs .sl .slq{display:grid;padding:0;border:0;background:none;color:inherit;cursor:pointer;transition:color .15s}
.scs .sl .slq:hover{color:var(--rc-zinc-200)}
.scs .sl .reset{margin:0 0 0 auto;border:0;background:none;padding:0;font:var(--rc-text-ctl) var(--font-mono);color:var(--rc-zinc-400);text-decoration:line-through;cursor:pointer}
.scs .sl .slv{padding:2px 6px;border:0;border-radius:var(--rc-radius);background:none;font:inherit;font-weight:500;color:var(--c);cursor:text;transition:background .15s}
.scs .sl .slv:hover{background:color-mix(in srgb,var(--rc-zinc-700) 50%,transparent)}
.scs .sl .slv-in{box-sizing:border-box;width:80px;padding:2px 6px;border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);border-radius:var(--rc-radius);background:var(--rc-zinc-900);font:inherit;font-weight:500;text-align:right;color:var(--c);outline:none}
.scs .sl .slv-in:focus{box-shadow:0 0 0 1px var(--stage-link)}
.scs .sl .slhelp{margin:0 0 8px;padding:8px;border:1px solid var(--rc-zinc-700);border-radius:var(--rc-radius);background:color-mix(in srgb,var(--rc-zinc-900) 80%,transparent);font-size:var(--rc-text-wing);color:var(--rc-zinc-300)}
.scs .sl p.slhelp{margin:8px 0 0;padding:0;border:0;background:none;font-size:var(--rc-text-ctl);line-height:1.625}
.scs .sl .slf{margin-top:8px;display:flex;align-items:center;gap:8px;font-size:var(--rc-text-ctl);color:var(--rc-zinc-300)}
.scs .sl .slf i{font-style:normal;color:var(--rc-zinc-400)}
.scs .sl .slf b{font-weight:500;color:var(--w);font-variant-numeric:tabular-nums}
.scs .sl input[type=range]{width:100%;accent-color:var(--w)}
.scs .sl .seg{display:flex;overflow:hidden;border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);border-radius:var(--rc-radius-sm);font-size:var(--rc-text-ctl)}
.scs .sl .seg button{padding:2px 10px;border:0;background:color-mix(in srgb,var(--rc-zinc-900) 50%,transparent);font:inherit;font-weight:500;text-transform:capitalize;color:var(--rc-zinc-300);cursor:pointer;transition:color .15s,background .15s}
.scs .sl .seg button:hover{color:var(--rc-zinc-100)}
.scs .sl .seg button[aria-pressed=true]{background:var(--w-soft);color:var(--w)}
.scs .sl select{box-sizing:border-box;width:100%;padding:6px 8px;border:1px solid var(--rc-zinc-700);border-radius:var(--rc-radius);background:var(--rc-zinc-900);font:var(--rc-text-wing) var(--font-ui);color:var(--stage-card);outline:none}
.scs .sl select:focus{border-color:var(--w)}
.scs .split{position:relative;z-index:10;display:flex;flex:none;height:100%;min-height:0;overflow:hidden}
.scs .side{position:relative;z-index:20;width:var(--side-w,220px);flex:none;display:flex;flex-direction:column;min-height:0;background:color-mix(in srgb,var(--rc-zinc-950) 90%,transparent);border-right:1px solid color-mix(in srgb,var(--w) 30%,transparent);transition:width .3s}
.scs .split:has(.grip:active) .side{transition:none}
.scs .side.rail{width:48px}
.scs .side-list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain}
/* VIRTUALIZED: .side-list is the scroll element; .side-inner is the
   virtualizer's sized spacer, .side-listrow one absolutely-positioned row (a category header or a
   prompt), the same shape as the Library's List view (views/list.tsx .dv-list/.dv-listrow). */
.scs .side-inner{position:relative;width:100%}
.scs .side-listrow{position:absolute;top:0;left:0;right:0}
.scs .side-hd{flex:none;display:flex;align-items:center;justify-content:space-between;gap:4px;padding:8px;border-bottom:1px solid color-mix(in srgb,var(--rc-zinc-700) 50%,transparent);font-size:var(--rc-text-wing);text-transform:uppercase;letter-spacing:.05em;color:var(--rc-zinc-300)}
.scs .side-ct{display:flex;align-items:center;gap:4px;text-transform:none;letter-spacing:0;color:var(--rc-zinc-400)}
.scs .side-co,.scs .side-ex{display:grid;place-items:center;padding:0;border:0;background:none;cursor:pointer;transition:background .15s,color .15s}
.scs .side-co{width:20px;height:20px;border-radius:var(--rc-radius);color:var(--rc-zinc-300)}
.scs .side-co:hover{background:color-mix(in srgb,var(--rc-zinc-700) 50%,transparent);color:var(--stage-card)}
.scs .side-ex{width:100%;padding:4px 0;color:var(--rc-zinc-400)}
.scs .side-ex:hover{color:var(--stage-card)}
.scs .sbw{flex:none;padding:6px 8px;border-bottom:1px solid color-mix(in srgb,var(--rc-zinc-700) 50%,transparent)}
.scs .sb{position:relative}
.scs .sb>svg{position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--rc-zinc-300);pointer-events:none}
.scs .sb input{box-sizing:border-box;width:100%;padding:4px 24px 4px 24px;border:1px solid color-mix(in srgb,var(--rc-zinc-700) 50%,transparent);border-radius:var(--rc-radius);background:color-mix(in srgb,var(--rc-zinc-800) 50%,transparent);font:var(--rc-text-wing) var(--font-ui);color:var(--rc-zinc-300);outline:none}
.scs .sb input::placeholder{color:var(--rc-zinc-400)}
.scs .sb input:focus{border-color:var(--w)}
.scs .sb .side-clr{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:16px;height:16px;display:grid;place-items:center;padding:0;border:0;border-radius:var(--rc-radius);background:none;color:var(--rc-zinc-300);cursor:pointer}
.scs .sb .side-clr:hover{background:color-mix(in srgb,var(--rc-zinc-600) 50%,transparent);color:var(--stage-card)}
.scs .sb.lg>svg{left:10px}
.scs .sb.lg input{padding:6px 12px 6px 32px;border-radius:var(--rc-radius-sm)}
.scs .side-empty{display:flex;flex-direction:column;align-items:center;padding:32px 16px;text-align:center}
.scs .side-empty>span,.scs .pk-empty>span,.scs .ed-empty>span{display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--rc-zinc-700) 50%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-800) 50%,transparent);color:var(--rc-zinc-400)}
.scs .side-empty>span,.scs .pk-empty>span{width:48px;height:48px;margin-bottom:12px}
.scs .side-empty p,.scs .pk-empty p{margin:0;font-size:var(--rc-text-wing);color:var(--rc-zinc-400)}
.scs .cat{display:flex;width:100%;box-sizing:border-box;align-items:center;gap:6px;padding:8px;font-size:var(--rc-text-wing);color:var(--rc-zinc-400);border-top:1px solid color-mix(in srgb,var(--rc-zinc-800) 50%,transparent);background:none;text-align:left;transition:background .15s}
.scs .side-listrow[data-index="0"] .cat{border-top:0}
.scs .cat:hover{background:color-mix(in srgb,var(--rc-zinc-800) 30%,transparent)}
.scs .cat.acc{color:color-mix(in srgb,var(--w) 80%,transparent)}
.scs .cat.sub{padding:6px 8px;border-top:0;border-left:1px solid color-mix(in srgb,var(--w) 40%,transparent);color:color-mix(in srgb,var(--w) 60%,transparent)}
.scs .cat-t{flex:1;min-width:0;display:flex;align-items:center;gap:4px;border:0;padding:0;background:none;color:inherit;font:inherit;cursor:pointer;text-align:left}
.scs .cat .cn{flex:1;min-width:0;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scs .cat.sub .cn{font-weight:400}
.scs .cat .cc{flex:none;color:var(--rc-zinc-300)}
.scs .cat.sub .cc{font-size:var(--rc-text-ctl);color:var(--rc-zinc-400)}
.scs .cat .cv{display:grid;flex:none}
.scs .cat .cv.r{transform:rotate(-90deg)}
.scs .sw,.scs .tg{position:relative;flex:none;border:0;padding:0;background:var(--stage-line);cursor:pointer}
.scs .sw{width:24px;height:14px;border-radius:0}
.scs .sw::after,.scs .tg::after{content:"";position:absolute;top:2px;left:2px;border-radius:0;background:var(--stage-white)}
.scs .sw::after{width:10px;height:10px}
.scs .sw.on{background:var(--stage-ok)}.scs .sw.on::after{left:12px}
.scs .sw.some{background:var(--w)}
.scs .tg{width:32px;height:16px;border-radius:0}
.scs .tg::after{width:12px;height:12px}
.scs .tg.on{background:var(--stage-ok)}.scs .tg.on::after{left:18px}
.scs .pi{display:flex;align-items:center;gap:8px;padding:6px 8px;border-left:2px solid transparent;cursor:pointer;transition:background .15s}
.scs .pi:hover{background:color-mix(in srgb,var(--rc-zinc-800) 50%,transparent)}
.scs .pi.sel{border-left-color:var(--w);background:var(--w-soft)}
.scs .pi.off{opacity:.5}
.scs .ind{border-left:1px solid color-mix(in srgb,var(--w) 40%,transparent)}
.scs .pn{flex:1;min-width:0}
.scs .pn span{display:block;font-size:var(--rc-text-wing);color:var(--rc-zinc-400);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.scs .pn span::before{content:"";display:inline-block;width:6px}
.scs .pi.sel .pn span{color:var(--stage-card)}
.scs .pn small{display:block;padding-left:20px;font-size:var(--rc-text-ctl);color:var(--rc-zinc-400)}
.scs .pn small.mk{color:color-mix(in srgb,var(--deck-lorebook) 70%,transparent)}
.scs .role{flex:none;padding:2px 6px;border-radius:var(--rc-radius);font-size:var(--rc-text-p72rem, .72rem);font-weight:500;background:color-mix(in srgb,var(--rc-zinc-500) 20%,transparent);color:var(--rc-zinc-400)}
.scs .role.system{background:color-mix(in srgb,var(--deck-preset) 20%,transparent);color:var(--deck-preset)}
.scs .role.user{background:color-mix(in srgb,var(--stage-ok) 20%,transparent);color:var(--stage-ok)}
.scs .role.assistant{background:color-mix(in srgb,var(--deck-lorebook) 20%,transparent);color:var(--deck-lorebook)}
.scs .side-rail{flex:1;min-height:0;overflow-y:auto;padding:8px 0}
.scs .rail-i{display:flex;width:100%;align-items:center;justify-content:center;padding:8px 0;border:0;background:none;color:var(--rc-zinc-400);cursor:pointer;transition:background .15s,color .15s}
.scs .rail-i:hover{background:color-mix(in srgb,var(--rc-zinc-700) 30%,transparent);color:var(--stage-card)}
.scs .rail-i.sel{background:var(--w-soft);color:var(--w)}
.scs .side-foot{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px;border-top:1px solid color-mix(in srgb,var(--rc-zinc-700) 30%,transparent);background:color-mix(in srgb,var(--rc-zinc-800) 20%,transparent);font-size:var(--rc-text-ctl);color:var(--rc-zinc-300)}
.scs .side-foot>span+span{color:var(--rc-zinc-400);text-align:right}
.scs .side.rail .side-foot{display:none}
.scs .grip{flex:none;touch-action:none;outline:none}
.scs .grip.col{width:6px;margin-left:-1px;display:flex;align-items:stretch;justify-content:center;cursor:col-resize}
.scs .grip.col>i{width:2px;transition:background .15s}
.scs .grip.row{position:absolute;top:-10px;left:0;right:0;z-index:10;height:12px;display:flex;align-items:center;justify-content:center;cursor:row-resize}
.scs .grip.row>i{width:40px;height:3px;border-radius:var(--rc-radius-full);background:var(--rc-zinc-600);transition:background .15s}
.scs .grip.col:hover>i,.scs .grip.col:focus-visible>i{background:color-mix(in srgb,var(--w) 50%,transparent)}
.scs .grip.row:hover>i,.scs .grip.row:focus-visible>i{background:color-mix(in srgb,var(--w) 60%,transparent)}
.scs .grip:active>i{background:color-mix(in srgb,var(--w) 80%,transparent)}
.scs .ed{flex:1;min-width:0;min-height:0;display:flex;overflow:hidden}
.scs .ed-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-size:var(--rc-text-wing);color:var(--rc-zinc-300)}
.scs .ed-empty>span{width:56px;height:56px;margin-bottom:12px}
.scs .ed-empty p{margin:0}
.scs .ed-empty small{margin-top:4px;font-size:var(--rc-text-ctl);color:var(--rc-zinc-400)}
.scs .ed-body{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden}
.scs .ed-hd{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 16px;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent)}
.scs .ed-l{flex:1;min-width:0;display:flex;align-items:center;gap:12px}
.scs .ed-r{flex:none;display:flex;align-items:center;gap:8px}
.scs .ed-hd .nmx{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--rc-text-sm);line-height:1.25rem;font-weight:600;color:var(--stage-card)}
.scs .ed-hd .tk{font-size:var(--rc-text-ctl);color:var(--rc-zinc-300)}
.scs .ed-main{flex:1;min-height:0;display:flex;flex-direction:column;gap:12px;padding:16px}
.scs .ed-meta{flex:none;display:flex;gap:6px;flex-wrap:wrap}
.scs .chip{padding:2px 8px;font-size:var(--rc-text-ctl);border-radius:var(--rc-radius);border:1px solid color-mix(in srgb,var(--w) 40%,transparent);color:var(--w);background:var(--w-soft)}
.scs .chip.dim{border-color:color-mix(in srgb,var(--stage-card) 10%,transparent);color:var(--rc-zinc-400);background:none}
.scs .ed textarea{box-sizing:border-box;flex:1;min-height:0;width:100%;padding:12px;background:color-mix(in srgb,var(--stage-black) 60%,transparent);border:2px solid var(--rc-zinc-700);box-shadow:inset 2px 2px 0 0 color-mix(in srgb,var(--stage-black) 40%,transparent);font:var(--rc-text-p92rem, .92rem)/1.5 var(--font-mono);color:var(--rc-zinc-100);resize:none;outline:none;touch-action:pan-y}
.scs .ed textarea:focus{border-color:var(--w);box-shadow:0 0 0 2px var(--w-soft),inset 2px 2px 0 0 color-mix(in srgb,var(--stage-black) 40%,transparent)}
.scs .ed-marker{flex:none;padding:8px 12px;border:2px solid color-mix(in srgb,var(--w) 60%,transparent);background:var(--w-soft);font-size:var(--rc-text-wing);color:var(--rc-zinc-300)}
.scs .ed-marker b{font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--w)}
.scs .ed-note{flex:none;display:flex;gap:8px;align-items:flex-start;font-size:var(--rc-text-ctl);line-height:1.5;color:var(--rc-zinc-400)}
.scs .ed-note svg{color:var(--stage-ok);flex:none;margin-top:2px}
.scs .ed-note.warn svg{color:var(--stage-warn)}
.scs .fs-layer{--w-soft:color-mix(in srgb,var(--w) 12%,transparent);position:absolute;inset:0;z-index:100;display:flex;flex-direction:column;background:var(--rc-zinc-950);line-height:1.5;font-family:var(--font-ui)}
.scs .fs-layer .fs-ed{flex:1}
.scs .mp{position:relative;flex:none;display:flex;flex-direction:column;border:2px solid var(--rc-zinc-800);background:var(--rc-zinc-950)}
.scs .mp.mp-full{flex:1;min-height:0}
.scs .mp-hd{flex:none;display:flex;align-items:center;gap:8px;padding:12px 12px 8px}
.scs .mp-t,.scs .mp-n{font-size:var(--rc-text-micro);font-weight:700;text-transform:uppercase}
.scs .mp-t{letter-spacing:.2em;color:var(--w)}
.scs .mp-n{letter-spacing:.16em;color:var(--rc-zinc-400)}
.scs .mp-x{margin-left:auto;width:24px;height:24px;display:grid;place-items:center;padding:0;border:0;border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--stage-card) 5%,transparent);color:var(--rc-zinc-400);cursor:pointer;transition:background .15s,color .15s}
.scs .mp-x:hover{background:color-mix(in srgb,var(--stage-card) 10%,transparent);color:var(--stage-card)}
.scs .mp-body{flex:1;min-height:0;overflow-y:auto;padding:0 12px 12px}
.scs .mp-body pre{margin:0;font:var(--rc-text-wing)/1.625 var(--font-mono);color:var(--rc-zinc-300);white-space:pre-wrap;word-break:break-word}
.scs .mp-m{display:inline-flex;align-items:center}
.scs .mp-b{color:var(--rc-zinc-500)}
.scs .mp-name{font-weight:700;color:var(--w)}
.scs .mp-arg{font-weight:500;color:var(--stage-warn)}
.scs .picker{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column}
.scs .pk-search{flex:none;padding:8px 12px;border-bottom:1px solid color-mix(in srgb,var(--rc-zinc-800) 50%,transparent)}
.scs .pk-hd{flex:none;margin:0;padding:8px 12px;border-bottom:1px solid color-mix(in srgb,var(--rc-zinc-800) 50%,transparent);font-size:var(--rc-text-ctl);font-weight:500;text-transform:uppercase;letter-spacing:.05em;color:var(--rc-zinc-300)}
.scs .pk{flex:none;display:flex;width:100%;box-sizing:border-box;align-items:flex-start;gap:12px;padding:8px 12px;border:0;border-left:2px solid transparent;background:none;cursor:pointer;text-align:left;font-family:var(--font-ui);transition:background .15s}
.scs .pk:hover{background:color-mix(in srgb,var(--rc-zinc-800) 50%,transparent)}
.scs .pk.cur{border-left-color:var(--w);background:color-mix(in srgb,var(--w) 15%,transparent)}
.scs .pk>div{flex:1;min-width:0}
.scs .pk-n{display:flex!important;align-items:center;gap:8px}
.scs .pk b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--rc-text-wing);font-weight:500;color:var(--rc-zinc-300)}
.scs .pk.cur b{color:var(--w)}
.scs .pk-n i{flex:none;padding:2px 6px;border-radius:var(--rc-radius);background:color-mix(in srgb,var(--w) 30%,transparent);font-size:var(--rc-text-p7rem, .7rem);font-style:normal;color:var(--w)}
.scs .pk small{display:block;margin-top:2px;font-size:var(--rc-text-ctl);color:var(--rc-zinc-300)}
.scs .pk-ic{width:32px;height:32px;flex:none;display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--rc-zinc-700) 50%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-800) 50%,transparent);font-size:var(--rc-text-sm);color:var(--rc-zinc-300)}
.scs .pk.cur .pk-ic{border-color:color-mix(in srgb,var(--w) 40%,transparent);background:color-mix(in srgb,var(--w) 20%,transparent)}
.scs .pk.none{align-items:center;padding:10px 12px;border-bottom:1px solid color-mix(in srgb,var(--rc-zinc-800) 50%,transparent)}
.scs .pk.none b{font-size:var(--rc-text-sm);line-height:1.25rem;color:var(--rc-zinc-400)}
.scs .pk.none:hover b{color:var(--rc-zinc-200)}
.scs .pk.none small{margin:0;color:var(--rc-zinc-400)}
.scs .pk-empty{display:flex;flex-direction:column;align-items:center;padding:32px 16px;text-align:center}
.scs .pk-empty small{margin-top:4px;font-size:var(--rc-text-ctl);color:var(--rc-zinc-400)}
@container (max-width: 1023px){
.scs .split{flex-direction:column;height:auto;overflow:visible}
.scs .side,.scs .side.rail{width:100%;max-height:min(50vh,360px);border-right:0;border-bottom:1px solid color-mix(in srgb,var(--w) 30%,transparent)}
.scs .side.rail{max-height:none}
.scs .side-rail{display:flex;flex-wrap:wrap;padding:0}
.scs .rail-i{width:48px}
.scs .grip{display:none}
.scs .ed{min-height:480px}
.scs .pp-top{padding:12px 12px 0}
}
@container (max-width: 639px){
.scs .sliders{grid-template-columns:1fr}
}
`;
