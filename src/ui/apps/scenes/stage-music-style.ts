/**
 * The Music tab and its mini player, drawn to RoleCall's measurements (MoodMusicWingPanel.tsx, MoodMusicMiniPlayer.tsx: Tailwind spacing
 * 4 = 16px, 3 = 12px, 2 = 8px, buttons h-9 w-9 = 36px, the tile h-14 w-14 = 56px) in the theme's tokens: RoleCall's zinc and white-alpha
 * greys become the stage tokens, its emerald accent is `--stage-ok`, its amber error is `--stage-warn`. Corners stay square, and the text
 * RoleCall sets at 10px or 11px is set at that size where the file knows it (the mini player, the counts); the rest is as measured.
 */
export const MUSIC_STYLE = `
.scs .mm{display:flex;flex-direction:column;flex:1;min-height:0;background:var(--stage-well);font-family:var(--font-body)}
.scs .mm-now{flex:none;border-bottom:1px solid var(--stage-seam);padding:16px}
.scs .mm-row{display:flex;align-items:flex-start;gap:12px}
.scs .mm-tile{flex:none;display:flex;align-items:center;justify-content:center;width:56px;height:56px;background:color-mix(in srgb,var(--stage-card) 4%,transparent);color:var(--stage-ok)}
.scs .mm-text{min-width:0;flex:1}
.scs .mm-title,.scs .mm-sub{margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scs .mm-title{font:500 var(--rc-text-sm)/20px var(--font-body);color:var(--stage-card)}
.scs .mm-sub{margin-top:2px;font:400 var(--rc-text-xs)/16px var(--font-body);color:var(--stage-mute)}
.scs .mm-err{margin:8px 0 0;font:400 var(--rc-text-xs)/16px var(--font-body);color:var(--stage-warn)}
.scs .mm-hint{margin:0;font:400 var(--rc-text-xs)/16px var(--font-body);color:var(--stage-mute)}
.scs .mm-bar{display:flex;align-items:center;gap:8px;margin-top:16px}
.scs .mm-vol{display:flex;min-width:0;flex:1;align-items:center;gap:8px;margin-left:8px;font:400 var(--rc-text-xs)/16px var(--font-body);color:var(--stage-mute)}
.scs .mm-vol>svg{flex:none}
.scs .mm-vol>:last-child{min-width:0;flex:1}
.scs .mm-add{flex:none;display:flex;flex-direction:column;gap:8px;border-bottom:1px solid var(--stage-seam);padding:16px}
.scs .mm-head{margin:0 0 4px;font:600 var(--rc-text-xs)/16px var(--font-body);letter-spacing:.1em;text-transform:uppercase;color:var(--stage-soft)}
.scs .mm-in{box-sizing:border-box;height:36px;width:100%;padding:0 12px;border:1px solid var(--stage-seam);background:var(--stage-sunken);color:var(--stage-card);font:400 var(--rc-text-xs)/16px var(--font-body);outline:none;border-radius:0}
.scs .mm-in::placeholder{color:var(--stage-mute)}
.scs .mm-in:focus{border-color:color-mix(in srgb,var(--stage-ok) 60%,transparent)}
.scs .mm-actions{display:flex;align-items:center;gap:8px}
.scs .mm-lib{min-height:0;flex:1;overflow-y:auto}
.scs .mm-lib>.mm-hint{padding:16px}
.scs .mm-cat{border-bottom:1px solid color-mix(in srgb,var(--stage-seam) 50%,transparent);padding:12px 16px}
.scs .mm-cat-hd{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
.scs .mm-cat-hd h3{min-width:0;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 var(--rc-text-xs)/16px var(--font-body);letter-spacing:.1em;text-transform:uppercase;color:var(--stage-soft)}
.scs .mm-cat-hd span{flex:none;font:400 var(--rc-text-10, 10px)/16px var(--font-body);color:var(--stage-mute)}
.scs .mm-list{display:flex;flex-direction:column;gap:4px}
.scs .mm-item{display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--stage-seam);background:color-mix(in srgb,var(--stage-card) 2%,transparent)}
.scs .mm-item.on{border-color:color-mix(in srgb,var(--stage-ok) 50%,transparent);background:color-mix(in srgb,var(--stage-ok) 10%,transparent)}
.scs .mm-item [data-control="row"]{flex:1;min-width:0;width:auto}
.scs .mm-mini-bar{display:flex;align-items:center;gap:12px;flex:none;height:48px;margin-bottom:8px;padding:0 12px;border-top:1px solid color-mix(in srgb,var(--stage-ok) 13%,transparent);background:color-mix(in srgb,var(--stage-black) 40%,transparent)}
.scs .mm-mini-tile{flex:none;display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:var(--stage-black);color:var(--stage-ok)}
.scs .mm-mini-text{min-width:0;flex:1}
.scs .mm-mini-text p{margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.25}
.scs .mm-mini-text p:first-child{font:500 var(--rc-text-xs)/15px var(--font-body);color:var(--stage-card)}
.scs .mm-mini-text p:last-child{font:400 var(--rc-text-11, 11px)/15px var(--font-body);color:var(--stage-mute)}
.scs .mm-mini-err{flex:none;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:400 var(--rc-text-10, 10px)/16px var(--font-body);color:var(--stage-warn)}
.scs .mm-mini-btns{display:flex;flex:none;align-items:center;gap:2px}
`;
