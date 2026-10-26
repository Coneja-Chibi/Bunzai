/**
 * The Messenger Trackers panel's styles (approved wireframe messenger-discord/panels.html section 5): the header line with its gear, the pinned-messages style cards with a hover bar, the
 * drill-in header and the footer. A tracker's own panel inside is untouched. Rooted `:root .scs .msn` like messenger-style.ts, which mounts this sheet; colors are the layout's --msg-* palette.
 */
const M = ":root .scs .msn";

export const MSN_TRACKERS_STYLE = `
${M} .msn-trk{display:flex;flex-direction:column;gap:8px;min-height:100%;padding:12px}
${M} .msn-trk-top{display:flex;align-items:center;gap:6px;min-height:32px}
${M} .msn-trk-sum{flex:1;min-width:0;color:var(--msg-mute);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${M} .msn-trk .dr-note-line{margin:0;border-radius:var(--msn-radius)}
${M} .msn-trk-list{display:flex;flex-direction:column;gap:8px;flex:1}
${M} .msn-trk-empty{margin:12px 0;color:var(--msg-mute);font-size:12px}
${M} .msn-trk-card{position:relative;border:1px solid var(--msg-edge);border-left:3px solid var(--tone,var(--msg-brand));border-radius:var(--msn-radius);background:var(--msg-bar)}
${M} .msn-trk-card [data-control="row"]{border-radius:var(--msn-radius);color:inherit;--text-soft:var(--msg-mute)}
${M} .msn-trk-card [data-control="row"]:hover:not(:disabled){background:var(--msg-hover)}
${M} .msn-trk-line{margin:0;padding:0 12px 8px 40px;color:var(--msg-mute);font-size:12px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${M} .msn-trk-bar{position:absolute;top:6px;right:34px;display:none;gap:2px;padding:2px;border:1px solid var(--msg-edge);border-radius:var(--msn-radius);background:var(--msg-side)}
${M} .msn-trk-card:is(:hover,:focus-within) .msn-trk-bar{display:flex}
@media (hover:none){${M} .msn-trk-bar{display:flex}}
${M} .msn-trk-detail{display:flex;flex-direction:column;gap:12px}
${M} .msn-trk-dh{display:flex;align-items:center;gap:8px;color:var(--msg-bright);font-size:15px}
${M} .msn-trk-subs h3{margin:0 0 6px;color:var(--msg-mute);font:700 12px/1.4 var(--font-body);letter-spacing:.02em}
${M} .msn-trk-set{display:flex;flex-direction:column;gap:12px}
${M} .msn-trk-foot{display:flex;align-items:center;gap:8px;margin-top:auto;padding-top:8px;border-top:1px solid var(--msg-edge);color:var(--msg-mute);font-size:12px}
${M} .msn-trk-foot>[data-control="button"]{margin-left:auto}
`;
