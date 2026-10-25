/**
 * One message, to RoleCall's ImmersiveMessage.tsx (the default scene mode) and the shared SwipeCounter / MessageActionOverflow:
 * the 260x380 sticky portrait with its time at the foot and a zoom-in cursor (:268-345), the #N badge row, the 19px Cinzel speaker line
 * (immersive-cinematic.css:77), the 4px bubble with its glow layer (:1004-1030 assistant, :887-905 user), the floating action bar
 * with its hairline dividers and temperature-tinted icons (:1197-1460, accent-temperature.ts "cool" palette from the role tokens),
 * the meta line and the swipe counter (SwipeCounter.tsx:150-290), and the two menus (MessageActionOverflow.tsx:160-235, :1402).
 * The first block is what every theme needs of the portrait wrapper and the zoom button; the rest is RoleCall's look alone, so it sits under
 * rc-chrome.ts's `html[data-chrome="rolecall"]` and no other theme changes. composer-style.ts appends this sheet.
 */
import { seeThrough } from "./bubble-opacity";
import { RC, rcScope, rcSize } from "./rc-chrome";

const BLACK = seeThrough("var(--stage-black)", 55);
const EDGE = seeThrough("var(--stage-card)", 8);

/** The portrait wrapper keeps the sticky 260x380 slot the portrait had on its own; a scene with avatars off drops the whole column. */
const SHARED = `
.scs .msg .pw{flex:none;position:sticky;top:60px;align-self:flex-start;width:260px;height:380px}
.scs .msg .pw .por{position:relative;top:auto;width:100%;height:100%}
.scs .msg .pw .pstamp{display:none}
html .scs[data-look~="noavatar"] .msg .pw{display:none}
.scs .dd .menu-rule{margin:4px 0;border:0;border-top:1px solid var(--stage-seam)}
.scs .pzoom{position:absolute;inset:0;padding:0;border:0;background:none;cursor:zoom-in;transition:filter .15s}
.scs .pzoom:hover{filter:brightness(1.1)}
`;

