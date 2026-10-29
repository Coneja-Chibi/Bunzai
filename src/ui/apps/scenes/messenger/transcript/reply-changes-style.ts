/**
 * The change visuals under a reply and the out-of-time line (approved wireframe premiere/scene-pieces.html, section 3). Rooted `:root .scs .msn` like messenger-style.ts, which mounts this sheet;
 * colors are the layout's --msg-* palette, a number going up or down takes the theme's ok and danger roles, and nothing here animates (the toast is the shared one, which does not).
 */
const M = ":root .scs .msn";

export const MSN_CHANGES_STYLE = `
${M} .msn-rc{display:flex;flex-direction:column;align-items:flex-start;gap:8px;margin-top:8px}
${M} .msn-rc-chips{display:flex;flex-wrap:wrap;gap:8px}
${M} .msn-rc [data-control="chip"]{gap:6px}
${M} .msn-rc-v{color:var(--msg-bright);font:600 12px/1 var(--font-mono)}
${M} .msn-rc-d{font:600 12px/1 var(--font-mono)}
${M} .msn-rc-d[data-dir="up"]{color:var(--stage-ok)}
${M} .msn-rc-d[data-dir="down"]{color:var(--stage-danger-text)}
${M} .msn-rc-bar{position:relative;display:inline-block;width:56px;height:6px;border-radius:var(--msn-radius);background:var(--msg-chat);overflow:hidden}
${M} .msn-rc-bar>i{position:absolute;inset:0 auto 0 0;width:var(--fill);background:var(--msg-brand)}
${M} .msn-rc-bar>s{position:absolute;top:0;bottom:0;left:var(--was);width:2px;background:var(--msg-mute)}
${M} .msn-rc-card{display:flex;flex-direction:column;gap:6px;max-width:360px;padding:10px 12px;border-left:3px solid var(--msg-brand);background:var(--msg-side)}
${M} .msn-rc-card>header{display:flex;align-items:center;gap:6px;color:var(--msg-bright);font:700 13px/1.4 var(--font-body)}
${M} .msn-rc-card>header small{color:var(--msg-faint);font-weight:400}
${M} .msn-rc-row{display:grid;grid-template-columns:minmax(0,8ch) auto auto;align-items:center;gap:8px;font-size:12px}
${M} .msn-rc-row .msn-rc-bar{width:100%}
${M} .msn-rc-k{display:inline-flex;align-items:center;gap:4px;color:var(--msg-mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${M} .msn-rc-was{grid-column:1/-1;color:var(--msg-faint)}
${M} .msn-rc-late{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:8px 0 0;color:var(--stage-warn);font-size:12px;line-height:1.5}
`;
