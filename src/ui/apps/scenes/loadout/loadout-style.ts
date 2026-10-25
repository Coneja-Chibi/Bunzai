/**
 * The loadout bar's styles. The bar and its banner sit inside the scene (`.scs`) on the stage tokens; the save, switcher and
 * review dialogs are portaled to the body, so their rules stand alone on the theme tokens (like the Character Library's).
 * Square corners, no shadows beyond the dialog's own.
 */
export const LOADOUT_STYLE = `
.scs .ldb{display:flex;flex-direction:column;gap:8px}
.scs .ldb-acts{display:flex;flex-wrap:wrap;gap:8px}
.scs .ldb-btn{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:6px 12px;border:1px solid var(--stage-seam);background:color-mix(in srgb,var(--stage-panel) 60%,transparent);color:var(--stage-soft);font:600 var(--text-control) var(--font-big);cursor:pointer}
.scs .ldb-btn:hover:not(:disabled){border-color:var(--w);color:var(--stage-card)}
.scs .ldb-btn:disabled{opacity:.5;cursor:not-allowed}
.scs .ldb-chip{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:6px 12px;border:1px solid var(--stage-ok);color:var(--stage-ok);font:600 var(--text-control) var(--font-big);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scs .ldb-banner{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border:1px solid var(--stage-ok);background:color-mix(in srgb,var(--stage-ok) 10%,transparent);font:var(--text-body) var(--font-big);color:var(--stage-soft)}
.scs .ldb-banner.partial{border-color:var(--stage-warn);background:color-mix(in srgb,var(--stage-warn) 10%,transparent)}
.scs .ldb-banner.failed{border-color:var(--stage-line);background:color-mix(in srgb,var(--stage-card) 5%,transparent)}
.scs .ldb-banner .pn{flex:1;min-width:0}
.scs .ldb-banner b{color:var(--stage-card)}
.scs .ldb-banner span{color:var(--stage-mute)}
.scs .ldb-banner p{margin:2px 0 0;font:var(--text-meta)/1.5 var(--font-big);color:var(--stage-mute)}
.ldd-sheet.ldd-sheet{max-width:32rem;max-height:calc(100vh - 2rem);display:flex;flex-direction:column}
.ldd{display:flex;flex-direction:column;gap:10px;min-height:0;color:var(--text)}
.ldd h2{margin:0;font:700 1.2rem var(--font-fancy)}
.ldd header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.ldd-x{flex:none;min-width:36px;min-height:36px;border:2px solid var(--edge);background:none;color:var(--text-dim);cursor:pointer}
.ldd-lbl{font:700 var(--text-meta) var(--font-big);letter-spacing:.16em;text-transform:uppercase;color:var(--text-dim)}
.ldd-note{margin:0;padding:6px 10px;border-left:4px solid var(--edge);background:var(--paper-2);font:var(--text-meta)/1.5 var(--font-big);color:var(--text-dim)}
.ldd-active{margin:6px 0 0;font:var(--text-meta) var(--font-mono);color:var(--text-dim)}
.ldd-modes{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ldd button:not(.ldd-x):not(.ldd-link){min-height:36px;padding:6px 14px;border:2px solid var(--edge);background:var(--paper-2);color:var(--text);font:700 var(--text-control) var(--font-big);cursor:pointer}
.ldd button.pri,.ldd-modes button[aria-pressed=true]{background:var(--action-primary);color:var(--action-primary-fg)}
.ldd button:disabled{background:var(--disabled-bg);color:var(--disabled-fg);cursor:not-allowed}
.ldd input[type=text],.ldd select{min-height:36px;padding:6px 10px;border:2px solid var(--edge);background:var(--paper-2);color:var(--text);font:var(--text-control) var(--font-body)}
.ldd-head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px;font:700 var(--text-meta) var(--font-big);letter-spacing:.12em;text-transform:uppercase;color:var(--text-dim)}
.ldd-link{border:0;background:none;padding:0;font:inherit;color:var(--link);text-decoration:underline;cursor:pointer}
.ldd-list{display:flex;flex-direction:column;gap:8px;overflow-y:auto;min-height:6rem}
.ldd-grp{margin:4px 0;font:700 var(--text-meta) var(--font-big);letter-spacing:.16em;text-transform:uppercase;color:var(--text-faint)}
.ldb-row{display:flex;align-items:center;gap:10px;min-height:44px;padding:4px 8px;cursor:pointer}
.ldb-row:hover{background:var(--paper-2)}
.ldb-row .pn,.ldd-item .pn{flex:1;min-width:0;display:flex;flex-direction:column}
.ldb-row small,.ldd-item small{font:var(--text-meta) var(--font-mono);color:var(--text-dim)}
.ldd-sum{max-width:40%;text-align:right;font:var(--text-meta) var(--font-big);letter-spacing:.06em;text-transform:uppercase;color:var(--text-dim)}
.ldd-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border:2px solid var(--edge);background:var(--paper-2)}
.ldd-item.on{border-color:var(--success)}
.ldd-quiet{margin:0;padding:12px;font:var(--text-body) var(--font-big);color:var(--text-dim)}
.ldd-err{margin:0;padding:6px 10px;border-left:4px solid var(--danger);background:var(--paper-2);font:var(--text-control) var(--font-big);color:var(--text)}
.ldd footer{display:flex;justify-content:flex-end;gap:8px}
.ldr-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.ldr-metrics>div{padding:8px 10px;border:2px solid var(--edge);background:var(--paper-2)}
.ldr-metrics small{display:block;font:700 var(--text-meta) var(--font-big);letter-spacing:.12em;text-transform:uppercase;color:var(--text-dim)}
.ldr-metrics b{font:700 1.2rem var(--font-big)}
.ldr-rows{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px}
.ldr-rows li{display:flex;justify-content:space-between;gap:12px;padding:4px 8px;border-bottom:1px solid var(--seam);font:var(--text-control) var(--font-big)}
.ldr-rows span{color:var(--text-dim)}
`;
