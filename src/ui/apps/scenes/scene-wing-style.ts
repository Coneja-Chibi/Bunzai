/**
 * The default theme's wing shell, measured from RoleCall (every value names its source): `WingRail.tsx` and `WingItem.tsx` (the glass rail, the icon states, the labels and the long help), `WingPanelContainer.tsx`
 * (the panel surface, the push-aside, the drag edge, the narrow backdrop), `wing-shell/WingShell.tsx` (the hero, the body padding) and `FoldoutTabs.tsx` (the sticky tab strip). Everything here is keyed on
 * `html[data-chrome="rolecall"]`; other themes keep the pause-and-blur overlay and their own wings variants (the base rules in scene-style.ts). Colors are the `--rc-*` tokens, so a
 * theme that does not define them keeps its own palette. Tailwind's `ease-out` is cubic-bezier(0,0,.2,1) and its default curve cubic-bezier(.4,0,.2,1), not the CSS keywords.
 */
const C = 'html[data-chrome="rolecall"] .scs';
const OUT = "cubic-bezier(0,0,.2,1)";
const STD = "cubic-bezier(.4,0,.2,1)";
const mix = (color: string, pct: number): string => `color-mix(in srgb,${color} ${pct}%,transparent)`;
const WHITE = "var(--stage-white)";
const BLACK = "var(--stage-black)";
const VIOLET = "var(--rc-violet-500,var(--accent))";
const ZINC950 = "var(--rc-zinc-950)";
const SMALL = "639px";

