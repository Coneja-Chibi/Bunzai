/**
 * The workshop layer and the Regex Workshop page's style (approved wireframe messenger-discord/panels.html section 6b). Colors are the layout's own --msg-* palette and corners are
 * --msn-radius. Rooted `:root .scs .msn` like messenger-style.ts, which mounts this sheet. Buttons, rows and switches are the button family's own; nothing here styles `button`.
 * The program bodies inside the page are Full Chat's editors: their wing hero repeats the page title, so a plain hero (no tools, not an error) is left out here.
 */
const M = ":root .scs .msn";

export const WORKSHOP_STYLE = `
${M} .msn-wk{display:grid;grid-template-columns:250px minmax(0,1fr);width:100%;min-height:0}
${M} .msn-wk-nav{display:flex;flex-direction:column;min-height:0;overflow-y:auto;padding:16px 10px;background:var(--msg-side);border-right:1px solid var(--msg-edge);scrollbar-width:thin}
${M} .msn-wk-who{display:flex;align-items:center;gap:10px;padding:4px 6px 12px}
${M} .msn-wk-who>div{display:flex;flex-direction:column;min-width:0}
${M} .msn-wk-who b{color:var(--msg-bright);font-size:14px;overflow-wrap:anywhere}
${M} .msn-wk-who small{color:var(--msg-mute);font-size:12px}
${M} .msn-wk-grp{display:flex;flex-direction:column;gap:2px}
${M} .msn-wk-cap{margin-top:8px;padding:8px 10px 4px;color:var(--msg-faint);font-size:12px;font-weight:700}
${M} .msn-wk-grp [data-control="row"]{border-radius:var(--msn-radius);color:var(--msg-mute);font-weight:600}
${M} .msn-wk-grp [data-control="row"]:hover:not(:disabled){background:var(--msg-hover);color:var(--msg-bright)}
${M} .msn-wk-grp [data-control="row"][data-selected]{background:var(--msg-active);color:var(--msg-white);border-left-color:transparent}
${M} .msn-wk-page{display:flex;flex-direction:column;min-width:0;min-height:0;background:var(--msg-chat)}
${M} .msn-wk-h{flex:none;padding:24px 84px 12px 32px}
${M} .msn-wk-h>[data-part="scene.messenger.workshop.popout"]{float:right}
${M} .msn-wk-h h2{margin:0;color:var(--msg-bright);font:800 22px/1.25 var(--font-body);overflow-wrap:anywhere}
${M} .msn-wk-h p{margin:4px 0 0;color:var(--msg-mute);font-size:13px}
${M} .msn-wk-b{flex:1;min-height:0;min-width:0;padding:0 24px 20px 32px;overflow:hidden}
${M} .msn-wk-b .msn-prog{background:none;border-radius:0}
${M} .msn-wk-b header.hero:not(.bad):not(:has(.hero-tools)){display:none}
${M} .msn-wk-quiet{margin:8px 0;color:var(--msg-mute);font-size:13px}
${M} .msn-rx{display:flex;flex-direction:column;gap:10px;padding:4px 0 8px}
${M} .msn-rx-cap{color:var(--msg-mute);font-size:12px;font-weight:700}
${M} .msn-rx-cap span{margin-left:4px;color:var(--msg-faint);font-weight:600}
${M} .msn-rx-row{display:flex;align-items:center;gap:10px;min-height:56px;padding:6px 10px;border:1px solid var(--msg-divider);border-radius:var(--msn-radius);background:var(--msg-bar)}
${M} .msn-rx-row[data-dragging="true"]{opacity:.5}
${M} .msn-rx-tx{display:flex;flex:1;flex-direction:column;min-width:0}
${M} .msn-rx-tx b{overflow:hidden;color:var(--msg-bright);font-size:14px;text-overflow:ellipsis;white-space:nowrap}
${M} .msn-rx-tx small{overflow:hidden;color:var(--msg-mute);font-size:12px;text-overflow:ellipsis;white-space:nowrap}
${M} .msn-rx-mt{display:flex;flex:none;align-items:center;gap:8px}
${M} .msn-rx-none{display:flex;flex-direction:column;align-items:center;gap:4px;padding:28px 12px;border:1px dashed var(--msg-field-edge);border-radius:var(--msn-radius);color:var(--msg-mute);text-align:center}
${M} .msn-rx-none b{color:var(--msg-bright)}
@container (max-width:760px){
${M} .msn-wk{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr)}
${M} .msn-wk-nav{flex-direction:row;align-items:center;gap:6px;padding:8px 64px 8px 10px;border-right:0;border-bottom:1px solid var(--msg-edge);overflow:auto hidden}
${M} .msn-wk-who,${M} .msn-wk-cap{display:none}
${M} .msn-wk-nav nav{display:flex;gap:4px}
${M} .msn-wk-grp{flex-direction:row;gap:4px}
${M} .msn-wk-h{padding:16px 16px 8px}
${M} .msn-wk-b{padding:0 12px 12px}
}
`;
