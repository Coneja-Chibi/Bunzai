/**
 * The AI wing's Generation tab styles (generation-tab.tsx), copied from RoleCall's SamplerPanel.tsx (Tailwind converted to values): the count bar and
 * Reset, the search, the category cards (CategorySection :395-470, CoreSection :509-577, SamplerRow :101-392), the callout (:856-885) and the Reasoning
 * and Thinking cards (:889-1160). RoleCall's --wing-accent is --w; its 11px caption has no token and is px here. The sliders' range rules (.gn-range
 * input) and the switches (.tg) are the shared controls' and are left as they were.
 */
export const GENERATION_STYLE = `
.scs .wbody.gn{gap:0;padding:0;line-height:1.5;--w-soft:color-mix(in srgb,var(--w) 12%,transparent);font-family:var(--font-ui)}
.scs .gn-body{display:flex;flex-direction:column;gap:12px;padding:24px}
.scs .gn .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.scs .gn-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;font-size:var(--rc-text-xs);color:var(--rc-zinc-400)}
.scs .gn-search{position:relative;display:flex;align-items:center;gap:8px;padding:0 10px 0 12px;border:1px solid color-mix(in srgb,var(--rc-zinc-700) 50%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-900) 60%,transparent);color:var(--rc-zinc-500);transition:border-color .15s,background .15s}
.scs .gn-search:focus-within{border-color:var(--rc-zinc-600);background:var(--rc-zinc-900)}
.scs .gn-search input{flex:1;min-width:0;padding:8px 0;border:0;background:none;outline:0;color:var(--stage-card);font:var(--rc-text-sm)/1.25rem var(--font-body)}
.scs .gn-search input::placeholder{color:var(--rc-zinc-500)}
.scs .gn-none{margin:0;font:var(--rc-text-sm)/1.25rem var(--font-ui);color:var(--rc-zinc-400)}
.scs .gn-warn{margin:0;padding:8px 12px;border-left:4px solid var(--stage-warn);background:color-mix(in srgb,var(--stage-warn) 10%,transparent);font:var(--rc-text-wing)/1.5 var(--font-ui);color:var(--stage-card)}
.scs .gn-grp{overflow:hidden;border:1px solid var(--rc-zinc-800);border-radius:var(--rc-radius-sm)}
.scs .gn-ico{color:var(--w);display:grid;margin-top:2px;flex:none;align-self:flex-start}
.scs .gn-gt{flex:1;min-width:0;display:block}
.scs .gn-gl{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 12px}
.scs .gn-gl b{font:500 var(--rc-text-sm)/1.25rem var(--font-ui);color:var(--rc-zinc-100)}
.scs .gn-gl small{font:var(--rc-text-xs)/1rem var(--font-ui);color:var(--rc-zinc-500)}
.scs .gn-gp{display:block;margin-top:2px;font:var(--rc-text-xs)/1rem var(--font-ui);color:var(--rc-zinc-400)}
.scs .gn-gb{display:flex;flex-direction:column;gap:8px;padding:12px;background:color-mix(in srgb,var(--rc-zinc-900) 30%,transparent)}
.scs .gn-lead{margin:0;padding:0 4px;font:var(--rc-text-xs)/1rem var(--font-ui);color:var(--rc-zinc-400)}
.scs .gn-one{display:flex;flex-direction:column;gap:4px}
.scs .gn-foot{display:flex;justify-content:flex-end;align-items:center;gap:8px;padding:0 4px;font-size:var(--rc-text-11, 11px);color:var(--rc-zinc-500)}
.scs .gn-foot span:first-child:not(:last-child){color:var(--rc-zinc-400)}
.scs .gn-card{padding:16px;border:1px solid color-mix(in srgb,var(--rc-zinc-700) 50%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-900) 40%,transparent);transition:background .15s,border-color .15s}
.scs .gn-card.on{border-color:var(--rc-zinc-600);background:color-mix(in srgb,var(--rc-zinc-800) 80%,transparent)}
.scs .gn-card.sub{margin-left:24px;border-left:2px solid color-mix(in srgb,var(--w) 25%,transparent)}
.scs .gn-card.sub.dim{opacity:.4;pointer-events:none}
.scs .gn-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.scs .gn-card>.gn-hd{margin-bottom:12px}
.scs .gn-name{display:flex;align-items:center;gap:8px}
.scs .gn-name b{font:600 var(--rc-text-sm)/1.25rem var(--font-ui);color:var(--rc-zinc-100)}
.scs .gn-key{margin-top:2px;font:var(--rc-text-11, 11px)/1.5 var(--font-mono);color:var(--rc-zinc-500)}
.scs .gn-tip{margin:0 0 12px;padding:12px;border:1px solid var(--rc-zinc-700);border-radius:var(--rc-radius-sm);background:var(--rc-zinc-900);font:var(--rc-text-xs)/1rem var(--font-ui);color:var(--rc-zinc-300)}
.scs .gn-note{margin-top:8px;color:var(--stage-warn)}
.scs .gn-range,.scs .gn-card>.gn-in,.scs .gn-card>div>.gn-in,.scs .gn-bool{margin-top:0}
.scs .gn-rv{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;font-size:var(--rc-text-xs);color:var(--rc-zinc-400)}
.scs .gn-rv b{font:400 var(--rc-text-sm)/1.25rem var(--font-mono);color:var(--rc-zinc-100)}
.scs .gn-range input[type=range]{width:100%;height:6px;appearance:none;background:linear-gradient(to right,var(--w) var(--p),var(--stage-line) var(--p));cursor:pointer;outline-offset:6px}
.scs .gn-range input[type=range]::-webkit-slider-thumb{appearance:none;width:14px;height:14px;border:2px solid var(--stage-card);background:var(--w)}
.scs .gn-range input[type=range]::-moz-range-thumb{width:10px;height:10px;border:2px solid var(--stage-card);border-radius:0;background:var(--w)}
.scs .gn-in{box-sizing:border-box;width:100%;padding:8px 12px;border:1px solid var(--rc-zinc-700);border-radius:var(--rc-radius-sm);background:var(--rc-zinc-900);color:var(--stage-card);font:var(--rc-text-sm)/1.25rem var(--font-mono);outline:0;transition:border-color .15s}
.scs .gn-in:focus{border-color:var(--rc-zinc-500)}
.scs .gn-ta{resize:vertical}
.scs .gn-sel{font-family:var(--font-ui);border-color:var(--w);cursor:pointer}
.scs .gn-sel:hover{background:var(--rc-zinc-800)}
.scs .gn-sub{display:block;margin-top:6px;font:var(--rc-text-13, 13px)/1.625 var(--font-ui);color:var(--rc-zinc-400)}
.scs .gn-bad{color:var(--stage-danger-text)}
.scs .gn-bool{display:flex;align-items:center;justify-content:space-between;font:var(--rc-text-sm)/1.25rem var(--font-ui);color:var(--rc-zinc-400)}
.scs .gn-bool .ok{color:var(--stage-ok)}.scs .gn-bool .no{color:var(--stage-danger-text)}
.scs .gn-callout{display:flex;gap:10px;padding:14px;border:1px solid color-mix(in srgb,var(--w) 40%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--w) 7%,transparent);font:var(--rc-text-sm)/1.625 var(--font-ui);color:var(--rc-zinc-100)}
.scs .gn-callout p{margin:0 0 8px}.scs .gn-callout p:last-child{margin:0}
.scs .gn-callout b{font-weight:600;color:var(--w)}
.scs .gn-cico{color:var(--w);display:grid;flex:none;margin-top:2px}
.scs .gn-callout code,.scs .gn-copy code{padding:2px 6px;border-radius:var(--rc-radius);background:var(--rc-zinc-900);color:var(--rc-zinc-100);font:var(--rc-text-xs) var(--font-mono)}
.scs .gn-heads{padding:2px 0 2px 10px;border-left:2px solid color-mix(in srgb,var(--w) 40%,transparent);font-size:var(--rc-text-xs);line-height:1rem;color:var(--rc-zinc-300)}
.scs .gn-heads b{color:var(--stage-warn)}
.scs .gn-box{overflow:hidden;border:1px solid color-mix(in srgb,var(--w) 40%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-950) 50%,transparent)}
.scs .gn-bh{display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid color-mix(in srgb,var(--w) 25%,transparent);background:color-mix(in srgb,var(--w) 9%,transparent);color:var(--w)}
.scs .gn-bh b{font:500 var(--rc-text-sm)/1.25rem var(--font-ui);color:var(--rc-zinc-100)}
.scs .gn-bh small{margin-left:auto;font-size:var(--rc-text-11, 11px);color:var(--rc-zinc-300);text-align:right}
.scs .gn-bb{display:flex;flex-direction:column;gap:12px;padding:12px}
.scs .gn-lbl{display:block;margin-bottom:6px;font:500 var(--rc-text-sm)/1.25rem var(--font-ui);color:var(--rc-zinc-100)}
.scs .gn-lbl small{margin-left:8px;font:400 var(--rc-text-xs)/1rem var(--font-ui);color:var(--rc-zinc-500)}
.scs .gn-seg3r{margin-bottom:8px}
.scs .gn-catch{display:flex;flex-direction:column;gap:10px}
.scs .gn-ch{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font:500 var(--rc-text-sm)/1.25rem var(--font-ui);color:var(--rc-zinc-100)}
.scs .gn-ch small{font:400 var(--rc-text-xs)/1rem var(--font-ui);color:var(--rc-zinc-400)}
.scs .gn-copy{margin:6px 0 0;font:var(--rc-text-13, 13px)/1.625 var(--font-ui);color:var(--rc-zinc-400)}
.scs .gn-copy b{color:var(--rc-zinc-300)}
.scs .gn-copy p{margin:0 0 10px}
.scs .gn-only{display:flex;flex-direction:column;gap:16px;padding-top:4px}
.scs .gn-own{display:flex;flex-direction:column;gap:8px}
.scs .gn-cap{font:700 var(--rc-text-micro) var(--font-ui);letter-spacing:.14em;text-transform:uppercase;color:var(--rc-zinc-400)}
.scs .gn-row{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center}
.scs .gn-colh{font:var(--rc-text-xs)/1rem var(--font-ui);color:var(--rc-zinc-400)}
.scs .gn-row .gn-in{min-width:0}
.scs .gn-pickh{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px}
.scs .gn-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.scs .gn-sw{display:flex;align-items:center;justify-content:space-between;gap:16px}
.scs .gn-sw b{display:block;font:500 var(--rc-text-sm)/1.25rem var(--font-ui);color:var(--rc-zinc-100)}
.scs .gn-sw small{display:block;margin-top:2px;font:var(--rc-text-xs)/1rem var(--font-ui);color:var(--rc-zinc-500)}
.scs .gn-det summary small{font-weight:400;font-size:var(--rc-text-10, 10px);color:var(--rc-zinc-500)}
.scs .gn-hr{margin:0;border:0;border-top:1px solid color-mix(in srgb,var(--w) 15%,transparent)}
.scs .gn-det{margin-top:8px;padding-top:8px;border-top:1px solid color-mix(in srgb,var(--w) 12%,transparent)}
.scs .gn-det summary{display:flex;align-items:center;gap:6px;padding:4px 0;list-style:none;cursor:pointer;font:var(--rc-text-xs)/1rem var(--font-ui);color:var(--rc-zinc-300);user-select:none}
.scs .gn-det summary:hover{color:var(--stage-card)}
.scs .gn-det summary::-webkit-details-marker{display:none}
.scs .gn-det summary svg{transition:transform .15s}
.scs .gn-det[open]>summary svg{transform:rotate(90deg)}
.scs .gn-det>.gn-copy{margin-top:8px}
.scs .gn-claude{margin:0 0 8px;padding:12px;border:1px solid color-mix(in srgb,var(--stage-warn) 40%,transparent);background:color-mix(in srgb,var(--stage-warn) 8%,transparent);color:var(--stage-card);font:var(--rc-text-xs)/1rem var(--font-ui)}
.scs .gn-claude p{margin:0 0 6px}
.scs .gn-two{margin-top:8px}
`;
