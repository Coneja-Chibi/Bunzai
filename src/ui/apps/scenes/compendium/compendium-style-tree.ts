/**
 * The tree-shaping pieces of the Compendium (RoleCall `NodeConstraintMenu.tsx`, `EntryPickerModal.tsx`, the Dashboard header's Tree
 * maintenance): the constraint menu card over the Catalogue, the flag marks on a row, the maintenance disclosure, and the entry
 * picker dialog. The picker is drawn in a dialog outside the scene's stylesheet scope, so its rules use global tokens. Sizes follow
 * RoleCall's (the menu is 220px) with its own type sizes; every colour is a theme token.
 */
export const COMPENDIUM_TREE_STYLE = `
.scs .cp-cat{position:relative}
.scs .cp-tmenu{position:absolute;z-index:5;width:220px;border:2px solid var(--wa-line);background:var(--stage-black);box-shadow:4px 4px 0 0 var(--stage-black)}
.scs .cp-tmenu .hd{padding:8px 12px;border-bottom:1px solid var(--wa-line)}
.scs .cp-tmenu .hd small{display:block;font:700 10px var(--font-fancy);letter-spacing:.2em;text-transform:uppercase;color:var(--stage-mute)}
.scs .cp-tmenu .hd b{display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:400;color:var(--wa)}
.scs .cp-tmenu>button{display:flex;align-items:flex-start;gap:8px;width:100%;padding:8px 12px;border:0;background:none;text-align:left;color:var(--stage-mute);cursor:pointer}
.scs .cp-tmenu>button:hover{background:var(--wa-soft)}
.scs .cp-tmenu>button.on{background:var(--wa-soft);color:var(--wa)}
.scs .cp-tmenu>button svg{flex:none;margin-top:2px}
.scs .cp-tmenu>button span{min-width:0}
.scs .cp-tmenu>button b{display:block;font:700 10px var(--font-fancy);letter-spacing:.1em;text-transform:uppercase;color:var(--stage-card)}
.scs .cp-tmenu>button.on b{color:var(--wa)}
.scs .cp-tmenu>button small{display:block;margin-top:2px;font-size:10px;line-height:1.35;color:var(--stage-mute)}
.scs .cp-tmenu .ft{display:flex;justify-content:flex-end;padding:6px 12px;border-top:1px solid var(--wa-line)}
.scs .cp-tmenu .ft button{display:flex;align-items:center;gap:4px;border:0;background:none;font-size:10px;color:var(--stage-mute);cursor:pointer}
.scs .cp-flags{flex:none;display:inline-flex;align-items:center;gap:4px;color:var(--wa)}
.scs .cp-flags span{display:inline-flex;color:var(--bk-role-danger-text)}
.scs .cp-maint{margin-top:6px;border:1px solid var(--cp-rule);text-align:left}
.scs .cp-maint summary{padding:6px 12px;font:700 11px var(--font-fancy);letter-spacing:.25em;text-transform:uppercase;color:var(--stage-mute);cursor:pointer}
.scs .cp-maint summary:hover{background:var(--wa-soft)}
.scs .cp-maint p{margin:0;padding:4px 12px 8px;max-width:30em;font-size:11px;line-height:1.45;color:var(--stage-soft)}
.scs .cp-maint .row{display:flex;flex-wrap:wrap;gap:8px;padding:0 12px 10px}
.scs .cp-maint button{padding:6px 12px;border:2px solid var(--stage-black);background:var(--stage-sunken);color:var(--stage-card);font:700 11px var(--font-fancy);letter-spacing:.12em;text-transform:uppercase;cursor:pointer}
.scs .cp-maint button.go{border-color:var(--wa);color:var(--wa)}
.scs .cp-maint button:disabled{opacity:.5;cursor:default}
.scs .cp-maint .notes{margin:0;padding:0 12px 10px 28px;font-size:11px;color:var(--bk-role-warn-text)}
.cp-pick.cp-pick{max-width:28rem;max-height:80vh;display:flex;flex-direction:column;padding:0}
.cp-pick header{padding:12px 16px;border-bottom:1px solid var(--bk-line-control)}
.cp-pick h3{margin:0;font:700 14px var(--font-fancy);letter-spacing:.15em;text-transform:uppercase}
.cp-pick header p{margin:6px 0 0;font-size:14px;color:var(--bk-text-soft)}
.cp-pick .se{display:block;padding:10px 16px 0}
.cp-pick .se svg{display:none}
.cp-pick .se input{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--bk-line-control);background:var(--bk-surface-sunken);color:var(--bk-text);font:inherit}
.cp-pick .ct{display:block;padding:6px 16px;font:11px var(--font-ui);letter-spacing:.1em;text-transform:uppercase;color:var(--bk-text-dim)}
.cp-pick .list{flex:1;min-height:0;overflow-y:auto;padding:0 8px}
.cp-pick .list button{display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border:0;background:none;text-align:left;color:var(--bk-text);font:inherit;cursor:pointer}
.cp-pick .list button:hover{background:var(--bk-surface-sunken)}
.cp-pick .list i{width:8px;height:8px;flex:none;background:var(--bk-text-dim)}
.cp-pick .list span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cp-pick .list em{font:11px var(--font-ui);font-style:normal;color:var(--bk-text-dim)}
.cp-pick .none{margin:0;padding:12px 8px;font-size:14px;font-style:italic;color:var(--bk-text-dim)}
.cp-pick footer{display:flex;justify-content:flex-end;padding:10px 16px;border-top:1px solid var(--bk-line-control)}
.cp-pick footer button{padding:6px 12px;border:1px solid var(--bk-line-control);background:var(--bk-surface-sunken);color:var(--bk-text);font:700 11px var(--font-ui);letter-spacing:.05em;text-transform:uppercase;cursor:pointer}
`;

