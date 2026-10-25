/**
 * The Generation tab's parameter groups, copied from RoleCall's SamplerPanel.tsx (Tailwind converted to values): CategorySection :395-470 for the group
 * card and its head, SamplerRow :101-392 for the parameter card and its value controls. The accent is --w. The sliders' range input and the switches
 * are the shared controls' and are left as they were.
 */
import { AI_MODEL_STYLE } from "./ai-model-style";

export const PARAMS_STYLE = AI_MODEL_STYLE + `
.scs .gp{display:flex;flex-direction:column;gap:12px}
.scs .gp-quiet{margin:0;padding:16px;font:var(--rc-text-sm)/1.25rem var(--font-ui);color:var(--rc-zinc-400)}
.scs .gp-group{overflow:hidden;border:1px solid var(--rc-zinc-800);border-radius:var(--rc-radius-sm)}
.scs .gp-ghead{display:flex;width:100%;box-sizing:border-box;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border:0;background:color-mix(in srgb,var(--rc-zinc-900) 60%,transparent);color:var(--rc-zinc-100);cursor:pointer;text-align:left;font:var(--rc-text-sm) var(--font-ui);transition:background .15s}
.scs .gp-ghead:hover{background:color-mix(in srgb,var(--rc-zinc-800) 60%,transparent)}
.scs .gp-ghead[aria-expanded=true]{border-bottom:1px solid var(--rc-zinc-800)}
.scs .gp-ghead>svg:first-child{color:var(--w);flex:none;align-self:flex-start;margin-top:2px}
.scs .gp-ghead>svg:last-child{flex:none;color:var(--rc-zinc-500)}
.scs .gp-gtext{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.scs .gp-gline{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 12px}
.scs .gp-gline b{font-weight:500;line-height:1.25rem;color:var(--rc-zinc-100)}
.scs .gp-gline small{font-size:var(--rc-text-xs);line-height:1rem;color:var(--rc-zinc-500)}
.scs .gp-purpose{font-size:var(--rc-text-xs);line-height:1rem;color:var(--rc-zinc-400)}
.scs .gp-cards{display:flex;flex-direction:column;gap:8px;padding:12px;background:color-mix(in srgb,var(--rc-zinc-900) 30%,transparent)}
.scs .gp-card{padding:16px;border:1px solid color-mix(in srgb,var(--rc-zinc-700) 50%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-900) 40%,transparent);transition:background .15s,border-color .15s}
.scs .gp-card.on{background:color-mix(in srgb,var(--rc-zinc-800) 80%,transparent);border-color:var(--rc-zinc-600)}
.scs .gp-card.sub{margin-left:24px;border-left:2px solid color-mix(in srgb,var(--w) 25%,transparent)}
.scs .gp-card.greyed{opacity:.4;pointer-events:none}
.scs .gp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:12px}
.scs .gp-id{flex:1;min-width:0}
.scs .gp-name{display:flex;align-items:center;gap:8px}
.scs .gp-name label{font:600 var(--rc-text-sm)/1.25rem var(--font-ui);color:var(--rc-zinc-100)}
.scs .gp-info{display:grid;place-items:center;border:0;background:none;padding:0;color:var(--rc-zinc-500);cursor:pointer;transition:color .15s}
.scs .gp-info:hover,.scs .gp-info:focus-visible{color:var(--rc-zinc-300)}
.scs .gp-key{margin-top:2px;font:var(--rc-text-11, 11px)/1.5 var(--font-mono);color:var(--rc-zinc-500)}
.scs .gp-refused{margin-top:4px;font:var(--rc-text-xs)/1rem var(--font-ui);color:var(--stage-warn)}
.scs .gp-tip{margin:0 0 12px;padding:12px;border:1px solid var(--rc-zinc-700);border-radius:var(--rc-radius-sm);background:var(--rc-zinc-900);font:var(--rc-text-xs)/1rem var(--font-ui);color:var(--rc-zinc-300)}
.scs .gp-note{display:flex;gap:6px;align-items:flex-start;margin-top:8px;color:var(--stage-warn)}
.scs .gp-note svg{flex:none;margin-top:2px}
.scs .gp-val{margin-top:0;display:flex;flex-direction:column;gap:8px}
.scs .gp-range{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;font:var(--rc-text-xs)/1rem var(--font-ui);color:var(--rc-zinc-400)}
.scs .gp-range b{font:400 var(--rc-text-sm)/1.25rem var(--font-mono);color:var(--rc-zinc-100)}
.scs .gp-range i{margin-left:4px;font-style:normal;font-size:var(--rc-text-xs);color:var(--rc-zinc-400)}
.scs .gp-val input[type=range]{width:100%;accent-color:var(--w)}
.scs .gp-in,.scs .gp-ta{width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--rc-zinc-700);border-radius:var(--rc-radius-sm);background:var(--rc-zinc-900);color:var(--stage-card);font:var(--rc-text-sm)/1.25rem var(--font-ui);transition:border-color .15s}
.scs .gp-ta{resize:vertical}
.scs .gp-in:focus,.scs .gp-ta:focus{outline:none;border-color:var(--rc-zinc-500)}
.scs .gp-ta[aria-invalid=true]{border-color:var(--stage-danger-text)}
.scs .mono{font-family:var(--font-mono)}
.scs .gp-send{display:flex;align-items:center;justify-content:space-between;font:var(--rc-text-sm)/1.25rem var(--font-ui);color:var(--rc-zinc-400)}
.scs .gp-send .yes{color:var(--stage-ok)}
.scs .gp-send .no{color:var(--stage-danger-text)}
.scs .gp-hint{margin-top:4px;font:var(--rc-text-xs)/1rem var(--font-ui);color:var(--rc-zinc-400)}
.scs .gp-hint.bad{color:var(--stage-danger-text)}
.scs .gp-custom{background:color-mix(in srgb,var(--rc-zinc-900) 40%,transparent)}
.scs .gp-custom .gp-ghead{background:none;align-items:center}
.scs .gp-custom .gp-ghead>svg:first-child{align-self:center;margin-top:0;color:var(--stage-warn)}
.scs .gp-ctitle{font:600 var(--rc-text-micro) var(--font-ui);letter-spacing:.17em;text-transform:uppercase;color:var(--rc-zinc-300)}
.scs .gp-ctag{margin-right:auto;font-size:var(--rc-text-xs);color:var(--stage-warn)}
.scs .gp-cbody{display:flex;flex-direction:column;gap:16px;padding:12px}
.scs .gp-cbody>.gp-hint{margin:0}
.scs .gp-clabel{display:flex;align-items:center;gap:6px;margin-bottom:6px;font:500 var(--rc-text-xs)/1rem var(--font-ui);color:var(--rc-zinc-300)}
.scs .gp-foot{display:flex;align-items:flex-start;gap:8px;padding:12px;border:1px solid var(--rc-zinc-800);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-900) 40%,transparent);color:var(--rc-zinc-500)}
.scs .gp-foot p{margin:0;font:var(--rc-text-xs)/1rem var(--font-ui)}
.scs .gp-foot svg{flex:none;margin-top:1px}
.scs .gp-bias{display:flex;flex-direction:column;gap:8px}
.scs .gp-bias-top{display:flex;align-items:center;justify-content:space-between;gap:8px;font:var(--rc-text-xs)/1rem var(--font-ui);color:var(--rc-zinc-300)}
.scs .gp-bias-btns{display:flex;gap:8px}
.scs .gp-bias-btns button,.scs .gp-bias-rawtoggle{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid var(--rc-zinc-700);border-radius:var(--rc-radius-sm);background:var(--rc-zinc-800);color:var(--stage-card);font:500 var(--rc-text-xs) var(--font-ui);cursor:pointer}
.scs .gp-bias-btns button:hover,.scs .gp-bias-rawtoggle:hover{border-color:var(--w)}
.scs .gp-bias-rawtoggle{align-self:flex-start;background:none;color:var(--rc-zinc-300)}
.scs .gp-bias-row{display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--rc-zinc-700);border-radius:var(--rc-radius-sm);background:var(--rc-zinc-900)}
.scs .gp-bias-row.drag{opacity:.5}
.scs .gp-bias-grip{cursor:grab;color:var(--rc-zinc-500);display:grid}
.scs .gp-bias-text{flex:1;min-width:0}
.scs .gp-bias-prev{margin-top:2px;font:var(--rc-text-xs) var(--font-mono);color:var(--rc-zinc-500);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scs .gp-bias-num{width:88px;flex:none;text-align:center}
.scs .gp-bias-dot{width:8px;height:8px;border-radius:var(--rc-radius-full);background:var(--rc-zinc-500);flex:none}
.scs .gp-bias-dot.neg{background:var(--stage-danger-text)}
.scs .gp-bias-dot.pos{background:var(--stage-ok)}
.scs .gp-bias-x{border:0;background:none;color:var(--rc-zinc-500);cursor:pointer;display:grid;padding:4px}
.scs .gp-bias-x:hover{color:var(--stage-danger-text)}
.scs .gp-bias-guide{padding:12px;border:1px solid var(--rc-zinc-700);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--w) 8%,transparent);font:var(--rc-text-xs)/1rem var(--font-ui);color:var(--rc-zinc-300)}
.scs .gp-bias-guide p{margin:8px 0 0;padding-top:8px;border-top:1px solid var(--rc-zinc-700);color:var(--rc-zinc-500)}
.scs .gp-bias-guide code{padding:0 4px;background:var(--rc-zinc-900);font-family:var(--font-mono)}
`;
