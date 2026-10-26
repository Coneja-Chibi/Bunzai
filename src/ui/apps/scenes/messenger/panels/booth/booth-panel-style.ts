/**
 * The Control Booth side panel's style (approved wireframe messenger-discord/panels.html section 6a). The rows are the Full Chat Booth's own modules, so this sheet only re-points the
 * Booth's palette (RoleCall's zinc scale and type steps) at the layout's --msg-* tokens and sets the panel's rhythm: sections as quiet Discord setting groups. Rooted `:root .scs .msn`
 * like messenger-style.ts, which mounts this sheet. Nothing here styles the `button` element.
 */
const M = ":root .scs .msn .msn-bth";

export const BOOTH_PANEL_STYLE = `
${M}{--rc-zinc-950:var(--msg-rail);--rc-zinc-900:var(--msg-bar);--rc-zinc-800:var(--msg-divider);--rc-zinc-700:var(--msg-field-edge);--rc-zinc-600:var(--msg-modal-edge);--rc-zinc-500:var(--msg-faint);--rc-zinc-400:var(--msg-faint);--rc-zinc-300:var(--msg-mute);--rc-zinc-200:var(--msg-text);
--rc-radius:var(--msn-radius);--rc-radius-sm:var(--msn-radius);--rc-text-8:12px;--rc-text-9:12px;--rc-text-10:12px;--rc-text-11:12px;--rc-text-sm:14px;--rc-text-wing:13px;--font-ui:var(--font-body);--w:var(--msg-brand);--w-soft:color-mix(in srgb,var(--msg-brand) 14%,transparent);--stage-card:var(--msg-bright);
display:flex;flex-direction:column;gap:4px;padding:4px 0 20px;color:var(--msg-text)}
${M} .bth-sec{margin-top:12px;padding:0 14px}
${M} .bth-sec h3{margin:0 0 8px;color:var(--msg-mute);font:700 12px/1.4 var(--font-body);letter-spacing:.04em}
${M} .bth-sec[data-part="scene.booth.context"]{margin-top:4px}
${M} .bth-nums{padding:8px 0}
${M} .bth-nums b{color:var(--msg-bright)}
${M} .bth-bar i{background:var(--bar)}
${M} .bth-row,${M} .bth-fb,${M} .bth-sec .prop-row,${M} .bth-nav{border-radius:var(--msn-radius);border-color:var(--msg-divider);background:var(--msg-bar)}
${M} .bth-sec .prop-row:has(.tg.on){border-color:var(--msg-divider);background:var(--msg-bar)}
${M} .bth-sec .prop-row:has(.tg.on) :is(b,.prop-ic){color:var(--msg-bright)}
${M} .bth-sec .prop-row+.prop-row{margin-top:6px}
${M} .bth-nav{margin:12px 14px 0;padding:14px;border-color:var(--msg-divider);background:var(--msg-bar)}
${M} .bth-nav>b{color:var(--msg-bright)}
${M} .bth-portrait{width:56px;height:56px;margin-bottom:8px;border-color:var(--msg-divider);box-shadow:none}
${M} .bth-tag{border-radius:var(--msn-radius);background:var(--msg-side)}
${M} .bth-drop{border-radius:var(--msn-radius);background:var(--msg-rail);border-color:var(--msg-modal-edge);box-shadow:0 8px 28px var(--msg-shadow)}
${M} .bth-grp .grp-hd{background:var(--msg-rail)}
${M} .bth-note{margin:12px 14px 0;border-left-color:var(--msg-field-edge);background:var(--msg-bar);color:var(--msg-mute);border-radius:var(--msn-radius)}
${M} .bth-sec>.bth-note{margin:8px 0 0}
${M} .bth-note.warn{border-left-color:var(--stage-warn);color:var(--msg-text)}
${M} .msn-bth-open{padding:0 14px;margin-top:2px}
`;
