/**
 * What the item trackers share, measured from RoleCall's panels (InventoryWingPanel.tsx and its siblings): the expandable card with its colour stripe, its
 * header, its body and the action row; the filter chips; the dashed Add button and its form; the proposal under a form; the empty state. Flat fills and square
 * ends; 10px text lifted to the 12px floor; every colour a theme token, set per element through --c.
 */
export const ITEMS_STYLE = `
.scs .it-pill{padding:2px 8px;background:color-mix(in srgb,var(--w) 20%,transparent);color:var(--w);font:500 var(--rc-text-xs)/1.4 var(--font-body)}
.scs .trk .st-tabs button.on{border-bottom-color:var(--w);background:color-mix(in srgb,var(--w) 5%,transparent)}
.scs .it-pill.bad{background:var(--stage-danger-bg);color:var(--stage-danger-text)}
.scs .it-count{padding:0 6px;background:color-mix(in srgb,var(--w) 20%,transparent);color:var(--w);font:700 var(--rc-text-xs)/1.4 var(--font-body)}
.scs .it-preview{margin:4px 0 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font:400 var(--rc-text-xs)/1.5 var(--font-body);color:var(--stage-soft)}
.scs .it-search{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid color-mix(in srgb,var(--w) 20%,transparent);background:linear-gradient(180deg,color-mix(in srgb,var(--w) 10%,transparent),transparent)}
.scs .it-search input{flex:1;min-width:0;padding:8px 12px;border:1px solid var(--stage-line);background:color-mix(in srgb,var(--stage-panel) 50%,transparent);color:var(--stage-soft);font:400 var(--rc-text-sm)/1.4 var(--font-body);border-radius:var(--rc-radius)}
.scs .it-search input:focus{outline:none;border-color:var(--w)}
.scs .it-search span{color:var(--stage-mute)}
.scs .it-pillcol{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.scs .it-tag{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:color-mix(in srgb,var(--c) 20%,transparent);color:var(--c);font:700 var(--rc-text-xs)/1.4 var(--font-body);text-transform:uppercase;letter-spacing:.04em}
.scs .it-tag.soft{font-weight:500;text-transform:none;letter-spacing:0}
.scs .it-box{display:flex;flex-direction:column;gap:8px;padding:8px;border:1px solid color-mix(in srgb,var(--c) 20%,transparent);background:color-mix(in srgb,var(--c) 6%,transparent);border-radius:var(--rc-radius-sm)}
.scs .it-box>b{display:flex;align-items:center;gap:8px;font:700 var(--rc-text-xs)/1.4 var(--font-body);text-transform:uppercase;color:var(--c)}
.scs .it-box small,.scs .it-box ul{font:400 var(--rc-text-xs)/1.5 var(--font-body);color:var(--stage-mute)}
.scs .it-box ul{margin:0;padding-left:16px;color:var(--stage-soft)}
.scs .it-box em{font:italic 400 var(--rc-text-xs)/1.5 var(--font-body);color:var(--stage-soft)}
.scs .it-fine{display:flex;flex-direction:column;gap:4px;font:400 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-line)}
.scs .it-line{display:flex;align-items:center;gap:8px;font:400 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .it-under{padding:0 12px 12px 16px}
.scs .it-foot{padding:0 12px 8px 16px;border-top:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent)}
.scs .it-foot .it-actions{border-bottom:0;padding:8px 0 0}
.scs .it-actions .it-grow{flex:1;min-width:8em;width:auto;padding:4px 8px;border:1px solid var(--stage-line);background:var(--stage-panel);color:var(--stage-soft);font:400 var(--rc-text-sm)/1.4 var(--font-body);border-radius:var(--rc-radius)}
.scs .it-actions .it-grow:focus{outline:none;border-color:var(--w)}
.scs .it-titlerow{display:flex;align-items:center;gap:8px;min-width:0}
.scs .it-over{position:absolute;inset:0;z-index:1;display:flex;align-items:center;justify-content:center;gap:8px;background:color-mix(in srgb,var(--stage-black) 60%,transparent);backdrop-filter:blur(2px);color:var(--stage-mute);font:500 var(--rc-text-xs)/1.4 var(--font-body);pointer-events:none}
.scs .it-label{font:400 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .it-list{display:flex;flex-direction:column;gap:8px}
.scs .it-filters{display:flex;gap:8px;overflow-x:auto;padding-bottom:8px}
.scs .it-filters button{display:flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid transparent;background:color-mix(in srgb,var(--stage-panel) 60%,transparent);color:var(--stage-mute);font:500 var(--rc-text-xs)/1.4 var(--font-body);text-transform:capitalize;white-space:nowrap;cursor:pointer;border-radius:var(--rc-radius)}
.scs .it-filters button:hover{background:var(--stage-panel)}
.scs .it-filters button.on{border-color:color-mix(in srgb,var(--w) 30%,transparent);background:color-mix(in srgb,var(--w) 20%,transparent);color:var(--w)}
.scs .it-card{position:relative;overflow:hidden;border:1px solid color-mix(in srgb,var(--c) 20%,transparent);background:linear-gradient(135deg,color-mix(in srgb,var(--stage-panel) 80%,transparent),color-mix(in srgb,var(--stage-panel) 40%,transparent));border-radius:var(--rc-radius-sm)}
.scs .it-card.gone{opacity:.5}
.scs .it-stripe{position:absolute;top:0;bottom:0;left:0;width:4px;background:var(--c)}
.scs .it-head{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:12px 12px 12px 16px;text-align:left;cursor:pointer}
.scs .it-head:hover{background:color-mix(in srgb,var(--stage-card) 5%,transparent)}
.scs .it-head:focus-visible{outline:2px solid var(--w);outline-offset:-2px}
.scs .it-lead{display:flex;align-items:center;gap:12px;flex:1;min-width:0}
.scs .it-ic{flex:none;color:var(--c);display:grid;place-items:center}
.scs .it-title{flex:1;min-width:0}
.scs .it-title b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 var(--rc-text-sm)/1.4 var(--font-body);color:var(--stage-card)}
.scs .it-meta{display:flex;align-items:center;flex-wrap:wrap;gap:8px;font:400 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .it-meta .cap{text-transform:capitalize}
.scs .it-right{display:flex;align-items:center;gap:8px;color:var(--stage-mute)}
.scs .it-qty{display:flex;align-items:center;gap:4px;padding:2px 8px;background:color-mix(in srgb,var(--stage-panel) 80%,transparent);color:var(--stage-soft);font:400 var(--rc-text-sm)/1.4 var(--font-body)}
.scs .it-qty button{padding:2px 6px;border:0;background:var(--stage-line);color:var(--stage-soft);font:400 var(--rc-text-xs)/1.4 var(--font-body);cursor:pointer;border-radius:var(--rc-radius)}
.scs .it-qty button:hover{background:var(--stage-mute);color:var(--stage-black)}
.scs .it-badge{position:absolute;top:8px;left:8px;padding:2px 6px;background:var(--w);color:var(--stage-black);font:700 var(--rc-text-xs)/1.4 var(--font-body)}
.scs .it-body{display:flex;flex-direction:column;gap:12px;padding:12px 12px 12px 16px;border-top:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent)}
.scs .it-body p{margin:0;font:400 var(--rc-text-sm)/1.5 var(--font-body);color:var(--stage-soft)}
.scs .it-body h5{margin:0 0 4px;font:500 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .it-chips{display:flex;flex-wrap:wrap;gap:6px}
.scs .it-chip{padding:2px 8px;background:color-mix(in srgb,var(--stage-panel) 80%,transparent);color:var(--stage-soft);font:400 var(--rc-text-xs)/1.4 var(--font-body)}
.scs .it-chip.bad{background:var(--stage-danger-bg);color:var(--stage-danger-text)}
.scs .it-note{font:400 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .it-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding-bottom:8px;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent)}
.scs .it-act{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border:0;background:color-mix(in srgb,var(--stage-panel) 80%,transparent);color:var(--stage-mute);font:400 var(--rc-text-xs)/1.4 var(--font-body);cursor:pointer;border-radius:var(--rc-radius)}
.scs .it-act:hover{color:var(--stage-card)}
.scs .it-act.bad:hover{color:var(--stage-danger-text)}
.scs .it-act select{border:1px solid var(--stage-line);background:var(--stage-black);color:var(--stage-card);font:400 var(--rc-text-xs)/1.4 var(--font-body);border-radius:var(--rc-radius)}
.scs .it-refresh,.scs .it-form{display:flex;flex-direction:column;gap:8px}
.scs .it-form{padding:12px;border:1px solid color-mix(in srgb,var(--w) 20%,transparent);background:color-mix(in srgb,var(--stage-panel) 50%,transparent);border-radius:var(--rc-radius-sm)}
.scs .it-form input,.scs .it-refresh input,.scs .it-fields input,.scs .it-fields select,.scs .it-fields textarea{width:100%;padding:4px 8px;border:1px solid var(--stage-line);background:var(--stage-panel);color:var(--stage-soft);font:400 var(--rc-text-sm)/1.4 var(--font-body);border-radius:var(--rc-radius)}
.scs .it-form input:focus,.scs .it-refresh input:focus,.scs .it-fields input:focus,.scs .it-fields select:focus,.scs .it-fields textarea:focus{outline:none;border-color:var(--w)}
.scs .it-buttons{display:flex;flex-wrap:wrap;gap:8px}
.scs .it-go,.scs .it-cancel{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:0;font:400 var(--rc-text-xs)/1.4 var(--font-body);cursor:pointer;border-radius:var(--rc-radius)}
.scs .it-go{background:color-mix(in srgb,var(--w) 20%,transparent);color:var(--w)}
.scs .it-go:hover:not(:disabled){background:color-mix(in srgb,var(--w) 30%,transparent)}
.scs .it-go:disabled{opacity:.5;cursor:default}
.scs .it-cancel{background:color-mix(in srgb,var(--stage-panel) 80%,transparent);color:var(--stage-mute)}
.scs .it-cancel:hover{background:var(--stage-panel)}
.scs .it-add{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:8px;border:2px dashed var(--stage-line);background:none;color:var(--stage-mute);font:400 var(--rc-text-sm)/1.4 var(--font-body);cursor:pointer;border-radius:var(--rc-radius-sm)}
.scs .it-add:hover{border-color:color-mix(in srgb,var(--w) 50%,transparent);color:var(--w)}
.scs .it-proposal{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--w);background:color-mix(in srgb,var(--w) 8%,transparent);border-radius:var(--rc-radius-sm)}
.scs .it-proposal-head{font:700 var(--rc-text-xs)/1.4 var(--font-body);letter-spacing:.08em;text-transform:uppercase;color:var(--w)}
.scs .it-proposal p{margin:0;font:400 var(--rc-text-sm)/1.5 var(--font-body);color:var(--stage-soft)}
.scs .it-error{margin:0;padding:8px;background:var(--stage-danger-bg);color:var(--stage-danger-text);font:400 var(--rc-text-sm)/1.4 var(--font-body)}
.scs .it-spin{display:inline-flex;animation:it-turn 1s linear infinite}
@keyframes it-turn{to{transform:rotate(360deg)}}
.scs .it-empty{padding:48px 0;text-align:center;color:var(--stage-line)}
.scs .it-empty b{display:block;margin-top:12px;font:500 var(--rc-text-sm)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .it-empty small{display:block;margin-top:4px;font:400 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-line)}
.scs .it-sum{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border-bottom:1px solid color-mix(in srgb,var(--w) 20%,transparent);background:linear-gradient(180deg,color-mix(in srgb,var(--w) 10%,transparent),transparent)}
.scs .it-sum>div{display:flex;align-items:center;gap:8px}
.scs .it-sum .it-sum-ic{padding:8px;border:1px solid color-mix(in srgb,var(--w) 30%,transparent);background:color-mix(in srgb,var(--w) 20%,transparent);display:grid;place-items:center;border-radius:var(--rc-radius-sm)}
.scs .it-sum small{display:block;font:400 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .it-sum b{font:700 1.125rem/1.4 var(--font-body);color:var(--c)}
.scs .it-sum input{width:7em;padding:0 4px;border:1px solid transparent;background:none;color:var(--c);font:700 1.125rem/1.4 var(--font-body);border-radius:var(--rc-radius)}
.scs .it-sum input:focus{outline:none;border-color:var(--stage-line);background:var(--stage-panel)}
.scs .it-sum .r{text-align:right;display:block}
.scs .it-sum .r b{font-size:var(--rc-text-sm);color:var(--stage-soft)}
.scs .it-slot{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid color-mix(in srgb,var(--stage-line) 50%,transparent);background:color-mix(in srgb,var(--stage-panel) 40%,transparent);border-radius:var(--rc-radius-sm)}
.scs .it-slot.on{border-color:color-mix(in srgb,var(--w) 20%,transparent);background:linear-gradient(90deg,color-mix(in srgb,var(--w) 10%,transparent),transparent)}
.scs .it-slot .it-ic{padding:8px;background:color-mix(in srgb,var(--stage-panel) 80%,transparent);color:var(--stage-mute)}
.scs .it-slot small{display:block;font:400 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .it-slot b{font:600 var(--rc-text-sm)/1.4 var(--font-body)}
.scs .it-slot i{font:italic 400 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-line)}
.scs .it-bonus{display:flex;align-items:center;justify-content:space-between;padding:12px;border:1px solid color-mix(in srgb,var(--w) 20%,transparent);background:linear-gradient(90deg,color-mix(in srgb,var(--w) 10%,transparent),transparent);border-radius:var(--rc-radius-sm)}
.scs .it-bonus span{font:500 var(--rc-text-sm)/1.4 var(--font-body);color:var(--stage-soft)}
.scs .it-bonus b{font:700 1.125rem/1.4 var(--font-body)}
`;