/** Tree building, the constraints list, Historian and Import chat history inside the Settings tab. */
export const COMPENDIUM_TREE_SETTINGS_STYLE = `
.scs .cps-more{border:1px solid color-mix(in srgb,var(--stage-card) 8%,transparent)}
.scs .cps-more summary{padding:8px 12px;font:700 11px var(--font-ui);letter-spacing:.25em;text-transform:uppercase;color:var(--stage-text-dim);cursor:pointer}
.scs .cps-more[open]>summary{border-bottom:1px solid color-mix(in srgb,var(--stage-card) 8%,transparent)}
.scs .cps-more>div{padding:12px}
.scs .cps-empty{margin:0;padding:16px 0;text-align:center;font-size:14px;font-style:italic;color:var(--stage-soft)}
.scs .cps-range{display:flex;align-items:center;gap:12px}
.scs .cps-range output{min-width:5ch;text-align:right;font:var(--text-control) var(--font-mono);color:var(--stage-card)}
.scs .cps-phases{display:flex;flex-direction:column;gap:12px;padding-top:12px;border-top:1px solid color-mix(in srgb,var(--stage-card) 8%,transparent)}
.scs .cps-rr{display:flex;align-items:flex-end;gap:12px;margin-top:8px}
.scs .cps-rr label{flex:1;display:flex;flex-direction:column;gap:4px;font:700 11px var(--font-ui);letter-spacing:.14em;text-transform:uppercase;color:var(--stage-text-dim)}
.scs .cps-rr input{padding:6px 8px;border:2px solid var(--stage-black);background:var(--stage-row);color:var(--stage-card);font:var(--text-control) var(--font-mono)}
.scs .cps-rr small{padding-bottom:8px;font:11px var(--font-ui);letter-spacing:.14em;text-transform:uppercase;color:var(--stage-mute)}
.scs .cps-rr.go .cps-btn{flex:1}
.scs .cps-btn.off{flex:none;background:none;color:var(--bk-role-danger-text);border-color:var(--bk-role-danger-text)}
.scs .cps-drawer{margin-top:12px;padding:12px;border:2px solid var(--stage-black);background:var(--stage-row)}
.scs .cps-drawer .hd{display:flex;justify-content:space-between;gap:12px;margin-bottom:8px}
.scs .cps-drawer .hd b{font:700 11px var(--font-ui);letter-spacing:.14em;text-transform:uppercase;color:var(--stage-card)}
.scs .cps-drawer small{font:10px var(--font-mono);color:var(--stage-mute)}
.scs .cps-drawer ol{margin:0;padding:0;list-style:none;max-height:16rem;overflow-y:auto;font-size:10px;color:var(--stage-soft)}
.scs .cps-drawer li{padding:4px 0;border-top:1px solid color-mix(in srgb,var(--stage-card) 8%,transparent)}
.scs .cps-drawer li.bad{color:var(--bk-role-danger-text)}
.scs .cps-btn.wide{width:100%}
.scs .cps-diag{display:flex;flex-direction:column;gap:6px;max-height:24rem;overflow-y:auto}
.scs .cps-diag .row{padding:8px 12px;border:1px solid currentColor;font-size:var(--text-control)}
.scs .cps-diag .row.pass{color:var(--bk-role-ok-text)}
.scs .cps-diag .row.warn{color:var(--bk-role-warn-text)}
.scs .cps-diag .row.fail{color:var(--bk-role-danger-text)}
.scs .cps-diag em{font:700 11px var(--font-ui);font-style:normal;letter-spacing:.08em}
.scs .cps-diag span{color:var(--stage-card)}
.scs .cps-diag p{margin:2px 0 0;color:var(--stage-soft)}
.scs .cps-diag ul{margin:6px 0 0;padding-left:20px;font-size:11px;color:var(--stage-mute)}
.scs .cps-cons{display:flex;flex-direction:column;gap:8px}
.scs .cps-cons .row{display:flex;align-items:center;gap:12px;padding:8px 12px;border:1px solid color-mix(in srgb,var(--stage-card) 8%,transparent);background:var(--stage-row)}
.scs .cps-cons .row>div{flex:1;min-width:0}
.scs .cps-cons b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:400 var(--text-control) var(--font-ui);color:var(--cpa)}
.scs .cps-cons .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
.scs .cps-cons em{display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border:1px solid currentColor;font:700 10px var(--font-ui);font-style:normal;letter-spacing:.08em;text-transform:uppercase}
.scs .cps-cons em.locked{color:var(--cpa)}
.scs .cps-cons em.forbidden{color:var(--bk-role-danger-text)}
.scs .cps-cons em.reorganize{color:var(--bk-role-info-text)}
.scs .cps-cons em.pinned{color:var(--stage-soft)}
.scs .cps-cons .row>button{flex:none;width:28px;height:28px;display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);background:none;color:var(--stage-soft);cursor:pointer}
.scs .cps-cons .row>button:hover{color:var(--bk-role-danger-text);border-color:var(--bk-role-danger-text)}
`;
