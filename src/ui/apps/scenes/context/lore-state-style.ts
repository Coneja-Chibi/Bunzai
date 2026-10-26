/**
 * Lore & state's styles (.ls, .ps), copied from DebugWingPanelV2.tsx and StateInspectorTab.tsx's Tailwind classes into px (px-4 py-3 16/12, px-3 py-2 12/8, gap-2 8, h-2.5 10, w-9 36,
 * h-1.5 6). RoleCall's 7 to 10px text is raised to the 12px floor, its emerald/amber/red level colours map to the stage tokens, its glow, shimmer and rounded corners are dropped
 * (square, one flat fill), and each tab's colour is a theme token set as `--c`.
 */
export const LORE_STATE_STYLE = `
.scs .ls{display:flex;flex-direction:column;min-height:100%;font-family:var(--font-ui);color:var(--stage-soft)}
.scs .ls-head{flex:none;padding:12px 16px;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 8%,transparent);background:color-mix(in srgb,var(--stage-black) 50%,transparent)}
.scs .ls-top{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.scs .ls-ico{display:grid;place-items:center;width:36px;height:36px;border:1px solid color-mix(in srgb,var(--stage-ok) 40%,transparent);background:color-mix(in srgb,var(--stage-ok) 20%,transparent);color:var(--stage-ok)}
.scs .ls-top h3{margin:0;font:600 var(--text-control) var(--font-ui);letter-spacing:.02em;color:var(--stage-card)}
.scs .ls-top p{margin:0;font:400 var(--text-meta) var(--font-ui);color:var(--stage-mute)}
.scs .ps{margin-bottom:12px;padding:8px;border:1px solid color-mix(in srgb,var(--stage-card) 6%,transparent);background:color-mix(in srgb,var(--lv) 10%,transparent)}
.scs .ps-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;font:400 var(--text-meta) var(--font-ui);color:var(--stage-mute)}
.scs .ps-top svg{margin-left:6px;vertical-align:-2px;color:var(--lv)}
.scs .ps-pct{display:inline-flex;align-items:center;gap:6px;font:600 var(--text-meta) var(--font-mono);color:var(--lv)}
.scs .ps-bar{position:relative;height:10px;background:color-mix(in srgb,var(--stage-black) 30%,transparent);overflow:hidden}
.scs .ps-bar i{display:block;height:100%;background:var(--lv);transition:width .7s ease-out}
.scs .ps-bar b{position:absolute;top:0;bottom:0;width:1px}
.scs .ps-bar b.warning{background:color-mix(in srgb,var(--stage-warn) 60%,transparent)}
.scs .ps-bar b.danger{background:color-mix(in srgb,var(--stage-danger-text) 60%,transparent)}
.scs .ps-bar b.critical{background:color-mix(in srgb,var(--stage-danger-hot) 60%,transparent)}
.scs .ps-stats{display:flex;align-items:center;justify-content:space-between;margin-top:6px;font:400 var(--text-meta) var(--font-ui);color:var(--stage-mute)}
.scs .ps-stats em{font-style:normal;font-weight:600;color:var(--stage-soft)}
.scs .ps-stats .mid{color:var(--stage-warn)}
.scs .ps-stats .low{color:var(--stage-danger-text)}
.scs .ps-note{margin:6px 0 0;font:italic 400 var(--text-meta)/1.5 var(--font-ui);color:var(--stage-warn)}
.scs .ps-gear{margin-top:8px;padding-top:8px;border-top:1px solid color-mix(in srgb,var(--stage-card) 6%,transparent);display:flex;flex-direction:column;gap:8px}
.scs .ps-gear small{font:500 var(--text-meta) var(--font-ui);letter-spacing:.08em;text-transform:uppercase;color:var(--stage-mute)}
.scs .ps-gear label{display:flex;align-items:center;gap:8px;font:400 var(--text-meta) var(--font-ui)}
.scs .ps-gear label span{width:56px}
.scs .ps-gear label.warning{color:var(--stage-warn)}.scs .ps-gear label.danger{color:var(--stage-danger-text)}.scs .ps-gear label.critical{color:var(--stage-danger-hot)}
.scs .ps-gear output{width:36px;text-align:right;font-family:var(--font-mono)}
.scs .ps-target{display:flex;align-items:center;gap:8px}
.scs .ps-target input{flex:1;padding:4px 8px;border:1px solid color-mix(in srgb,var(--stage-card) 8%,transparent);background:color-mix(in srgb,var(--stage-black) 30%,transparent);font:var(--text-meta) var(--font-mono);color:var(--stage-card)}
.scs .ps-watch{margin:0;font:var(--text-meta) var(--font-ui);color:var(--stage-ok)}
.scs .ls-main{flex:1;min-height:0;display:flex;flex-direction:column}
.scs .ls-pane{flex:1;min-height:0;display:flex;flex-direction:column}
.scs .ls-after{margin:0;padding:12px 16px;border-top:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);font:400 13px/1.5 var(--font-ui);color:var(--stage-mute)}
.scs .ls-list{flex:1;min-height:0;overflow-y:auto;padding:8px}
.scs .ls-list [data-control=disclosure] code{font:var(--text-meta) var(--font-mono);color:var(--stage-card)}
.scs .ls-hint{display:flex;align-items:center;justify-content:flex-end;gap:4px;padding:8px 12px;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);font:var(--text-meta) var(--font-ui);color:var(--stage-dim)}
.scs .ls-cap{margin-bottom:8px;font:var(--text-meta) var(--font-ui);color:var(--stage-mute)}
.scs .ls-node{display:flex;align-items:center;gap:8px;padding:6px 8px;border-left:2px solid var(--c,var(--stage-seam));cursor:pointer;color:var(--stage-soft)}
.scs .ls-node:hover{background:color-mix(in srgb,var(--stage-card) 3%,transparent)}
.scs .ls-node.child{margin-left:16px;cursor:default}
.scs .ls-name{flex:1;min-width:0;font:500 var(--text-meta) var(--font-ui);color:var(--stage-card);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scs .ls-name small{display:block;font:400 var(--text-meta) var(--font-ui);color:var(--stage-dim);overflow:hidden;text-overflow:ellipsis}
.scs .ls-num{flex:none;text-align:right;font:var(--text-meta) var(--font-mono);color:var(--stage-soft)}
.scs .ls-num small{display:block;color:var(--stage-dim)}
.scs .ls-loop{font:var(--text-meta) var(--font-ui);color:var(--stage-var)}
.scs .ls-bar{display:block;flex:none;width:48px;height:6px;background:color-mix(in srgb,var(--stage-card) 10%,transparent);overflow:hidden}
.scs .ls-bar.thick{width:auto;height:12px;margin-top:4px}
.scs .ls-bar i{display:block;height:100%;background:var(--c)}
.scs .ls-flow{margin-bottom:10px}
.scs .ls-flow>div:first-child{display:flex;justify-content:space-between;font:var(--text-meta) var(--font-ui);color:var(--stage-card)}
.scs .ls-sec{border-bottom:1px solid color-mix(in srgb,var(--stage-card) 3%,transparent)}
.scs .ls-sec.lit{background:color-mix(in srgb,var(--deck-persona) 10%,transparent);border-left:2px solid var(--deck-persona)}
.scs .ls-pos{display:grid;place-items:center;width:20px;height:20px;background:color-mix(in srgb,var(--stage-card) 5%,transparent);font:var(--text-meta) var(--font-mono);color:var(--stage-mute)}
.scs .ls-body{position:relative;margin:4px 0 8px 28px;padding:8px;border:1px solid color-mix(in srgb,var(--stage-card) 6%,transparent);background:color-mix(in srgb,var(--stage-black) 30%,transparent);font:var(--text-meta)/1.6 var(--font-ui);color:var(--stage-soft)}
.scs .ls-body pre{margin:0;max-height:128px;overflow-y:auto;padding-right:28px;white-space:pre-wrap;overflow-wrap:anywhere;font:var(--text-meta)/1.6 var(--font-mono);color:var(--stage-soft)}
.scs .ls-body p{margin:0 0 4px}
.scs .ls-body span{color:var(--stage-mute)}.scs .ls-body b{color:var(--stage-ok);font-weight:400}
.scs .ls-copy{position:absolute;top:6px;right:6px;display:flex}
.scs .ls-note{margin:0;font:var(--text-meta) var(--font-ui);color:var(--stage-mute)}
.scs .ls-foot{flex:none;display:flex;justify-content:space-between;padding:8px 12px;border-top:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);background:color-mix(in srgb,var(--stage-black) 30%,transparent);font:var(--text-meta) var(--font-ui);color:var(--stage-mute)}
.scs .ls-none{padding:48px 12px;text-align:center;color:var(--stage-dim)}
.scs .ls-none p{margin:12px 0 0;font:var(--text-control) var(--font-ui);color:var(--stage-mute)}
.scs .ls-none small{display:block;margin-top:4px;font:var(--text-meta) var(--font-ui);color:var(--stage-dim)}
.scs .ls-book{margin-bottom:12px}
.scs .ls-bk{display:flex;width:100%;align-items:center;gap:8px;margin-bottom:4px;padding:6px 8px;border:0;border-left:2px solid var(--deck-lorebook);background:color-mix(in srgb,var(--stage-black) 30%,transparent);font:500 var(--text-meta) var(--font-ui);color:var(--stage-card);text-align:left}
.scs .ls-bk span{flex:1}.scs .ls-bk small{font:var(--text-meta) var(--font-ui);color:var(--stage-dim)}
.scs .ls-search{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);color:var(--stage-dim)}
.scs .ls-search input{flex:1;padding:6px 10px;border:1px solid color-mix(in srgb,var(--stage-card) 8%,transparent);background:color-mix(in srgb,var(--stage-card) 5%,transparent);font:var(--text-control) var(--font-ui);color:var(--stage-card)}
.scs .ls-sum{display:flex;align-items:center;gap:16px;padding:12px;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);background:color-mix(in srgb,var(--stage-black) 20%,transparent)}
.scs .ls-sum>div{text-align:center}.scs .ls-sum>div>[data-control=chip][aria-pressed="true"] b{text-decoration:underline}.scs .ls-sum b{display:block;font:700 20px var(--font-ui);color:var(--stage-ok)}.scs .ls-sum small{font:var(--text-meta) var(--font-ui);color:var(--stage-mute)}
.scs .ls-chips{display:flex;flex-wrap:wrap;gap:6px}
.scs .ls-scope{flex:none;padding:2px 6px;border:1px solid color-mix(in srgb,var(--c) 40%,transparent);background:color-mix(in srgb,var(--c) 15%,transparent);font:var(--text-meta) var(--font-ui);color:var(--c)}
.scs .ls-val{margin-left:auto;padding-left:8px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:var(--text-meta) var(--font-mono);color:var(--stage-dim)}
.scs .ls-meta{display:flex;flex-wrap:wrap;gap:12px;margin:6px 0 0;font:var(--text-meta) var(--font-ui);color:var(--stage-dim)}
.scs .ls-meta .mono{font-family:var(--font-mono)}
.scs .ls-err{display:flex;align-items:center;gap:6px;margin:0;padding:8px 12px;font:var(--text-meta) var(--font-ui);color:var(--stage-danger-text)}
.scs .ls-merrs{display:grid;gap:4px;padding:8px 12px;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent)}
.scs .ls-merr,.scs .ls-mut{display:flex;align-items:center;gap:8px;margin:0;font:var(--text-meta) var(--font-ui);color:var(--stage-soft)}
.scs .ls-merr{color:var(--stage-danger-text)}
.scs .ls-merr code,.scs .ls-mut code{font:var(--text-meta) var(--font-mono);color:var(--stage-card)}
.scs .ls-mut .ls-scope{--c:var(--stage-var)}
.scs .ls-hist{display:grid;gap:2px;margin:8px 0 0;padding:0;list-style:none}
.scs .ls-hist li{display:flex;gap:8px;align-items:baseline;font:var(--text-meta) var(--font-mono);color:var(--stage-soft)}
.scs .ls-hist b{color:var(--stage-card)}.scs .ls-hist small{margin-left:auto;font-family:var(--font-ui);color:var(--stage-dim)}
.scs .ls input:focus-visible{outline:2px solid var(--focus-ring);outline-offset:1px}
`;
