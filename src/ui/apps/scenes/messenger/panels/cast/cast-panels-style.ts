/**
 * The Cast panels' styles (approved wireframe messenger-discord/panels.html section 2): the member list, the profile card and the inspector tabs. Colors are the layout's own --msg-* palette
 * and the corner is --msn-radius; the only colors that are not tokens are the people's own, set inline as data. Rooted `:root .scs .msn` like messenger-style.ts, which mounts this sheet.
 * Nothing here styles the `button` element: every control is the button family's own.
 */
const M = ":root .scs .msn";

export const CAST_PANELS_STYLE = `
${M} .msn-cm{display:flex;flex-direction:column;gap:2px}
${M} .msn-cm-count{margin:0 0 6px;color:var(--msg-mute);font-size:12px}
${M} .msn-cm-find{box-sizing:border-box;width:100%;margin:0 0 8px;padding:6px 8px;border:1px solid var(--msg-field-edge);border-radius:var(--msn-radius);background:var(--msg-input);color:var(--msg-bright);font:inherit;font-size:13px}
${M} .msn-cm-recon.cw-reg{padding:0 0 8px}
${M} .msn-cm-foot{margin-top:12px;padding-top:8px;border-top:1px solid var(--msg-divider)}
${M} .msn-cm-err{margin:4px 0;color:var(--msg-white);font-size:12px}
${M} .msn-cm section{display:flex;flex-direction:column;gap:2px;margin-top:8px}
${M} .msn-cm-row{position:relative;display:flex;align-items:center;gap:8px;min-height:44px;padding:2px 6px;border-radius:var(--msn-radius)}
${M} .msn-cm-row:hover,${M} .msn-cm-row:focus-within{background:var(--msg-hover)}
${M} .msn-cm-row[data-dim]{opacity:.6}
${M} .msn-cm-face{display:flex;align-items:center;justify-content:center;width:32px;height:32px;flex:none;border-radius:50%;background:var(--msg-brand);color:var(--msg-white);font-size:12px;font-weight:700}
${M} .msn-cm-face[data-big]{width:56px;height:56px;border:4px solid var(--msg-side);font-size:18px}
${M} .msn-cm-tx{display:flex;flex-direction:column;flex:1;min-width:0;line-height:1.25}
${M} .msn-cm-tx b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;color:var(--msg-bright)}
${M} .msn-cm-tx small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--msg-mute);font-size:12px}
${M} .msn-cm-mt{display:flex;align-items:center;gap:4px;flex:none}
${M} .msn-cm-badge{padding:1px 6px;border-radius:var(--msn-radius);background:var(--msg-pill);color:var(--msg-pill-text);font-size:11px;font-weight:600}
${M} .msn-cm-dot{width:8px;height:8px;border-radius:50%;background:var(--msg-faint)}
${M} .msn-cm-dot[data-on]{background:var(--msg-brand)}
${M} .msn-cm-bar{position:absolute;right:6px;top:50%;display:none;transform:translateY(-50%);padding:2px;border-radius:var(--msn-radius);background:var(--msg-rail)}
${M} .msn-cm-row:hover .msn-cm-bar,${M} .msn-cm-row:focus-within .msn-cm-bar{display:flex}
${M} .msn-pc{display:flex;flex-direction:column;gap:10px;margin:-12px}
${M} .msn-pc-bn{height:64px;flex:none;background:linear-gradient(120deg,var(--msg-brand),var(--msg-active))}
${M} .msn-pc-hd{display:flex;align-items:flex-end;gap:10px;margin:-38px 14px 0}
${M} .msn-pc-name{flex:1;min-width:0;padding:4px 8px;border:1px solid transparent;border-radius:var(--msn-radius);background:transparent;color:var(--msg-bright);font:inherit;font-size:18px;font-weight:700}
${M} .msn-pc-name:is(:hover,:focus){border-color:var(--msg-field-edge);background:var(--msg-input)}
${M} .msn-pc-note-in{box-sizing:border-box;margin:0 14px;padding:4px 8px;border:1px solid transparent;border-radius:var(--msn-radius);background:transparent;color:var(--msg-mute);font:inherit;font-size:13px}
${M} .msn-pc-note-in:is(:hover,:focus){border-color:var(--msg-field-edge);background:var(--msg-input)}
${M} .msn-pc-about{margin:0 14px;color:var(--msg-mute);font-size:13px}
${M} .msn-pc-chips,${M} .msn-pc-acts{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 14px}
${M} .msn-pc-sec{display:flex;flex-direction:column;gap:6px;margin:0 14px;padding-top:10px;border-top:1px solid var(--msg-divider)}
${M} .msn-pc-sec .msn-cap{margin:0}
${M} .msn-cm .msn-cap{margin:8px 6px 4px}
${M} .msn-pc-note{color:var(--msg-mute);font-size:12px}
${M} .msn-pc>.host-protected{align-self:flex-start;margin:0 14px 14px}
${M} .msn-pc>.msn-pc-acts:last-child{margin-bottom:14px}
${M} .msn-ci{display:flex;flex-direction:column;gap:8px;min-width:0}
${M} .msn-ci-b{min-width:0}
`;
