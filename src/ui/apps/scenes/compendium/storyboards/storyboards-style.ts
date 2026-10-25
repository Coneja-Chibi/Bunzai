/**
 * The Storyboards tab, to RoleCall's measurements (DossierHub.module.css, DossierStatTile, AIContextPanel.module.css): a health strip, a tile per dossier,
 * the stat row, view tabs, cards and the AI Context panel. Flat fills and square ends for RoleCall's glows and rounded bars; every colour a theme
 * token, set per element through --c; type sizes and fonts are DossierHub's own (labels in JetBrains Mono, values in Cinzel).
 */
export const STORYBOARDS_STYLE = `
.scs .sb{display:flex;flex-direction:column;gap:12px}
.scs .sb-health{display:flex;gap:24px;padding:8px 12px;border:1px solid var(--stage-line);background:color-mix(in srgb,var(--stage-black) 40%,transparent)}
.scs .sb-health span{display:block;font:700 .58rem/1.4 var(--font-mono);letter-spacing:.18em;text-transform:uppercase;color:var(--stage-mute)}
.scs .sb-health strong{font:700 .7rem/1.4 var(--font-mono);color:var(--stage-soft);text-transform:capitalize}
.scs .sb-health strong.good{color:var(--stage-ok)}
.scs .sb-pick{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px}
.scs .sb-pick button{padding:10px 12px;border:1px solid var(--stage-line);background:var(--stage-panel);text-align:left;cursor:pointer}
.scs .sb-pick button.on{border-color:var(--stage-ok);box-shadow:4px 4px 0 color-mix(in srgb,var(--stage-ok) 35%,transparent)}
.scs .sb-pick small{display:block;font:700 .6rem/1.4 var(--font-ui);letter-spacing:.14em;text-transform:uppercase;color:var(--stage-mute)}
.scs .sb-pick b{font:700 var(--text-control)/1.4 var(--font-ui);letter-spacing:.1em;text-transform:uppercase}
.scs .sb-panel{display:flex;flex-direction:column;gap:12px}
.scs .sb-stats{display:grid;gap:8px}
.scs .sb-stat{padding:10px 12px;border:1px solid var(--stage-line);background:var(--stage-panel)}
.scs .sb-stat small{display:block;font:700 .6rem/1.4 var(--font-ui);letter-spacing:.18em;text-transform:uppercase;color:var(--c)}
.scs .sb-stat b{font:700 1.55rem/1.2 var(--font-fancy);letter-spacing:.02em;color:var(--c)}
.scs .sb-tabs{display:flex;gap:2px;border-bottom:1px solid var(--stage-line)}
.scs .sb-tabs button{padding:8px 14px;border:0;border-bottom:2px solid transparent;background:none;color:var(--stage-mute);font:600 .78rem/1.4 var(--font-ui);letter-spacing:.06em;cursor:pointer}
.scs .sb-tabs button.on{color:var(--stage-card);border-bottom-color:var(--stage-ok)}
.scs .sb-tabs small{margin-left:6px;color:var(--stage-mute);font:400 .62rem var(--font-mono);letter-spacing:.08em}
.scs .sb-split{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px}
@container (max-width:760px){.scs .sb-split{grid-template-columns:minmax(0,1fr)}}
.scs .sb-sec{margin-bottom:16px}
.scs .sb-sec h4{margin:0 0 8px;font:700 .7rem/1.4 var(--font-ui);letter-spacing:.2em;text-transform:uppercase;color:var(--c)}
.scs .sb-sec h4 i{font-style:normal;font-weight:400;letter-spacing:.1em;color:var(--stage-mute)}
.scs .sb-card{display:flex;flex-direction:column;gap:8px;margin-bottom:8px;padding:12px;border:1px solid var(--stage-line);background:var(--stage-panel);cursor:pointer}
.scs .sb-card:hover{border-color:color-mix(in srgb,var(--stage-card) 25%,transparent)}
.scs .sb-card header{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.scs .sb-card header b{flex:1;min-width:0;font:700 var(--text-control)/1.4 var(--font-ui);color:var(--stage-card)}
.scs .sb-card p{margin:0;font:400 var(--text-control)/1.5 var(--font-ui);color:var(--stage-soft)}
.scs .sb-chip{padding:1px 6px;border:1px solid var(--stage-line);font:700 .66rem/1.4 var(--font-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--stage-mute)}
.scs .sb-facts{display:flex;flex-wrap:wrap;gap:12px;font:400 .7rem/1.4 var(--font-mono);color:var(--stage-mute)}
.scs .sb-objs{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px;font:400 var(--text-control)/1.4 var(--font-ui);color:var(--stage-soft)}
.scs .sb-objs i{display:inline-block;width:18px;font-style:normal;color:var(--stage-mute)}
.scs .sb-objs li[data-status="done"]{color:var(--stage-mute);text-decoration:line-through}
.scs .sb-objs li[data-status="done"] i{color:var(--stage-ok)}
.scs .sb-objs li[data-status="failed"] i,.scs .sb-objs li[data-status="blocked"] i{color:var(--stage-danger-text)}
.scs .sb-links{display:flex;flex-wrap:wrap;gap:4px}
.scs .sb-meter{display:grid;grid-template-columns:96px minmax(0,1fr) 40px;align-items:center;gap:8px;font:400 .7rem/1.4 var(--font-mono);color:var(--stage-mute)}
.scs .sb-meter em{font-style:normal;text-align:right;font-family:var(--font-mono);color:var(--stage-soft)}
.scs .sb-track{height:8px;border:1px solid var(--stage-line);background:var(--stage-black)}
.scs .sb-track div{height:100%;background:var(--c)}
.scs .sb-empty,.scs .sb-note{margin:0;padding:12px 0;font:400 var(--text-control)/1.5 var(--font-ui);color:var(--stage-mute)}
.scs .sb-ai{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--stage-line);background:color-mix(in srgb,var(--stage-black) 40%,transparent)}
.scs .sb-ai-head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px}
.scs .sb-ai-title{font:700 .66rem/1.4 var(--font-ui);letter-spacing:.18em;text-transform:uppercase;color:var(--stage-soft)}
.scs .sb-ai-pills{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.scs .sb-ai-pills button,.scs .sb-ai-pills select{padding:3px 10px;border:1px solid var(--stage-line);background:var(--stage-black);color:var(--stage-soft);font:700 .62rem/1.4 var(--font-ui);letter-spacing:.14em;text-transform:uppercase;cursor:pointer}
.scs .sb-ai-pills button.on{border-color:var(--stage-ok);color:var(--stage-ok)}
.scs .sb-ai-pills button.off{border-color:var(--stage-danger-edge);color:var(--stage-danger-text)}
.scs .sb-ai-text{margin:0;max-height:240px;overflow:auto;white-space:pre-wrap;font:400 .78rem/1.5 var(--font-mono);color:var(--stage-soft)}
.scs .sb-mark{color:var(--stage-warn)}
.scs .sb-slug{color:var(--stage-link)}
.scs .sb-ai-foot{display:flex;justify-content:space-between;font:400 .7rem/1.4 var(--font-mono);color:var(--stage-mute)}
`;
