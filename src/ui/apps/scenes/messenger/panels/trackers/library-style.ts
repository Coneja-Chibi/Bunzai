/**
 * The library trackers' styles in the Messenger Trackers panel (approved wireframe premiere/scene-pieces.html, 1a and 1b): the stat line with its bar, pips, item tiles in a scroll box, the Library
 * tag, the field editors and the hint. Rooted `:root .scs .msn` like trackers-style.ts, which this sheet follows; colors are the layout's --msg-* palette, a card wears its tracker's own tone
 * when it has one (`--tone`) and the brand color otherwise.
 */
const M = ":root .scs .msn";

export const MSN_LIBRARY_STYLE = `
${M} .msn-lib-card{--tone:var(--msg-brand)}
${M} .msn-lib-face{display:flex;flex-direction:column;gap:6px;padding:0 12px 10px 12px}
${M} .msn-lib-scroll{max-height:200px;overflow-y:auto}
${M} .msn-lib-stat{display:grid;grid-template-columns:minmax(0,7ch) minmax(0,1fr) auto;align-items:center;gap:8px;min-height:24px;font-size:12px}
${M} .msn-lib-stat>.msn-lib-text{grid-column:2/-1;color:var(--msg-text)}
${M} .msn-lib-k{display:inline-flex;align-items:center;gap:4px;color:var(--msg-mute);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${M} .msn-lib-v{color:var(--msg-bright);font:600 12px/1 var(--font-mono)}
${M} .msn-lib-bar{display:block;height:8px;border-radius:var(--msn-radius);background:var(--msg-chat);overflow:hidden}
${M} .msn-lib-bar>i{display:block;width:var(--fill);height:100%;background:var(--tone,var(--msg-brand))}
${M} .msn-lib-pips{display:flex;flex-wrap:wrap;gap:6px}
${M} .msn-lib-pip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border:1px solid var(--msg-edge);border-radius:var(--msn-radius);color:var(--msg-mute);font-size:12px}
${M} .msn-lib-pip[data-on]{border-color:var(--tone,var(--msg-brand));color:var(--msg-bright);background:var(--msg-hover)}
${M} .msn-lib-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:6px}
${M} .msn-lib-items [data-control="row"]{border:1px solid var(--msg-edge);border-radius:var(--msn-radius)}
${M} .msn-lib-n{color:var(--msg-bright);font:600 12px/1 var(--font-mono)}
${M} .msn-lib-none{margin:0;color:var(--msg-mute);font-size:12px}
${M} .msn-lib-tag{padding:1px 6px;border:1px solid var(--tone,var(--msg-brand));border-radius:var(--msn-radius);color:var(--msg-mute);font:700 10px/1.4 var(--font-body);letter-spacing:.04em;text-transform:uppercase}
${M} .msn-lib-grow{flex:1}
${M} .msn-lib-detail,${M} .msn-lib-pick{display:flex;flex-direction:column;gap:12px}
${M} .msn-lib-edit{display:flex;flex-direction:column;gap:4px;margin:0;padding:0;border:0;min-width:0}
${M} .msn-lib-row{display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid var(--msg-edge);border-left:3px solid var(--tone,var(--msg-brand));border-radius:var(--msn-radius)}
${M} .msn-lib-add{display:flex;gap:6px}
${M} .msn-lib-add input{flex:1;min-width:0}
${M} .msn-lib-hint{margin:0;color:var(--msg-mute);font-size:12px;line-height:1.4}
${M} .msn-lib-cost{margin:0;color:var(--msg-mute);font-size:12px}
${M} .msn-lib-cost b{color:var(--msg-bright);font:600 12px/1 var(--font-mono)}
${M} .msn-lib-group{margin:0;color:var(--msg-mute);font:700 12px/1.4 var(--font-body);letter-spacing:.02em}
`;
