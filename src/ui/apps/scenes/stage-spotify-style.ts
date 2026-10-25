/**
 * The Spotify tab and its mini player, to RoleCall's measurements (SpotifyWingPanel.tsx, SpotifyMiniPlayer.tsx: 160px art, 4px progress
 * bar, 36px skip buttons, 48px play button, 48px mini bar) in the theme's tokens: RoleCall's Spotify green is `--stage-ok`, its white
 * alphas are the stage greys, its glows and blurs are dropped for the house's crisp edges, and its 10px and 11px text stands where the file knows it. The mini bar
 * reuses the Music mini player's frame (`mm-mini-bar`, stage-music-style.ts).
 */
export const SPOTIFY_STYLE = `
.scs .spot{display:flex;flex-direction:column;flex:1;min-height:0;overflow-y:auto;background:var(--stage-well);font-family:var(--font-body)}
.scs .sp-info{flex:none;display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--stage-seam);font:600 16px/24px var(--font-body);color:var(--stage-card)}
.scs .sp-dot{width:8px;height:8px;border-radius:50%;background:var(--stage-seam)}
.scs .sp-dot.live{background:var(--stage-ok)}
.scs .sp-pill{padding:2px 6px;border:1px solid color-mix(in srgb,var(--stage-ok) 25%,transparent);background:color-mix(in srgb,var(--stage-ok) 8%,transparent);color:var(--stage-ok);font:500 var(--rc-text-10, 10px)/16px var(--font-body)}
.scs .sp-note,.scs .sp-err{margin:0;padding:8px 16px;font:400 var(--rc-text-xs)/16px var(--font-body)}
.scs .sp-note{color:var(--stage-mute)}
.scs .sp-err{color:var(--stage-warn)}
.scs .sp-body{flex:1}
.scs .sp-now{display:flex;flex-direction:column;align-items:center;gap:12px;padding:20px 16px 16px}
.scs .sp-art{width:160px;height:160px;object-fit:cover;box-shadow:4px 4px 0 var(--stage-black)}
.scs .sp-art.none{display:flex;align-items:center;justify-content:center;background:var(--stage-row);color:var(--stage-mute)}
.scs .sp-names{width:100%;text-align:center}
.scs .sp-track,.scs .sp-artists{margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scs .sp-track{font:500 16px/24px var(--font-body);color:var(--stage-card)}
.scs .sp-artists{margin-top:2px;font:400 var(--rc-text-sm)/20px var(--font-body);color:var(--stage-soft)}
.scs .sp-prog{width:100%;display:flex;flex-direction:column;gap:4px}
.scs .sp-bar{position:relative;width:100%;height:4px;background:var(--stage-seam);cursor:pointer}
.scs .sp-fill{height:100%;background:var(--stage-ok);transition:width .3s}
.scs .sp-clock{display:flex;justify-content:space-between;font:400 var(--rc-text-11, 11px)/16px var(--font-body);color:var(--stage-mute)}
.scs .sp-controls{display:flex;flex-direction:column;gap:12px;padding:0 16px 16px}
.scs .sp-btns{display:flex;align-items:center;justify-content:center;gap:16px}
.scs .sp-sq{display:flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0;border:0;background:none;color:var(--stage-soft);cursor:pointer;border-radius:0}
.scs .sp-sq:hover{background:color-mix(in srgb,var(--stage-card) 10%,transparent);color:var(--stage-card)}
.scs .sp-play{display:flex;align-items:center;justify-content:center;width:48px;height:48px;padding:0;border:0;background:var(--stage-ok);color:var(--stage-black);cursor:pointer;border-radius:0}
.scs .sp-vol{display:flex;align-items:center;gap:10px;color:var(--stage-mute)}
.scs .sp-vol>svg{flex:none}
.scs .sp-vol>:last-child{min-width:0;flex:1}
.scs .sp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:64px 24px;text-align:center}
.scs .sp-empty p{margin:0;font:400 var(--rc-text-sm)/20px var(--font-body);color:var(--stage-mute)}
.scs .sp-empty p.sp-fine{font-size:var(--rc-text-xs);line-height:16px}
.scs .sp-disc{display:flex;align-items:center;justify-content:center;width:64px;height:64px;background:color-mix(in srgb,var(--stage-ok) 9%,transparent);color:var(--stage-ok)}
.scs .sp-sec{display:flex;width:100%;align-items:center;justify-content:space-between;padding:8px 16px;border:0;border-top:1px solid color-mix(in srgb,var(--stage-seam) 50%,transparent);background:none;color:var(--stage-mute);font:500 var(--rc-text-xs)/16px var(--font-body);letter-spacing:.05em;text-transform:uppercase;cursor:pointer;border-radius:0}
.scs .sp-sec:hover{background:color-mix(in srgb,var(--stage-card) 5%,transparent)}
.scs .sp-chev{display:flex;transition:transform .2s}
.scs .sp-chev.open{transform:rotate(180deg)}
.scs .sp-devices{display:flex;flex-direction:column;gap:4px;padding:8px 16px}
.scs .sp-refresh{display:flex;justify-content:flex-end;margin-bottom:4px}
.scs .sp-refresh button{display:flex;align-items:center;gap:6px;padding:0;border:0;background:none;color:var(--stage-mute);font:400 var(--rc-text-xs)/16px var(--font-body);cursor:pointer}
.scs .sp-refresh button:hover{color:var(--stage-soft)}
.scs .sp-none{margin:0;padding:16px 0;text-align:center;font:400 var(--rc-text-xs)/16px var(--font-body);color:var(--stage-mute)}
.scs .sp-device{display:flex;width:100%;align-items:center;gap:12px;padding:8px 12px;border:0;background:none;color:var(--stage-mute);cursor:pointer;text-align:left;border-radius:0}
.scs .sp-device:hover{background:color-mix(in srgb,var(--stage-card) 5%,transparent)}
.scs .sp-device.on{background:color-mix(in srgb,var(--stage-ok) 8%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--stage-ok) 19%,transparent);color:var(--stage-ok)}
.scs .sp-dname{min-width:0;flex:1}
.scs .sp-dname b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:500 var(--rc-text-xs)/16px var(--font-body);color:var(--stage-soft)}
.scs .sp-device.on .sp-dname b{color:var(--stage-ok)}
.scs .sp-dname small{display:block;font:400 var(--rc-text-10, 10px)/16px var(--font-body);color:var(--stage-mute);text-transform:capitalize}
.scs .sp-mini-art{flex:none;display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:var(--stage-row);color:var(--stage-mute);overflow:hidden}
.scs .sp-mini-art img{width:100%;height:100%;object-fit:cover}
.scs .sp-mini .mm-mini-text .sp-mini-none{font-style:italic;color:var(--stage-mute)}
.scs .mm-mini-btns button:disabled{cursor:not-allowed;opacity:.3}
`;
