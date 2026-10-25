/** Edit history popover and the Undo toast (approved wireframe rc-port/scene-history.html). */
export const HISTORY_STYLE = `
.scs .acts .menu button:disabled{opacity:.4;cursor:default}
.scs .acts .menu .menu-rule{margin:4px 0;border:0;border-top:1px solid var(--stage-seam)}
.scs .acts .menu button.danger,.scs .acts .menu button.danger svg{color:var(--stage-danger-text)}
.scs .acts .menu button:disabled:hover{background:none}
.scs .acts .menu button .ct{margin-left:auto;font:var(--text-meta) var(--font-big);color:var(--stage-mute)}
.scs .histlist{position:absolute;bottom:calc(100% + 8px);right:-40px;z-index:61;width:22rem;max-width:calc(100cqw - 32px);max-height:26rem;display:flex;flex-direction:column;background:var(--stage-panel);border:3px solid var(--stage-black);box-shadow:5px 5px 0 0 var(--stage-black);font-family:var(--font-big);text-align:left}
.scs .histlist.below{bottom:auto;top:calc(100% + 8px)}
/* a message paints only inside its own box (content-visibility), which would clip a menu taller than a short message */
.scs .msg:has(.menu,.dd,.histlist){content-visibility:visible;z-index:30}
.scs .histlist header{display:flex;align-items:baseline;gap:8px;padding:8px 12px;border-bottom:1px solid var(--stage-seam)}
.scs .histlist header b{font:900 var(--text-control) var(--font-big);text-transform:uppercase;color:var(--stage-card)}
.scs .histlist header small{flex:1;color:var(--stage-mute);font-size:var(--text-meta)}
.scs .histlist .rows{overflow:auto}
.scs .histlist .row{display:flex;align-items:flex-start;gap:10px;padding:8px 12px;border-bottom:1px solid var(--stage-seam)}
.scs .histlist .row:last-child{border-bottom:0}
.scs .histlist .row .t{flex:1;min-width:0}
.scs .histlist .row .n{font-size:var(--text-meta);color:var(--stage-mute)}
.scs .histlist .row .p{font-size:var(--text-body);line-height:1.4;color:var(--stage-soft);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.scs .histlist .row.now{border-left:4px solid var(--accent);background:color-mix(in srgb,var(--accent) 8%,transparent)}
.scs .acts .histlist .row button{width:auto;height:24px;display:block;padding:0 10px;border:2px solid var(--stage-black);border-radius:0;box-shadow:2px 2px 0 0 var(--stage-black);background:var(--stage-faint);color:var(--stage-card);font:900 var(--text-meta) var(--font-big);text-transform:uppercase;cursor:pointer}
.scs .histlist footer{padding:8px 12px;border-top:1px solid var(--stage-seam);font-size:var(--text-meta);color:var(--stage-mute)}
.scs .histlist .none{padding:16px 12px;font-size:var(--text-body);color:var(--stage-mute)}
.scs .edittoast{position:absolute;top:56px;right:96px;z-index:70;display:flex;align-items:center;gap:12px;width:min(356px,calc(100% - 32px));padding:14px 16px;border:1px solid var(--stage-seam);background:var(--stage-black);color:var(--stage-card);font:var(--text-control) var(--font-big)}
.scs .edittoast .grow{flex:1}
.scs .edittoast button{height:24px;padding:0 8px;border:0;background:var(--stage-card);color:var(--stage-black);font:500 var(--text-meta) var(--font-big);cursor:pointer}
`;
