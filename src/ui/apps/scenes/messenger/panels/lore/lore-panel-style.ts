/**
 * The Messenger Lorebooks panel's styles (approved wireframe messenger-discord/panels.html section 3): the entries list, the book manager and the entry inspector. The root also wears the
 * Full Chat wing's `wl` class, because the editor parts the inspector places (keyword boxes, injection picker, side effects, filter) take their colors from `.scs .wl` and `.scs .wl-e`;
 * the rules here only lay them out in the Messenger's grammar and pull the wing's own frame off the root. Colors are the --msg-* palette, corners are --msn-radius, rooted like messenger-style.ts.
 * The inspector is drawn in the docked slot; while it is open the Side panel widens to the Wide size with `:has`, so the one program shows both shapes without a second program.
 */
const M = ":root .scs .msn";

export const LORE_PANEL_STYLE = `
${M} .msn-pnl:has(.msn-lore[data-view="entry"]){width:640px}
${M} .msn-pnl-b:has(.msn-lore){padding:0}
${M} .msn-lore{--wa:var(--msg-brand);--wl-k:var(--msg-rail);flex:none;position:relative;display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;background:var(--msg-side);border:0;color:var(--msg-text)}
${M} .msn-lore-top{display:flex;align-items:center;gap:8px;flex:none;min-height:44px;padding:6px 12px;border-bottom:1px solid var(--msg-edge)}
${M} .msn-lore-top>.t{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.25}
${M} .msn-lore-top>.t b{color:var(--msg-bright);font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${M} .msn-lore-top>.t small{color:var(--msg-mute);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${M} .msn-lore-top .tgl{display:inline-flex;align-items:center;gap:6px;color:var(--msg-mute);font-size:12px}
${M} .msn-lore-main{flex:1;min-height:0;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px;scrollbar-width:thin}
${M} .msn-lore-foot{display:flex;align-items:center;gap:8px;flex:none;padding:8px 12px;border-top:1px solid var(--msg-edge);color:var(--msg-mute);font-size:12px}
${M} .msn-lore-foot .grow{flex:1}
${M} .msn-lore-foot .sv{display:inline-flex;align-items:center;gap:4px;color:var(--msg-faint)}
${M} .msn-lore-find{display:flex;align-items:center;gap:8px;padding:0 8px;min-height:34px;border:1px solid var(--msg-field-edge);border-radius:var(--msn-radius);background:var(--msg-rail);color:var(--msg-mute)}
${M} .msn-lore-find input{flex:1;min-width:0;border:0;background:transparent;outline:0;color:var(--msg-text);font:inherit}
${M} .msn-lore-books{display:flex;flex-wrap:wrap;gap:6px}
${M} .msn-lore-sc{display:flex;align-items:center;gap:8px;margin-top:4px;color:var(--msg-mute);font:700 12px/1.4 var(--font-body);letter-spacing:.02em;text-transform:uppercase}
${M} .msn-lore-sc .n{font-weight:500;color:var(--msg-faint)}
${M} .msn-lore-sc .grow{flex:1}
${M} .msn-lore-tag{display:inline-flex;align-items:center;padding:0 8px;min-height:20px;border-radius:var(--msn-radius);background:var(--msg-pill);color:var(--msg-pill-text);font:600 11px/20px var(--font-body);text-transform:none;letter-spacing:0;white-space:nowrap}
${M} .msn-lore-fire{color:var(--msg-mute);font-size:12px;max-width:14ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${M} .msn-lore-tag[data-tone="ok"]{background:color-mix(in srgb,var(--bk-role-ok) 18%,transparent);color:var(--bk-role-ok-text)}
${M} .msn-lore-vl{position:relative;flex:none}
${M} .msn-lore-vl>.vr{position:absolute;top:0;left:0;right:0}
${M} .msn-lore-rw{position:relative;display:flex;align-items:center;gap:8px;padding:2px 4px;border-radius:var(--msn-radius)}
${M} .msn-lore-rw:hover,${M} .msn-lore-rw:focus-within{background:var(--msg-hover)}
${M} .msn-lore-rw[data-off]>[data-control="row"]{opacity:.55}
${M} .msn-lore-rw>[data-control="row"]{flex:1;min-width:0}
${M} .msn-lore-rw .mt{display:inline-flex;align-items:center;gap:8px;color:var(--msg-faint);font-size:12px}
${M} .msn-lore-rw .hbar{position:absolute;right:6px;top:50%;transform:translateY(-50%);display:none;align-items:center;gap:2px;padding:2px;border-radius:var(--msn-radius);background:var(--msg-active);box-shadow:0 2px 8px var(--msg-shadow)}
${M} .msn-lore-rw:is(:hover,:focus-within) .hbar{display:flex}
@media (hover:none){${M} .msn-lore-rw .hbar{position:static;transform:none;display:flex;background:transparent;box-shadow:none}}
${M} .msn-lore-empty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 10px;text-align:center;color:var(--msg-mute);font-size:13px}
${M} .msn-lore-empty b{color:var(--msg-bright);font-size:14px}
${M} .msn-lore-note{display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border:1px solid var(--bk-role-danger);border-radius:var(--msn-radius);background:color-mix(in srgb,var(--bk-role-danger) 12%,transparent);color:var(--msg-text);font-size:13px}
${M} .msn-lore-note>div{flex:1;min-width:0}
${M} .msn-lore-acts{display:flex;gap:8px;margin-top:6px}
${M} .msn-lore-ar{display:flex;align-items:center;gap:6px;padding:2px 4px}
${M} .msn-lore-ar .av{display:grid;place-items:center;width:32px;height:32px;flex:none;border-radius:50%;background:var(--msg-brand);color:var(--msg-white);font:700 12px var(--font-body)}
${M} .msn-lore-ar>[data-control="row"]{flex:1;min-width:0}
${M} .msn-lore-ar[data-off]>[data-control="row"]{opacity:.55}
${M} .msn-lore-new{display:flex;gap:8px;align-items:center}
${M} .msn-lore-new input{flex:1;min-width:0;min-height:34px;padding:0 10px;border:1px solid var(--msg-field-edge);border-radius:var(--msn-radius);background:var(--msg-rail);color:var(--msg-text);font:inherit}
${M} .msn-lore .wl-lib{display:flex;flex-direction:column;gap:6px;min-height:0}
${M} .msn-lore .wl-lib .scroll{max-height:240px;overflow-y:auto}
${M} .msn-lore .wl-ls label{display:flex;align-items:center;gap:8px;padding:0 8px;min-height:34px;border:1px solid var(--msg-field-edge);border-radius:var(--msn-radius);background:var(--msg-rail);color:var(--msg-mute)}
${M} .msn-lore .wl-ls input{flex:1;min-width:0;border:0;background:transparent;outline:0;color:var(--msg-text);font:inherit}
${M} .msn-lore .wl-lh{margin:6px 4px 2px;color:var(--msg-mute);font:700 12px/1.4 var(--font-body);text-transform:uppercase}
${M} .msn-lore .wl-none{display:flex;flex-direction:column;align-items:center;padding:12px;text-align:center;color:var(--msg-mute);font-size:13px}
${M} .msn-lore-ins{--w3:color-mix(in srgb,var(--msg-bright) 4%,transparent);display:flex;flex-direction:column;gap:10px;flex:none;min-height:0;height:auto;overflow:visible;border:0;background:none;border-radius:0}
${M} .msn-lore-ins .wl-ec{padding:0;overflow:visible}
${M} .msn-lore-tabs{flex:none;padding:0 12px;border-bottom:1px solid var(--msg-edge)}
${M} .msn-lore-fld{display:flex;flex-direction:column;gap:4px;min-width:0}
${M} .msn-lore-fld>.lbl{color:var(--msg-mute);font:700 11px/1.4 var(--font-body);letter-spacing:.04em;text-transform:uppercase}
${M} .msn-lore-fld>.hint,${M} .msn-lore-card .hint{color:var(--msg-faint);font-size:12px}
${M} .msn-lore-fld input[type="text"]{min-height:34px;padding:0 10px;border:1px solid var(--msg-field-edge);border-radius:var(--msn-radius);background:var(--msg-rail);color:var(--msg-text);font:inherit}
${M} .msn-lore-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
${M} .msn-lore-three{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
${M} .msn-lore-fld .wl-num{width:100%;min-height:34px;padding:0 10px;border:1px solid var(--msg-field-edge);border-radius:var(--msn-radius);background:var(--msg-rail);color:var(--msg-text);text-align:left;font:inherit}
${M} .msn-lore-fld .wl-ta{height:200px;min-height:140px;border-color:var(--msg-field-edge);border-radius:var(--msn-radius);background:var(--msg-rail);color:var(--msg-text)}
${M} .msn-lore-fld .wl-mac{margin-top:4px}
${M} .msn-lore-set{display:flex;align-items:center;gap:12px;padding:8px 10px;border:1px solid var(--msg-divider);border-radius:var(--msn-radius)}
${M} .msn-lore-set>.tx{flex:1;min-width:0;display:flex;flex-direction:column}
${M} .msn-lore-set>.tx b{color:var(--msg-bright);font-size:14px}
${M} .msn-lore-set>.tx .d{color:var(--msg-mute);font-size:12px}
${M} .msn-lore-card{display:flex;flex-direction:column;gap:8px;padding:10px 12px;border:1px solid var(--msg-divider);border-radius:var(--msn-radius);background:var(--msg-chat)}
${M} .msn-lore-card>h4{margin:0;color:var(--msg-bright);font:700 13px/1.4 var(--font-body)}
${M} .msn-lore-card .wl-fx{margin-top:0;padding-top:0;border-top:0}
${M} .msn-lore-card .grp{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
${M} .msn-lore-logic{display:flex;flex-direction:column;gap:4px}
@container (max-width:1199px){
${M} .msn-pnl:has(.msn-lore[data-view="entry"]){position:absolute;inset:var(--msg-head-h) 0 0 0;width:auto;z-index:60;border-left:0}
}
@container (max-width:640px){
${M} .msn-lore-two,${M} .msn-lore-three{grid-template-columns:1fr}
}
`;
