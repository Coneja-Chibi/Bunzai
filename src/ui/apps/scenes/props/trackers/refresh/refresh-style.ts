/**
 * Refresh from chat history: the strip button's label, the working line, RoleCall's click-through busy overlay, the review sheet's diff rows, and the Props wing's
 * "Refresh Enabled Boards" button, progress and combined sheet (the approved wireframe, tracker-refresh/refresh.html). Theme tokens only, square corners.
 */
export const REFRESH_STYLE = `
@keyframes rf-turn{to{transform:rotate(360deg)}}
.scs .rf-spin{display:inline-flex;animation:rf-turn 1s linear infinite}
@media (prefers-reduced-motion:reduce){.scs .rf-spin{animation:none}}
.scs .trk{position:relative}
.scs .trk-btn.lbl{grid-auto-flow:column;gap:6px;padding:6px 10px;font:700 var(--rc-text-sm)/1.4 var(--font-ui)}
.scs .trk-btn:disabled{opacity:.5;cursor:not-allowed}
.scs .trk-status{display:flex;align-items:center;gap:10px;padding:8px 16px;background:color-mix(in srgb,var(--w) 8%,var(--stage-panel));color:var(--stage-card);font:400 var(--rc-text-sm)/1.4 var(--font-body);border-bottom:1px solid var(--stage-seam)}
.scs .trk-status svg{color:var(--w)}
.scs .trk-status .grow,.scs .rf-fail .grow{flex:1;min-width:0}
.scs .trk-status button,.scs .rf-fail button{padding:2px 10px;border:1px solid var(--stage-line);background:var(--stage-black);color:var(--stage-card);font:700 var(--rc-text-xs)/1.4 var(--font-body);letter-spacing:.1em;text-transform:uppercase;cursor:pointer;border-radius:var(--rc-radius)}
.scs .rf-fail{display:flex;align-items:flex-start;gap:8px}
.scs .rf-fail small{display:block;margin-top:2px;color:var(--stage-soft);font:400 var(--rc-text-xs)/1.4 var(--font-body)}
.scs .rf-overlay{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--stage-black) 30%,transparent);backdrop-filter:blur(2px);pointer-events:none}
.scs .rf-overlay>div{display:flex;align-items:center;gap:10px;padding:8px 16px;border:1px solid var(--stage-line);background:color-mix(in srgb,var(--stage-panel) 90%,transparent);color:var(--stage-card);font:500 var(--text-body)/1.4 var(--font-body);border-radius:var(--rc-radius-sm)}
.scs .rf-overlay svg{color:var(--w)}
.rv{width:min(40rem,100%)}
.rv.wide{width:min(46rem,100%)}
.rv .bd{max-height:60vh;overflow:auto;gap:12px}
.rv .ft .rv-count{margin-right:auto;align-self:center;font:400 var(--rc-text-sm)/1.4 var(--font-body);color:var(--stage-mute)}
.rv .ft button:disabled{opacity:.5;cursor:not-allowed}
.rv .rv-help{font:400 var(--rc-text-xs)/1.45 var(--font-body);color:var(--stage-mute)}
.rv .rv-sec{--c:var(--stage-ok);display:flex;flex-direction:column;border:1px solid var(--stage-seam);border-radius:var(--rc-radius-sm)}
.rv .rv-sec.changed{--c:var(--stage-warn)}
.rv .rv-sec.removed{--c:var(--stage-danger-text)}
.rv .rv-sh{display:flex;align-items:center;gap:8px;padding:6px 10px;background:color-mix(in srgb,var(--c) 10%,transparent);box-shadow:inset 3px 0 0 var(--c);font:700 var(--rc-text-xs)/1.4 var(--font-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--c)}
.rv .rv-sh span{margin-left:auto;letter-spacing:.04em;text-transform:none;font-weight:500;color:var(--stage-mute)}
.rv .rv-row{display:flex;align-items:flex-start;gap:10px;padding:7px 10px;border-top:1px solid var(--stage-seam);font:400 var(--text-body)/1.4 var(--font-body);color:var(--stage-card);min-width:0}
.rv .rv-mk{flex:none;width:1.1rem;font:700 var(--text-body)/1.4 var(--font-mono);color:var(--c)}
.rv .rv-dt{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:3px;font:400 var(--rc-text-xs)/1.4 var(--font-mono);color:var(--stage-mute)}
.rv .rv-ch s{color:var(--stage-mute)}
.rv .rv-ch em{font-style:normal;color:var(--stage-card)}
.rv .rv-ch i{font-style:normal;color:var(--stage-soft)}
.rv .rv-skip{margin:0;padding:8px 10px;border-left:3px solid var(--stage-warn);background:color-mix(in srgb,var(--stage-warn) 10%,transparent);font:400 var(--rc-text-sm)/1.4 var(--font-body);color:var(--stage-card)}
.scs .rall{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:6px 12px;border:1px solid var(--w);background:color-mix(in srgb,var(--w) 10%,transparent);color:var(--stage-card);box-shadow:2px 2px 0 0 var(--stage-black);font:700 var(--rc-text-sm)/1.4 var(--font-ui);cursor:pointer;border-radius:var(--rc-radius)}
.scs .rall:hover:not(:disabled){filter:brightness(1.15)}
.scs .rall:disabled{opacity:.45;cursor:not-allowed;border-color:var(--stage-line);background:transparent}
.scs .rall-help{margin:6px 0 0;font:400 var(--rc-text-xs)/1.45 var(--font-body);color:var(--stage-mute)}
.scs .rall-prog{margin-top:8px;height:12px;border:2px solid var(--stage-line);background:var(--stage-seam);position:relative;border-radius:var(--rc-radius-full)}
.scs .rall-prog i{position:absolute;inset:0 auto 0 0;background:var(--w);border-right:2px solid var(--stage-black)}
.scs .rall-row{display:flex;align-items:center;gap:8px;margin-top:6px}
.scs .rall-row .rall-help{flex:1;margin:0}
.scs .rall-row button,.scs .rall-note button{padding:2px 10px;border:1px solid var(--stage-line);background:var(--stage-black);color:var(--stage-card);font:700 var(--rc-text-xs)/1.4 var(--font-body);letter-spacing:.1em;text-transform:uppercase;cursor:pointer;border-radius:var(--rc-radius)}
.scs .rall-note{display:flex;align-items:center;gap:8px;margin-top:8px;padding:8px 10px;border-left:3px solid var(--stage-link);background:color-mix(in srgb,var(--stage-link) 10%,transparent);font:400 var(--rc-text-sm)/1.4 var(--font-body);color:var(--stage-card)}
.scs .rall-note.bad{border-left-color:var(--stage-danger-text);background:var(--stage-danger-bg);color:var(--stage-danger-text)}
.scs .rall-note .grow{flex:1;min-width:0}
.scs .rall-note small{display:block;color:var(--stage-soft);font:400 var(--rc-text-xs)/1.4 var(--font-body)}
.rv .mods{display:flex;flex-direction:column;border:1px solid var(--stage-seam);border-radius:var(--rc-radius-sm)}
.rv .mod{border-bottom:1px solid var(--stage-seam)}
.rv .mod:last-child{border-bottom:0}
.rv .mod.fail{box-shadow:inset 3px 0 0 var(--stage-danger-text);background:color-mix(in srgb,var(--stage-danger-bg) 50%,transparent)}
.rv .mod.done{opacity:.6}
.rv .mh{display:flex;align-items:center;gap:10px;padding:9px 10px;min-width:0;flex-wrap:wrap}
.rv .mh b{font:700 var(--text-body)/1.4 var(--font-ui);color:var(--stage-card)}
.rv .mh .grow{flex:1;min-width:8rem;display:flex;gap:6px;flex-wrap:wrap;align-items:center;font:400 var(--rc-text-sm)/1.4 var(--font-body);color:var(--stage-mute)}
.rv .mh button{padding:4px 10px;border:2px solid var(--stage-black);box-shadow:2px 2px 0 0 var(--stage-black);font:900 var(--rc-text-sm)/1.2 var(--font-ui);text-transform:uppercase;background:var(--stage-faint);color:var(--stage-card);cursor:pointer;border-radius:var(--rc-radius)}
.rv .mh button.go{background:var(--accent);color:var(--stage-ink)}
.rv .mb{padding:0 10px 10px;display:flex;flex-direction:column;gap:8px}
.rv .rv-chip{padding:1px 8px;border:1px solid var(--c,var(--stage-line));color:var(--c,var(--stage-mute));font:700 var(--rc-text-xs)/1.4 var(--font-body);border-radius:var(--rc-radius-sm)}
.rv .rv-chip.ok{--c:var(--stage-ok)}.rv .rv-chip.warn{--c:var(--stage-warn)}.rv .rv-chip.bad{--c:var(--stage-danger-text)}
`;