export const WING_STYLE = `
/* Opening a wing pushes the chat aside and a press outside closes it: no blur, no Scene Paused mark (WingPanelContainer.tsx: flex-basis 300ms ease-out, content margin 80 to 0) */
${C}.paused .play{filter:none;pointer-events:auto}
${C} .paused-mark{display:none}
${C} .chat{left:80px;right:80px;transition:left .3s ${OUT},right .3s ${OUT}}
${C} .scroll{left:0;right:0}
${C}.open-l .chat{left:min(var(--wing-w),100%)}
${C}.open-r .chat{right:min(var(--wing-w),100%)}
${C}[data-resizing] :is(.chat,.wslot){transition:none}
${C} .wslot{display:block;position:absolute;top:0;bottom:0;z-index:48;overflow:hidden;width:0;opacity:0;pointer-events:none;transition:width .3s ${OUT},opacity .3s ${OUT}}
${C} .wslot.l{left:0}
${C} .wslot.r{right:0}
${C} .wslot.open{width:min(var(--wing-w),100%);opacity:1;pointer-events:auto}
/* The panel: bg-zinc-950/90, border-white/5 on the chat-facing edge, 50px of rail inside the width (WingPanelContainer.tsx panelSurfaceClass, pl-[50px]) */
${C} .wslot>.wing-panel{position:relative;inset:auto;width:100%!important;height:100%;background:${mix(ZINC950, 90)};color:var(--rc-zinc-200)}
${C} .wslot>.wing-panel.l{padding:0 0 0 50px;border-right:1px solid ${mix(WHITE, 5)}}
${C} .wslot>.wing-panel.r{padding:0 50px 0 0;border-left:1px solid ${mix(WHITE, 5)}}
${C} .wp-edge,${C} .wp-depth,${C} .wp-sheen{display:block;position:absolute;pointer-events:none}
${C} .wp-edge{top:40px;bottom:40px;width:1px;opacity:.5;z-index:20;background:linear-gradient(to bottom,transparent,${VIOLET},transparent)}
${C} .wing-panel.l .wp-edge{left:0}
${C} .wing-panel.r .wp-edge{right:0}
${C} .wp-depth{inset:0;z-index:0}
${C} .wing-panel.l .wp-depth{box-shadow:20px 0 60px ${mix(BLACK, 50)},40px 0 80px ${mix(VIOLET, 3)}}
${C} .wing-panel.r .wp-depth{box-shadow:-20px 0 60px ${mix(BLACK, 50)},-40px 0 80px ${mix(VIOLET, 3)}}
${C} .wp-sheen{inset:0;z-index:10;opacity:.1;background:linear-gradient(145deg,${mix(WHITE, 10)} 0%,transparent 40%)}
/* The drag edge: 8px on the chat-facing edge, a 2px accent line on hover (50%) and while dragged (80%) */
${C} .wedge{display:block;position:absolute;top:0;bottom:0;z-index:50;width:8px;cursor:col-resize;touch-action:none;outline:none}
${C} .wedge.l{right:0}
${C} .wedge.r{left:0}
${C} .wedge::after{content:"";position:absolute;top:0;bottom:0;width:2px;background:transparent;transition:background-color .15s ${STD}}
${C} .wedge.l::after{right:0}
${C} .wedge.r::after{left:0}
${C} .wedge:is(:hover,:focus-visible)::after{background:${mix("var(--accent)", 50)}}
${C} .wedge.drag::after{background:${mix("var(--accent)", 80)}}
/* The rail: opacity .8 (no hover lift while a wing is open), the edge fade (from-zinc-950/60 on the inner side), 500ms ease-out on width and opacity */
${C} .rail{transition:width .5s ${OUT},opacity .5s ${OUT}}
${C}.open-l .rail.l:hover,${C}.open-r .rail.r:hover{opacity:.8}
${C} .rail.l{background-image:linear-gradient(to left,${mix(ZINC950, 60)},transparent)}
${C} .rail.r{background-image:linear-gradient(to right,${mix(ZINC950, 60)},transparent)}
${C} .wi::before{border-radius:var(--rc-radius-full);transition:all .5s ${STD}}
${C} .wi{color:${mix(WHITE, 45)}}
${C} .wi svg{transition:all .3s ${OUT}}
${C} .wi:hover{color:var(--w)}
${C} .wi.on,${C} .wi.on:hover{color:${WHITE}}
/* Labels: 260px, the label fill with a 3px black border and the wing's color as a hard 6px shadow; Cinzel 900 title, Inter task line (WingItem.tsx tooltip) */
${C} .tip{top:50%;width:260px;padding:12px 16px;background:var(--rc-tip,var(--stage-panel));border:3px solid ${BLACK};box-shadow:6px 6px 0 0 var(--w);opacity:0;transform:translateY(-60%);transition:opacity .2s ${OUT},transform .2s ${OUT}}
${C} .rail.l .tip{left:var(--tip-off)}
${C} .rail.r .tip{right:var(--tip-off)}
${C} .wi:hover .tip{opacity:0;transform:translateY(-60%)}
${C} .wi .tip.show{opacity:1;transform:translateY(-50%);pointer-events:auto}
${C} .tip b{font-size:.95rem;line-height:1.05}
${C} .tip span{margin-top:6px;font-family:var(--font-ui,var(--font-body));font-size:.76rem;font-weight:600;line-height:1.375;color:var(--rc-zinc-100)}
${C} .tipd{display:block;position:absolute;top:50%;z-index:30;width:290px;padding:12px 16px;background:var(--rc-tip-detail,var(--stage-panel));border:2px solid var(--w);box-shadow:5px 5px 0 0 ${BLACK};color:var(--rc-zinc-200);font:400 .82rem/1.45 var(--font-ui,var(--font-body));text-align:left;white-space:normal;opacity:0;transform:translateY(-58%);transition:opacity .2s ${OUT},transform .2s ${OUT};pointer-events:none}
${C} .rail.l .tipd{left:var(--help-off,calc(var(--tip-off) + 272px))}
${C} .rail.r .tipd{right:var(--help-off,calc(var(--tip-off) + 272px))}
${C} .tipd.show{opacity:1;transform:translateY(-50%);pointer-events:auto}
/* The tab strip sticks to the top of the panel: border-white/10, bg-zinc-950/95, px-4 py-3 (FoldoutTabs.tsx) */
${C} .fold{position:sticky;top:0;z-index:30;flex:none;padding:12px 16px;border-bottom:1px solid ${mix(WHITE, 10)};background:${mix(ZINC950, 95)}}
${C} .crumb{gap:8px;margin-bottom:8px;padding:0 2px;min-width:0;font-size:.62rem;font-weight:600;letter-spacing:.18em;color:var(--rc-zinc-500)}
${C} .crumb b{font-weight:600;color:var(--rc-zinc-200)}
${C} .crumb i{color:var(--rc-zinc-700)}
${C} .crumb .cl{margin-left:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* Tabs: flex-wrap gap-1.5 pb-1; each tab flex-1 basis-24 min-w-0 px-2 py-2 text-left, label and meta stacked (FoldoutTabs.tsx:43-59) */
${C} .tabs{flex-wrap:wrap;gap:6px;margin-top:0;padding-bottom:4px}
${C} .tabs button{flex:1 1 96px;min-width:0;padding:8px;text-align:left;border:1px solid ${mix(WHITE, 10)};background:${mix(WHITE, 3)};color:var(--rc-zinc-400);font-family:var(--font-ui,var(--font-body));transition:border-color .15s ${STD},color .15s ${STD}}
${C} .tabs button:hover{border-color:${mix(WHITE, 20)};color:var(--rc-zinc-100)}
${C} .tabs button.on{border-color:${mix(WHITE, 30)};background:${mix(WHITE, 10)};color:var(--rc-zinc-50)}
${C} .tabs b{display:block;overflow-wrap:break-word;font-size:.75rem;line-height:1.25;font-weight:600;text-transform:uppercase;letter-spacing:.025em}
${C} .tabs small{display:block;margin-top:4px;font-size:.75rem;line-height:1rem;opacity:.6}
/* The body and the hero (WingShell.tsx: WingBody px-6 py-5 space-y-5, WingHero) */
${C} .wbody{padding:20px 24px;gap:20px}
${C} .hero{gap:16px;padding:24px;border:1px solid ${mix("var(--w)", 35)};background-color:${mix(BLACK, 40)};background-image:radial-gradient(ellipse at top left,${mix("var(--w)", 12)},transparent 55%),linear-gradient(135deg,${mix("var(--rc-hero-from,var(--stage-row))", 90)},${mix("var(--rc-canvas,var(--stage-well))", 90)});box-shadow:6px 6px 0 0 ${mix("var(--w)", 12)}}
${C} .hero .hi{width:48px;height:48px;border:2px solid ${mix("var(--w)", 70)};background:${BLACK};color:var(--w)}
${C} .hero .eb{font-size:.74rem;font-weight:700;letter-spacing:.24em;color:var(--w)}
${C} .hero h2{margin:8px 0 0;font-family:var(--font-fancy);font-size:2rem;font-weight:900;line-height:.95;letter-spacing:.05em;color:var(--rc-zinc-50);text-shadow:3px 3px 0 ${BLACK};overflow-wrap:break-word}
${C} .hero p{margin:10px 0 0;max-width:42rem;font-family:var(--font-ui,var(--font-body));font-size:.95rem;line-height:1.625;color:var(--rc-zinc-300)}
@container (max-width:${SMALL}){
${C} .fold{padding:8px}
${C} .hero{gap:12px;padding:20px 16px}
${C} .hero .hi{width:40px;height:40px}
${C} .hero .eb{font-size:.7rem;letter-spacing:.18em}
${C} .hero h2{font-size:1.5rem;letter-spacing:.04em}
${C} .hero p{font-size:.875rem}
}
/* Narrow: the panel takes the full width over a black/60 blur-sm backdrop and nothing is pushed (WingPanelContainer.tsx isMobile); the rail row stays as the way between wings */
@container (max-width:1023px){
${C} .chat{left:0!important;right:0!important}
${C} .wslot{top:calc(44px + 3.25rem);transition:opacity .3s ${OUT}}
${C} .wslot.open{width:100%}
${C} .wslot>.wing-panel{background:${mix(ZINC950, 95)}}
${C} .wslot>.wing-panel.l,${C} .wslot>.wing-panel.r{padding:0}
${C} .wedge{display:none}
${C} .wback{display:block;position:absolute;inset:0;z-index:47;background:${mix(BLACK, 60)};backdrop-filter:blur(4px)}
}
`;
