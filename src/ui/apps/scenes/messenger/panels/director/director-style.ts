/**
 * The Messenger Story Director's own styles (approved wireframe messenger-discord/panels.html section 4): the quiet subtitle line with its tools, the turn stepper and the overflow menu.
 * The tabs, cards, notes and settings are the Director's shared sheet (props/story-director/director-style.ts), which reads the stage tokens the Messenger root already points at its palette.
 * Rooted `:root .scs .msn` like messenger-style.ts, which mounts this sheet; colors are the layout's --msg-* palette.
 */
const M = ":root .scs .msn";

export const MSN_DIRECTOR_STYLE = `
${M} .msn-dr{padding:12px;gap:0}
${M} .msn-dr-bar{display:flex;align-items:center;gap:6px;min-height:32px}
${M} .msn-dr-sub{flex:1;min-width:0;color:var(--msg-mute);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${M} .msn-dr-tools{display:flex;align-items:center;gap:2px}
${M} .msn-dr-menu{position:absolute;top:calc(100% + 4px);right:0;z-index:130}
${M} .msn-dr-hist{display:flex;align-items:center;gap:6px;margin-top:8px;color:var(--msg-text);font-size:12px}
${M} .msn-dr-hist>span{min-width:6ch;padding:2px 10px;border-radius:var(--msn-radius);background:var(--msg-active);color:var(--msg-white);text-align:center}
${M} .msn-dr .dr-tabs{margin-top:12px}
${M} .msn-dr .dr-pane{padding:12px 0}
${M} .msn-dr .dr-card{border-radius:var(--msn-radius);border-color:var(--msg-edge);background:var(--msg-bar)}
${M} .msn-dr .dr-confirm,${M} .msn-dr .dr-note-line{border-radius:var(--msn-radius)}
${M} .msn-dr .dr-note-line{margin-top:8px}
${M} .msn-dr-settings{display:flex;flex-direction:column;gap:12px}
`;