const ROLECALL = `
@keyframes scs-msg-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.scs .msg{animation:scs-msg-in .6s ease}
.scs .msg.user{animation-duration:.4s}
.scs .msg.hid{opacity:.3}
.scs .msg.hid .por,.scs .msg.hid .bub{opacity:1}
@media (prefers-reduced-motion:reduce){.scs .msg{animation:none}}
.scs .msg .pw{max-width:28cqw;overflow:hidden;border-radius:var(--rc-r-portrait) 0 0 var(--rc-r-portrait);box-shadow:0 0 20px color-mix(in srgb,var(--tone) 8%,transparent)}
.scs .msg.user .pw{border-radius:0 var(--rc-r-portrait) var(--rc-r-portrait) 0;box-shadow:none}
.scs .msg .pw .por{border-radius:0;box-shadow:none;background:linear-gradient(135deg,color-mix(in srgb,var(--tone-fill,var(--tone)) 28%,var(--stage-black)),color-mix(in srgb,var(--tone-fill,var(--tone)) 14%,var(--stage-black)),color-mix(in srgb,var(--tone-fill,var(--tone)) 8%,var(--stage-black)))}
.scs .msg .pw .por:has(.ini)::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 30% 30%,color-mix(in srgb,var(--tone-fill,var(--tone)) 25%,transparent),transparent 60%)}
.scs .msg .pw .por .ini{font:600 36px var(--font-fancy);color:color-mix(in srgb,var(--tone) 65%,transparent)}
.scs .msg .pw .pstamp{display:block;position:absolute;left:0;right:0;bottom:8px;z-index:10;text-align:center;white-space:nowrap;pointer-events:none;font-size:${rcSize("9px")};color:color-mix(in srgb,var(--stage-card) 80%,transparent);text-shadow:0 1px 6px var(--stage-black),0 0 12px color-mix(in srgb,var(--stage-black) 80%,transparent)}
.scs .msg .meta .ts{display:none}
${RC} .scs:not([data-look~="noavatar"]) .msg .meta:not(:has(>:not(.ts))){display:none}
.scs .msg .body{padding-left:12px;overflow-wrap:break-word}
.scs .msg.user .body{padding-left:0;padding-right:12px}
.scs .msg .bnum{display:flex;justify-content:flex-start;margin-bottom:4px}
.scs .msg.user .bnum{justify-content:flex-end}
.scs .msg .bnum .badge{float:none;padding:2px 6px;border-radius:var(--rc-radius-sm);border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);background:color-mix(in srgb,var(--stage-black) 45%,transparent);font:400 ${rcSize("10px")}/1 var(--font-mono);color:var(--rc-zinc-300);box-shadow:0 1px 2px 0 color-mix(in srgb,var(--stage-black) 5%,transparent)}
.scs .msg .spk{clear:none;margin:0 0 6px;font:600 19px/1.5 var(--font-fancy);letter-spacing:3px;text-shadow:0 0 12px color-mix(in srgb,var(--tone) 20%,transparent)}
.scs .msg .bub{border-radius:var(--rc-radius);padding:14px 18px;transition:border-color .3s ease,box-shadow .3s ease}
.scs .msg.user .bub{padding:12px 16px}
.scs .msg .bub::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;box-shadow:0 0 30px ${seeThrough("var(--stage-black)", 35)},inset 0 1px 0 ${seeThrough("var(--stage-card)", 6)}}
.scs .msg.user .bub::before{box-shadow:0 0 28px ${seeThrough("var(--tone)", 12)},inset 0 1px 0 ${seeThrough("var(--stage-card)", 5)}}
.scs .msg .bub.live{border-color:color-mix(in srgb,var(--tone) 20%,transparent)}
.scs .msg .prose{font-family:var(--rc-font-inter);line-height:1.85;color:color-mix(in srgb,var(--stage-card) 95%,transparent);text-shadow:0 1px 3px color-mix(in srgb,var(--stage-black) 70%,transparent)}
.scs .msg.user .prose{color:var(--tone)}
.scs .msg .hidtag{display:block;margin:4px 0 0;font:500 ${rcSize("10px")}/1.5 var(--font-ui);letter-spacing:.05em;text-transform:uppercase;color:color-mix(in srgb,var(--stage-warn) 60%,transparent)}
.scs .msg .bub .acts{position:absolute;right:6px;bottom:6px;z-index:20;display:flex;flex-wrap:nowrap;gap:4px;margin:0;padding:4px;border-radius:var(--rc-radius-sm);background:${BLACK};border:1px solid ${EDGE};backdrop-filter:blur(4px);opacity:0;pointer-events:none;transition:opacity .3s}
.scs .msg.user .bub .acts{right:8px;bottom:8px}
@media (hover:hover){.scs .msg:hover .bub .acts{opacity:1;pointer-events:auto}}
.scs .msg.tap .bub .acts,.scs .msg .bub .acts.held,.scs .msg .bub .acts:focus-within{opacity:1;pointer-events:auto}
.scs .msg .bub .acts>button,.scs .msg .bub .acts>.hold>button{width:auto;height:auto;padding:6px;border-radius:var(--rc-radius);color:var(--rc-zinc-400);transition:background-color .15s,color .15s}
.scs .msg .bub .acts>button:hover,.scs .msg .bub .acts>.hold>button:hover{background:color-mix(in srgb,var(--stage-card) 10%,transparent)}
.scs .msg .bub .acts>button:disabled{opacity:.5;cursor:not-allowed}
.scs .msg .bub .acts>button.edit{color:var(--bk-role-action-text)}
.scs .msg .bub .acts>button.copy{color:color-mix(in srgb,var(--bk-role-action-text) 50%,var(--bk-role-ok-text))}
.scs .msg .bub .acts>button.copy[data-state="copied"]{color:var(--stage-ok)}
.scs .msg .bub .acts>button.copy[data-state="failed"]{color:var(--stage-danger-text)}
.scs .msg .bub .acts>button.gen{color:var(--bk-role-select-text)}
.scs .msg .bub .acts>button.gen.cont{color:var(--bk-role-ok-text)}
.scs .msg .bub .acts>button.hide{color:var(--stage-warn)}
.scs .msg .bub .acts>button.hide.on{color:var(--tone)}
.scs .msg .bub .acts>button.fcut{color:var(--bk-role-select-text)}
.scs .msg .bub .acts>.hold>button[aria-label="More message actions"]{color:var(--bk-role-action-text)}
.scs .msg .bub .acts>.hold>button.on{color:var(--tone)}
.scs .msg .bub .acts>.hold>button.del,.scs .msg .bub .acts>.hold>button.del svg{color:var(--stage-danger-text)}
.scs .msg .bub .acts>.hold>button.del.on{color:var(--tone)}
.scs .msg .bub .acts .sep{width:1px;height:16px;align-self:center;margin:0 2px;background:color-mix(in srgb,var(--stage-card) 10%,transparent)}
.scs .msg .bub .acts .menu{width:240px;right:0;padding:4px 0;border-radius:0;background:var(--stage-panel)}
.scs .msg .bub .acts .menu button{min-height:0;gap:10px;padding:8px 12px;font:400 var(--rc-text-xs)/1.5 var(--font-ui);color:var(--rc-zinc-100)}
.scs .msg .bub .acts .menu button svg{color:var(--rc-zinc-400)}
.scs .msg .bub .acts .menu button:hover{background:color-mix(in srgb,var(--stage-card) 5%,transparent)}
.scs .msg .bub .acts .menu .sec{padding:10px 12px 4px;font:600 ${rcSize("11px")}/1.5 var(--font-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--rc-zinc-500)}
.scs .msg .bub .acts .menu button.danger,.scs .msg .bub .acts .menu button.danger svg{color:var(--stage-danger-text)}
.scs .msg .bub .acts .dd{right:0;bottom:calc(100% + 8px);width:184px;min-width:0;padding:4px 0;border:2px solid var(--stage-black);border-radius:0;background:var(--stage-panel);box-shadow:4px 4px 0 0 var(--stage-black)}
.scs .msg .bub .acts .dd button{min-height:0;gap:8px;padding:8px 12px;font:400 var(--rc-text-xs)/1.5 var(--font-ui);color:var(--stage-danger-text)}
.scs .msg .bub .acts .dd button:hover{background:color-mix(in srgb,var(--stage-danger-text) 10%,transparent)}
.scs .msg .bub .acts .dd .menu-rule{margin:4px 0;border:0;height:1px;background:color-mix(in srgb,var(--stage-card) 10%,transparent)}
.scs .msg .meta{gap:10px;margin-top:8px;padding:0 4px}
.scs .msg .meta .mdl{font-size:${rcSize("11px")};color:var(--rc-zinc-500);opacity:.7}
.scs .msg .meta .swc{gap:2px;padding:2px 4px;border-radius:var(--rc-radius-sm);font-size:var(--rc-text-xs);background:${BLACK};border:1px solid ${EDGE};transition:background-color .3s,border-color .3s,box-shadow .3s}
.scs .msg .meta .swc.new{background:color-mix(in srgb,var(--tone) 15%,transparent);border-color:color-mix(in srgb,var(--tone) 40%,transparent);box-shadow:0 0 10px color-mix(in srgb,var(--tone) 15%,transparent)}
.scs .msg .meta .swc button{width:auto;height:auto;padding:4px;border-radius:var(--rc-radius-sm);color:var(--rc-zinc-300);transition:all .15s}
.scs .msg .meta .swc button:hover{color:var(--stage-white);background:color-mix(in srgb,var(--stage-card) 10%,transparent)}
.scs .msg .meta .swc button:disabled{color:var(--rc-zinc-600);background:none}
.scs .msg .meta .swc .ct{gap:6px;padding:2px 8px}
.scs .msg .meta .swc .sl{color:var(--rc-zinc-500)}
.scs .msg .meta .swc .nw{margin-left:2px;padding:2px 6px;border-radius:var(--rc-radius-sm);font-size:${rcSize("10px")};letter-spacing:.05em;color:var(--stage-ink)}
${RC} .scs[data-look~="noavatar"] .msg .meta .ts{display:inline}
`;

export const BUBBLE_STYLE = SHARED + rcScope(ROLECALL);
