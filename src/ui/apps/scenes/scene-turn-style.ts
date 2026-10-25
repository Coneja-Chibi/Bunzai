/**
 * The scene's turn controls and AI wing, from the approved wireframes rc-port/scene-turn.html (send,
 * stop, the Starting chip, the live bubble, the meta row and SwipeCounter (on every message, with the time
 * and finish reason: rc-port/scene-meta.html), the failure and "scene
 * changed" cards, the cut-off line, no connection) and rc-port/scene-ai-wing.html (the model picker).
 */
export const TURN_STYLE = `
.scs .starting{display:inline-flex;align-items:center;gap:8px;padding:12px 16px;margin:0 0 16px 272px;background:var(--stage-panel);font-size: var(--text-body);color:var(--stage-text-dim)}
.scs .starting svg{animation:scs-spin 1s linear infinite}
.scs .bub.live{border-color:color-mix(in srgb,var(--tone) 35%,transparent);box-shadow:0 0 20px color-mix(in srgb,var(--tone) 12%,transparent),0 0 40px color-mix(in srgb,var(--tone) 6%,transparent)}
.scs .caret{display:inline-block;width:8px;height:17px;margin-left:2px;vertical-align:-3px;background:var(--tone);animation:scs-pulse 1s steps(2) infinite}
.scs .meta{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:8px;padding:0 4px;flex-wrap:wrap;opacity:0;transition:opacity .3s}
.scs .msg:hover .meta,.scs .msg.last .meta,.scs .meta:focus-within{opacity:1}
.scs .meta .mdl{font-size: var(--text-meta);color:var(--stage-mute);opacity:.7}
.scs .meta .ts{font-size: var(--text-meta);color:var(--stage-mute);opacity:.7}
.scs .fin{font-family:var(--font-mono);font-size:var(--text-meta);font-weight:600;padding:2px 6px;line-height:1;border-radius:0}
.scs .fin.ok{color:var(--stage-mute);background:color-mix(in srgb,var(--stage-mute) 10%,transparent)}
.scs .fin.info{color:var(--stage-soft);background:color-mix(in srgb,var(--stage-soft) 12%,transparent)}
.scs .fin.warn{color:var(--stage-warn);background:color-mix(in srgb,var(--stage-warn) 12%,transparent)}
.scs .fin.err{color:var(--stage-danger-text);background:color-mix(in srgb,var(--stage-danger-text) 12%,transparent)}
.scs .swc{display:inline-flex;align-items:center;gap:2px;padding:2px 4px;font-size:12px;border-radius:0;border:1px solid color-mix(in srgb,var(--stage-card) 8%,transparent);background:color-mix(in srgb,var(--stage-black) 55%,transparent);backdrop-filter:blur(4px)}
.scs .swc.new{background:color-mix(in srgb,var(--tone) 15%,transparent);border-color:color-mix(in srgb,var(--tone) 40%,transparent);box-shadow:0 0 10px color-mix(in srgb,var(--tone) 15%,transparent)}
.scs .swc button{width:24px;height:24px;display:grid;place-items:center;border:0;border-radius:0;background:none;color:var(--stage-soft);cursor:pointer}
.scs .swc button:hover{color:var(--stage-card);background:color-mix(in srgb,var(--stage-card) 10%,transparent)}
.scs .swc button:disabled{color:var(--stage-line);cursor:not-allowed;background:none}
.scs .swc .ct{display:flex;align-items:center;gap:6px;padding:2px 8px;user-select:none}
.scs .swc .n{font-weight:600;color:var(--tone);font-variant-numeric:tabular-nums}
.scs .swc .sl{color:var(--stage-mute)}
.scs .swc .t{color:color-mix(in srgb,var(--tone) 80%,transparent);font-variant-numeric:tabular-nums}
.scs .swc .nw{margin-left:2px;padding:2px 6px;font-size: var(--text-meta);font-weight:600;letter-spacing:.08em;text-transform:uppercase;border-radius:0;background:var(--tone-fill,var(--tone));color:var(--stage-ink)}
.scs .acts .gen:disabled{color:var(--stage-line);cursor:not-allowed}
.scs .cutoff{display:flex;align-items:center;gap:12px;margin-top:10px;padding:8px 12px;border-left:4px solid var(--stage-warn);background:color-mix(in srgb,var(--stage-warn) 10%,transparent);font:var(--text-body)/1.5rem var(--font-big);color:var(--stage-card)}
.scs .cutoff svg{color:var(--stage-warn);flex:none}
.scs .cutoff .grow{flex:1}
.scs .cutoff small{color:var(--stage-mute);font-size:12px}
.scs .cutoff button{padding:4px 10px;border:2px solid var(--stage-black);box-shadow:3px 3px 0 0 var(--stage-black);background:var(--stage-faint);color:var(--stage-card);font: 900 var(--text-control) var(--font-big);text-transform:uppercase;cursor:pointer}
.scs .cap .stop{width:32px;height:32px;flex:none;display:grid;place-items:center;border-radius:0;border:0;background:var(--stage-danger-hot);color:var(--stage-card);cursor:pointer}
.scs .cap.off .send:disabled{opacity:.55}
.scs .cap .hint{flex:none;align-self:center;font-size: var(--text-body);color:var(--bk-scene-accent-text,var(--bk-role-brand-text));text-decoration:underline;text-underline-offset:3px;cursor:pointer;background:none;border:0}
.scs .fail{position:absolute;left:50%;transform:translateX(-50%);bottom:90px;width:min(880px,calc(100% - 96px));z-index:41;background:var(--stage-panel);border-top:2px solid var(--stage-danger-edge);box-shadow:0 8px 32px var(--shadow-ink)}
.scs .fail.held{border-top-color:var(--stage-warn)}
.scs .fail .top{display:flex;align-items:center;gap:16px;padding:16px 24px;border-bottom:1px solid var(--stage-seam)}
.scs .fail .ic{width:48px;height:48px;display:grid;place-items:center;background:var(--stage-danger-bg);border:1px solid var(--stage-danger-edge);color:var(--stage-danger-text);flex:none}
.scs .fail .ic.warn{background:color-mix(in srgb,var(--stage-warn) 12%,transparent);border-color:var(--stage-warn);color:var(--stage-warn)}
.scs .fail .tt{font-weight:600;font-size: var(--text-body);color:var(--stage-card)}
.scs .fail .ln{display:flex;align-items:center;gap:8px;margin-top:6px;font-size: var(--text-body);color:var(--stage-text-dim);flex-wrap:wrap}
.scs .fail code{font-family:var(--font-mono);font-size: var(--text-body);padding:2px 8px;background:var(--stage-danger-bg);color:var(--stage-danger-text)}
.scs .fail .dis{margin-left:auto;padding:10px 16px;border:1px solid var(--stage-line);background:var(--stage-row);color:var(--stage-card);font: var(--text-body) var(--font-big);white-space:nowrap;cursor:pointer}
.scs .fail .dis+.dis{margin-left:8px}
.scs .fail .dis.go{background:var(--accent);border-color:var(--accent);color:var(--stage-ink)}
.scs .fail .dr{padding:16px 16px 12px;font-size: var(--text-body);color:var(--stage-soft)}
.scs .fail textarea{display:block;margin-top:10px;width:100%;height:110px;background:var(--stage-well);color:var(--stage-card);border:1px solid var(--stage-line);padding:8px 10px;font: var(--text-body)/1.6 var(--font-big);resize:vertical}
.scs .fail .nb{margin-top:8px;font-size: var(--text-body);color:var(--stage-mute)}
.scs .ms-note .retry{margin-left:6px;padding:0;border:0;background:none;font:inherit;font-weight:600;text-decoration:underline;color:var(--w);cursor:pointer}
@container (max-width:1023px){
.scs .starting{margin-left:100px}
.scs .meta{opacity:1}.scs .meta .mdl{display:none}
.scs .fail{width:calc(100% - 24px)}
}
`;
