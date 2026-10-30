/**
 * The Dramaturg panel's styles (specs/stage/dramaturg.md, "Surface"): the scene's hero above a column that holds the model line, the
 * conversation log (your questions as quiet cards, the answers in the scene's prose on a raised ground with their reads above them in small
 * monospace), the answer being written with a pulsing edge, and the composer pinned under the log. The settings under the row reuse the
 * Director's `ds-*` block styles. Every colour is a theme token, so the panel follows Theater, Matinee or any palette.
 */
export const DRAMATURG_STYLE = `
.scs .dmg{display:flex;flex-direction:column;gap:12px;min-height:0;height:100%}
.scs .dmg>.hero{margin:0;flex:none}
.scs .dmg-model{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin:0;color:var(--stage-soft);font:var(--text-meta)/1.4 var(--font-mono)}
.scs .dmg-model span{color:var(--text-dim);font-family:var(--font-body)}
.scs .dmg-note{display:flex;align-items:center;gap:8px;margin:0;color:var(--text-dim);font:var(--text-control)/1.5 var(--font-body)}
.scs .dmg-note.bad{flex-direction:column;align-items:flex-start;color:var(--stage-danger-text)}
.scs .dmg-confirm{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--stage-warn);background:var(--stage-warn-ink);color:var(--stage-card);font:var(--text-control)/1.5 var(--font-body)}
.scs .dmg-confirm p{margin:0;flex:1 1 16rem}
.scs .dmg-log{flex:1 1 auto;min-height:12rem;overflow:auto;display:flex;flex-direction:column;gap:12px;padding-right:4px}
.scs .dmg-start{display:flex;flex-direction:column;gap:8px;color:var(--stage-soft);font:var(--text-control)/1.6 var(--font-body)}
.scs .dmg-start p{margin:0 0 4px}
.scs .dmg-q{align-self:flex-end;max-width:85%;padding:8px 12px;border:1px solid var(--stage-line);background:var(--stage-row);color:var(--stage-card)}
.scs .dmg-q b{display:block;margin-bottom:2px;color:var(--text-dim);font:700 var(--text-meta)/1 var(--font-body);letter-spacing:.12em;text-transform:uppercase}
.scs .dmg-q p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:var(--text-body)/1.5 var(--font-body)}
.scs .dmg-a{padding:10px 14px;border-left:2px solid var(--w);background:color-mix(in srgb,var(--stage-panel) 70%,transparent);color:var(--stage-card)}
.scs .dmg-a.bad{border-left-color:var(--stage-danger-edge)}
.scs .dmg-a.live{animation:dmg-pulse 1.6s ease-in-out infinite}
@keyframes dmg-pulse{50%{border-left-color:color-mix(in srgb,var(--w) 35%,transparent)}}
@media (prefers-reduced-motion:reduce){.scs .dmg-a.live{animation:none}}
.scs .dmg-reads{list-style:none;margin:0 0 8px;padding:0;display:flex;flex-direction:column;gap:2px;color:var(--text-dim);font:var(--text-meta)/1.4 var(--font-mono)}
.scs .dmg-reads li{display:flex;align-items:center;gap:6px;overflow-wrap:anywhere}
.scs .dmg-failed{display:flex;align-items:center;gap:6px;margin:8px 0 0;color:var(--stage-danger-text);font:var(--text-control)/1.4 var(--font-body)}
.scs .dmg-meta{display:block;margin-top:6px;color:var(--text-dim);font:var(--text-meta)/1 var(--font-mono)}
.scs .dmg-ask{flex:none;display:flex;gap:8px;align-items:stretch}
.scs .dmg-ask textarea{flex:1;min-width:0;resize:vertical;padding:8px 10px;border:1px solid var(--stage-line);background:var(--stage-sunken);color:var(--stage-card);font:var(--text-body)/1.5 var(--font-body)}
.scs .dmg-ask textarea:focus-visible{outline:2px solid var(--w);outline-offset:1px}
`;
