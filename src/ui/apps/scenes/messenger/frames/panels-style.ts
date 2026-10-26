/**
 * The Messenger panel frames' styles (approved wireframe messenger-discord/panels.html sections 0-1 and the shell.html context menu): the docked side panel, the floating popout,
 * the pointer-placed context menu and the header panel switcher. Colors are the layout's own --msg-* palette; --msn-radius is the Messenger-only corner token, defined on the
 * Messenger root so a theme can still override it. Rooted `:root .scs .msn` like messenger-style.ts, which mounts this sheet. Buttons are the button family's own; nothing here styles `button`.
 */
const M = ":root .scs .msn";

export const PANELS_STYLE = `
${M}{--msn-radius:8px}
${M} .msn-pnl{display:flex;flex-direction:column;flex:none;min-width:0;min-height:0;width:360px;max-width:100%;background:var(--msg-side);border-left:1px solid var(--msg-edge);color:var(--msg-text)}
${M} .msn-pnl[data-width="wide"]{width:640px}
${M} .msn-pnl-h{display:flex;align-items:center;gap:6px;flex:none;min-height:48px;padding:0 8px 0 14px;border-bottom:1px solid var(--msg-edge)}
${M} .msn-pnl-t{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.25}
${M} .msn-pnl-t strong{color:var(--msg-bright);font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${M} .msn-pnl-t small{color:var(--msg-mute);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${M} .msn-pnl-b{flex:1;min-height:0;overflow:auto;padding:12px;scrollbar-width:thin}
${M} .msn-pop{position:fixed;z-index:120;display:flex;flex-direction:column;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);background:var(--msg-side);border:1px solid var(--msg-modal-edge);border-radius:var(--msn-radius);box-shadow:0 12px 40px var(--msg-shadow);color:var(--msg-text);overflow:hidden}
${M} .msn-pop-h{display:flex;align-items:center;gap:6px;flex:none;min-height:44px;padding:0 6px 0 14px;border-bottom:1px solid var(--msg-edge);cursor:grab;touch-action:none;user-select:none}
${M} .msn-pop-h[data-dragging="true"]{cursor:grabbing}
${M} .msn-pop-h strong{flex:1;min-width:0;color:var(--msg-bright);font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${M} .msn-pop-b{flex:1;min-height:0;overflow:auto;padding:12px}
${M} .msn-ctx{position:fixed;z-index:130}
${M} .msn-menu-wrap{position:relative}
${M} .msn-menu{display:flex;flex-direction:column;width:260px;max-width:calc(100vw - 16px);padding:4px;background:var(--msg-rail);border:1px solid var(--msg-modal-edge);border-radius:var(--msn-radius);box-shadow:0 8px 28px var(--msg-shadow);color:var(--msg-text)}
${M} .msn-menu [data-control="menuitem"]:not([data-tone="danger"]){color:var(--msg-text);border-radius:4px}
${M} .msn-menu [data-control="menuitem"]:is(:hover,:focus-visible){background:var(--msg-brand);color:var(--msg-white)}
${M} .msn-menu-sep{height:1px;margin:4px 6px;background:var(--msg-divider)}
${M} .msn-menu-sub{position:absolute;left:100%;bottom:0;margin-left:2px}
${M} .msn-sw{position:relative;display:flex;align-items:center;gap:4px}
${M} .msn-sw-pins{display:flex;align-items:center;gap:4px}
${M} .msn-sw-sep{width:1px;height:22px;margin:0 4px;background:var(--msg-divider)}
${M} .msn-sw-menu{position:absolute;top:calc(100% + 6px);right:0;z-index:130;display:flex;flex-direction:column;width:340px;max-width:calc(100vw - 16px);background:var(--msg-rail);border:1px solid var(--msg-modal-edge);border-radius:var(--msn-radius);box-shadow:0 8px 28px var(--msg-shadow)}
${M} .msn-sw-search{display:flex;align-items:center;gap:8px;margin:8px;padding:0 8px;min-height:32px;border:1px solid var(--msg-field-edge);border-radius:var(--msn-radius);background:var(--msg-side);color:var(--msg-mute)}
${M} .msn-sw-search input{flex:1;min-width:0;border:0;background:transparent;outline:0;color:var(--msg-text);font:inherit}
${M} .msn-sw-search:focus-within{outline:2px solid var(--msg-focus);outline-offset:1px}
${M} .msn-sw-list{width:auto;max-height:min(60vh,520px);overflow-y:auto;border:0;box-shadow:none;background:transparent;scrollbar-width:thin}
${M} .msn-sw-grp{padding:8px 10px 4px;color:var(--msg-faint);font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
${M} .msn-sw-row{display:flex;align-items:center;gap:2px}
${M} .msn-sw-row>[data-control="menuitem"]{flex:1;min-width:0}
${M} .msn-sw-row[data-open="true"]>[data-control="menuitem"]{box-shadow:inset 3px 0 0 var(--msg-brand)}
${M} .msn-sw-row [data-part="scene.messenger.panel.star"]{flex:none;color:var(--msg-faint)}
${M} .msn-sw-row [data-part="scene.messenger.panel.star"][aria-checked="true"]{color:var(--msg-brand)}
${M} .msn-sw-row [data-part="scene.messenger.panel.star"][aria-checked="true"] svg{fill:currentColor}
${M} .msn-sw-row [data-part="scene.messenger.panel.star"]:focus-visible{outline:2px solid var(--msg-focus);outline-offset:-2px}
${M} .msn-sw-none{margin:0;padding:12px;color:var(--msg-mute);font-size:13px}
${M} .msn-sw [aria-pressed="true"]{background:var(--msg-active);color:var(--msg-white);box-shadow:inset 0 -2px 0 var(--msg-brand)}
@container (max-width:1023px){
${M} .msn-pnl{position:absolute;inset:var(--msg-head-h) 0 0 0;width:auto;z-index:60;border-left:0}
${M} .msn-pnl[data-width="wide"]{width:auto}
}
`;
