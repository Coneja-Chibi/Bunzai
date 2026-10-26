/**
 * Styles for the workshop layer and the scoped settings window (approved wireframe messenger-discord/settings.html). Colors are the layout's own --msg-* palette (tokens.css);
 * corners use the Messenger-only --msn-radius (defined with the panel frames, 10px here if it is not). Rooted `:root .scs .msn` like messenger-style.ts, which mounts this sheet.
 * Buttons, rows, toggles and chips are the button family's own; nothing here styles `button`. The window answers to its own width: below 900px the nav and the page are two screens.
 */
const M = ":root .scs .msn";
const R = "var(--msn-radius,10px)";

export const SETTINGS_STYLE = `
${M} .msn-layer{position:absolute;inset:0;z-index:110;display:flex;min-width:0;min-height:0;container-type:inline-size;background:var(--msg-chat);color:var(--msg-text)}
${M} .msn-layer>[data-msn-close]{position:absolute;top:12px;right:20px;z-index:2}
${M} .msn-st{display:grid;grid-template-columns:280px minmax(0,1fr);width:100%;min-height:0}
${M} .msn-st-nav{display:flex;flex-direction:column;min-height:0;background:var(--msg-side);border-right:1px solid var(--msg-edge)}
${M} .msn-st-who{display:flex;align-items:center;gap:12px;padding:18px 16px 12px}
${M} .msn-st-who>div{display:flex;flex-direction:column;min-width:0;align-items:flex-start}
${M} .msn-st-who small{color:var(--msg-faint);font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
${M} .msn-st-who b{color:var(--msg-bright);font-size:15px;overflow-wrap:anywhere}
${M} .msn-st-who span{color:var(--msg-mute);font-size:12px}
${M} .msn-st-search{display:flex;align-items:center;gap:8px;margin:0 10px 8px;padding:0 10px;min-height:32px;border:1px solid var(--msg-field-edge);border-radius:${R};background:var(--msg-rail);color:var(--msg-mute)}
${M} .msn-st-search input{flex:1;min-width:0;border:0;background:transparent;outline:0;color:var(--msg-text);font:inherit}
${M} .msn-st-search:focus-within{outline:2px solid var(--msg-focus);outline-offset:1px}
${M} .msn-st-cats .msn-st-secd{margin:8px 10px}
${M} .msn-st-cats>[data-control="row"]{border-radius:${R};color:var(--msg-mute)}
${M} .msn-st-cats>[data-control="row"]:hover:not(:disabled){background:var(--msg-hover);color:var(--msg-bright)}
${M} .msn-st-cats{display:flex;flex-direction:column;gap:2px;min-height:0;overflow-y:auto;padding:4px 10px 24px;scrollbar-width:thin}
${M} .msn-st-cap{margin-top:8px;padding:12px 10px 4px;border-top:1px solid var(--msg-divider);color:var(--msg-faint);font-size:12px;font-weight:700}
${M} .msn-st-cat>[data-control="row"]{border-radius:${R};color:var(--msg-mute);font-weight:600}
${M} .msn-st-cat>[data-control="row"]:hover:not(:disabled){background:var(--msg-hover);color:var(--msg-bright)}
${M} .msn-st-cat>[data-control="row"][data-selected]{background:var(--msg-active);color:var(--msg-white);border-left-color:transparent}
${M} .msn-st-sub{display:flex;flex-direction:column;margin:2px 0 6px 22px;border-left:1px solid var(--msg-divider)}
${M} .msn-st-sub [data-control="row"]{border-radius:0 ${R} ${R} 0;color:var(--msg-faint);font-size:13px;font-weight:500}
${M} .msn-st-sub [data-control="row"]:hover:not(:disabled){background:var(--msg-hover);color:var(--msg-bright)}
${M} .msn-st-sub [data-control="row"][data-selected]{background:transparent;color:var(--msg-bright);font-weight:700;border-left-color:transparent;box-shadow:inset 3px 0 0 var(--msg-bright)}
${M} .msn-st-page{display:flex;flex-direction:column;min-width:0;min-height:0;background:var(--msg-chat)}
${M} .msn-st-top{display:flex;align-items:center;gap:8px;flex:none;min-height:56px;padding:8px 84px 8px 20px;border-bottom:1px solid var(--msg-edge);color:var(--msg-bright);font-weight:700;font-size:16px}
${M} .msn-st-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${M} .msn-st-listback{display:none}
${M} .msn-st-chips{display:none}
${M} .msn-st-scroll{position:relative;flex:1;min-height:0;overflow-y:auto;scrollbar-width:thin;outline:none}
${M} .msn-st-in{max-width:704px;margin:0 auto;padding:28px 24px 0}
${M} .msn-st-spacer{height:70vh}
${M} .msn-st-h1{margin:0 0 20px;color:var(--msg-bright);font:800 23px/1.25 var(--font-body)}
${M} .msn-st-blk{padding:0 0 35px}
${M} .msn-st-blk+.msn-st-blk{padding-top:35px;border-top:1px solid var(--msg-divider)}
${M} .msn-st-blk h2{margin:0 0 5px;color:var(--msg-bright);font:800 23px/1.25 var(--font-body)}
${M} .msn-st-secd{margin:0 0 16px;color:var(--msg-faint);font-size:13.5px;line-height:1.5}
${M} .msn-st-rows{display:flex;flex-direction:column;gap:16px;margin-top:16px}
${M} .msn-st-r{display:flex;align-items:center;justify-content:space-between;gap:22px}
/* Rows breathe the same whether a section body nests them or not; a drill row lines up with the rest (no inner inset). */
${M} .msn-st-rows :is(.msn-st-r,.msn-st-radios,[data-part="scene.messenger.settings.row.drill"]){padding-block:6px}
${M} .msn-st-rows [data-part="scene.messenger.settings.row.drill"]{padding-inline:0;border-left:0}
${M} .msn-st-who>:not(:last-child){flex:none;width:40px;height:40px;overflow:hidden;border-radius:50%}
${M} .msn-st-t{flex:1;min-width:0}
${M} .msn-st-t b{display:block;color:var(--msg-bright);font:600 15px/1.4 var(--font-body)}
${M} .msn-st-t span{display:block;max-width:480px;margin-top:2px;color:var(--msg-faint);font-size:13px;line-height:1.5}
${M} .msn-st-c{display:flex;align-items:center;flex:none;gap:13px}
${M} .msn-st-val{color:var(--msg-mute);font-size:14px}
${M} :is(.msn-st-under,.msn-st-stack){flex-direction:column;align-items:stretch;gap:8px}
${M} .msn-st-sl{display:flex;align-items:center;gap:13px}
${M} .msn-st-sl input{flex:1;min-width:0;accent-color:var(--msg-brand)}
${M} .msn-st-pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}
${M} .msn-st-pl{display:flex;flex-direction:column;gap:6px;color:var(--msg-mute);font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
${M} .msn-st-radios{display:flex;flex-direction:column;gap:10px}
${M} .msn-st-radios [data-control="row"]{border:1px solid var(--msg-field-edge);border-radius:${R};background:var(--msg-side);padding:10px 14px}
${M} .msn-st-radios [data-control="row"][data-selected]{border-color:var(--msg-brand);background:color-mix(in srgb,var(--msg-brand) 12%,var(--msg-side))}
${M} :is(.msn-st-sel,.msn-st-num,.msn-st-ta){box-sizing:border-box;padding:8px 12px;border:1px solid var(--msg-field-edge);border-radius:8px;background:var(--msg-rail);color:var(--msg-text);font:500 14px/1.4 var(--font-body)}
${M} .msn-st-sel{min-width:190px;font-weight:500;letter-spacing:0;text-transform:none}
${M} .msn-st-pair .msn-st-sel{width:100%}
${M} .msn-st-num{width:96px;text-align:right}
${M} .msn-st-ta{width:100%;min-height:88px;resize:vertical;font-size:13px;line-height:1.55}
${M} :is(.msn-st-sel,.msn-st-num,.msn-st-ta,.msn-st-sl input):focus-visible{outline:2px solid var(--msg-focus);outline-offset:2px}
${M} .msn-st-nav [data-control="row"]:focus-visible,${M} .msn-st-page [data-control="row"]:focus-visible{outline:2px solid var(--msg-focus);outline-offset:-2px}
@container (max-width:900px){
${M} .msn-st{grid-template-columns:minmax(0,1fr)}
${M} .msn-st[data-screen="nav"] .msn-st-page,${M} .msn-st[data-screen="page"] .msn-st-nav{display:none}
${M} .msn-st-listback{display:inline-flex}
${M} .msn-st-sub{display:none}
${M} .msn-st-chips{display:flex;gap:6px;flex:none;overflow-x:auto;padding:8px 12px;border-bottom:1px solid var(--msg-edge);scrollbar-width:none}
${M} .msn-st-in{padding:20px 16px 0}
${M} .msn-st-r:not(.msn-st-under,.msn-st-stack){flex-wrap:wrap}
${M} .msn-st-pair{grid-template-columns:1fr}
}
`;
