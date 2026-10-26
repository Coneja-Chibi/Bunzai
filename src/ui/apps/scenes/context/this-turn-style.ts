/**
 * This turn's styles (.tt), copied from OutboundCallsPanel.tsx's Tailwind classes into px (px-4 16, px-5 20, space-y-3 12, gap-2 8, h-8 32, px-3 py-2.5 12/10,
 * text-sm 14, text-xs 12, text-[14.5px] 14.5). RoleCall's 10.5 and 11px labels stand (OutboundCallsPanel.tsx:300, :349, :505, :530); emerald and sky confidence borders map to
 * --stage-ok and --stage-var, rose to the danger tokens, and the accent to the wing's own tone (`--w`).
 */
export const THIS_TURN_STYLE = `
.scs .tt{display:flex;flex-direction:column;gap:12px;padding:16px 20px;font-family:var(--font-ui);color:var(--stage-soft)}
.scs .tt-pager{display:flex;align-items:center;gap:8px}
.scs .tt-pl{flex:1;min-width:0;font:600 var(--text-control)/1.4 var(--font-ui);color:var(--stage-card)}
.scs .tt-pl span{font-weight:400;color:var(--stage-mute)}
.scs .tt-tot{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent)}
.scs .tt-tot>div{padding:8px 12px;min-width:0}
.scs .tt-tot>div:not(:last-child){border-right:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent)}
.scs .tt-tot small{display:block;font:400 var(--text-meta) var(--font-ui);color:var(--stage-dim)}
.scs .tt-tot b{display:block;font:800 16px/1.4 var(--font-ui);font-variant-numeric:tabular-nums;color:var(--stage-card)}
.scs .tt-unrep{margin:0;padding:6px 12px;border:1px solid color-mix(in srgb,var(--stage-var) 40%,transparent);border-top:0;background:color-mix(in srgb,var(--stage-var) 10%,transparent);font:400 var(--text-meta)/1.5 var(--font-ui);color:var(--stage-var)}
.scs .tt-load{display:flex;min-height:176px;align-items:center;justify-content:center;gap:12px;font:400 var(--text-control) var(--font-ui);color:var(--stage-card)}
.scs .tt-err{padding:16px;border:1px solid color-mix(in srgb,var(--stage-danger-text) 60%,transparent);background:var(--stage-danger-bg);font:400 var(--text-control) var(--font-ui);color:var(--stage-danger-text)}
.scs .tt-empty{padding:24px;text-align:center;border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);background:color-mix(in srgb,var(--stage-black) 30%,transparent);color:var(--stage-dim)}
.scs .tt-empty p{margin:12px 0 0;font:600 var(--text-control) var(--font-ui);color:var(--stage-card)}
.scs .tt-empty small{display:block;margin-top:4px;font:400 var(--rc-text-13, 13px)/1.6 var(--font-ui);color:var(--stage-mute)}
.scs .tt-groups{display:flex;flex-direction:column;gap:12px}
.scs .tt-groups section{display:flex;flex-direction:column;gap:8px}
.scs .tt-grp{display:flex;align-items:center;gap:10px;margin:0;font:700 var(--rc-text-11, 11px) var(--font-ui);letter-spacing:.2em;text-transform:uppercase;color:var(--rc-zinc-500)}
.scs .tt-grp::after{content:"";flex:1;height:1px;background:color-mix(in srgb,var(--stage-card) 8%,transparent)}
.scs .tt-groups ol{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}
.scs .tt-call{border:1px solid color-mix(in srgb,var(--stage-card) 12%,transparent);background:color-mix(in srgb,var(--stage-card) 2%,transparent)}
.scs .tt-call.exact{border-color:color-mix(in srgb,var(--stage-ok) 70%,transparent)}
.scs .tt-call.estimated{border-color:color-mix(in srgb,var(--stage-var) 70%,transparent)}
.scs .tt-call.failed{border-color:color-mix(in srgb,var(--stage-danger-text) 55%,transparent)}
.scs .tt-call.open:not(.failed){border-color:color-mix(in srgb,var(--w) 55%,transparent)}
.scs .tt-top{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.scs .tt-top b{font:800 var(--rc-text-14p5, 14.5px) var(--font-ui);color:var(--stage-card)}
.scs .tt-top code{padding:2px 6px;border:1px solid color-mix(in srgb,var(--w) 55%,transparent);background:var(--stage-black);font:var(--text-meta) var(--font-mono);color:var(--w)}
.scs .tt-top em{padding:2px 6px;border:1px solid color-mix(in srgb,var(--stage-card) 20%,transparent);font:700 var(--rc-text-10p5, 10.5px) var(--font-ui);font-style:normal;letter-spacing:.12em;text-transform:uppercase;color:var(--stage-soft)}
.scs .tt-top em.ok{border-color:color-mix(in srgb,var(--stage-ok) 50%,transparent);color:var(--stage-ok)}
.scs .tt-top em.bad{border-color:color-mix(in srgb,var(--stage-danger-text) 55%,transparent);color:var(--stage-danger-text)}
.scs .tt-trig{display:block;margin-top:2px;font:400 var(--rc-text-13, 13px)/1.4 var(--font-ui);color:var(--stage-mute)}
.scs .tt-num{text-align:right;font:400 var(--rc-text-12p5, 12.5px) var(--font-ui);font-variant-numeric:tabular-nums;color:var(--stage-mute)}
.scs .tt-num b{display:block;font:700 var(--text-control) var(--font-ui);color:var(--stage-card)}
.scs .tt-detail{display:flex;flex-direction:column;gap:12px;padding:12px;border-top:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);background:color-mix(in srgb,var(--stage-black) 40%,transparent)}
.scs .tt-msgs{display:flex;flex-direction:column;gap:8px}
.scs .tt-msg{border:1px solid color-mix(in srgb,var(--stage-card) 8%,transparent);background:var(--stage-black)}
.scs .tt-tool{display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;border:0;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 6%,transparent);background:none;text-align:left;cursor:pointer;color:inherit}
.scs .tt-tool{cursor:default}
.scs .tt-role{font:700 var(--rc-text-11, 11px) var(--font-ui);letter-spacing:.14em;text-transform:uppercase;color:var(--w)}
.scs .tt-role.user{color:var(--stage-var)}
.scs .tt-role.assistant{color:var(--stage-ok)}
.scs .tt-role i{font-style:normal;letter-spacing:.04em;text-transform:none;color:var(--stage-mute)}
.scs .tt-tk{font:400 var(--text-meta) var(--font-ui);font-variant-numeric:tabular-nums;color:var(--stage-dim)}
.scs .tt-msg pre{margin:0;padding:8px 10px;white-space:pre-wrap;overflow-wrap:anywhere;font:var(--rc-text-12p5, 12.5px)/1.6 var(--font-mono);color:var(--stage-card)}
.scs .tt-msg pre.folded{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--stage-dim)}
.scs pre.tt-raw{margin:0;max-height:48vh;overflow:auto;padding:12px;white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);background:var(--stage-floor);font:var(--text-meta)/1.6 var(--font-mono);color:var(--stage-card)}
.scs .tt-lane{display:grid;grid-template-columns:minmax(120px,1fr) auto;gap:4px 12px;align-items:center;font:400 var(--text-meta) var(--font-ui);color:var(--stage-card)}
.scs .tt-lane b{font:700 var(--text-meta) var(--font-mono)}
.scs .tt-lane em{grid-column:1/-1;display:block;height:6px;background:color-mix(in srgb,var(--stage-card) 10%,transparent)}
.scs .tt-lane i{display:block;height:100%;background:var(--w)}
.scs .tt-attempt.failed .tt-role{color:var(--stage-warn)}
.scs .tt-note{margin:0;font:400 var(--text-meta)/1.6 var(--font-ui);color:var(--stage-mute)}
.scs .tt-fail{margin:0;padding-left:12px;border-left:3px solid var(--stage-danger-text);font:400 var(--text-control)/1.5 var(--font-ui);color:var(--stage-card)}
.scs .tt-copy{align-self:flex-start}
.scs .tt-legend{display:flex;flex-wrap:wrap;align-items:center;gap:16px;margin:0;padding-top:4px;font:400 var(--text-meta) var(--font-ui);color:var(--stage-dim)}
.scs .tt-legend span{display:inline-flex;align-items:center;gap:6px}
.scs .tt-legend span::before{content:"";width:10px;height:10px;border:2px solid var(--stage-ok)}
.scs .tt-legend .es::before{border-color:var(--stage-var)}
`;
