/** The Creature Codex panel, measured from RoleCall's classes (CreatureCodexWingPanel.tsx): the taxonomy lines, the coloured sections, the ability rows, the stat grid and the bond and trust bars. Flat fills and square ends; every colour a theme token. */
export const CODEX_STYLE = `
.scs .cx-tax{display:flex;flex-direction:column;gap:2px}
.scs .cx-tax small{font:500 var(--rc-text-xs)/1.4 var(--font-body);letter-spacing:.12em;text-transform:uppercase;color:var(--stage-mute)}
.scs .cx-tax b{font:600 var(--rc-text-sm)/1.4 var(--font-body);color:var(--stage-card)}
.scs .cx-tax em{font-style:italic}
.scs .cx-sec{display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid color-mix(in srgb,var(--c) 20%,transparent);background:color-mix(in srgb,var(--c) 5%,transparent);border-radius:var(--rc-radius-sm)}
.scs .cx-sechead{display:flex;align-items:center;gap:8px;color:var(--c)}
.scs .cx-sechead b{font:700 var(--rc-text-xs)/1.4 var(--font-body);text-transform:uppercase}
.scs .cx-sec small{display:block;font:400 var(--rc-text-xs)/1.5 var(--font-body);color:var(--stage-soft)}
.scs .cx-aside{margin-left:auto;color:var(--stage-mute)}
.scs .cx-item{display:flex;flex-direction:column;gap:4px;padding:6px 8px;background:color-mix(in srgb,var(--stage-black) 40%,transparent)}
.scs .cx-item>div:first-child{display:flex;align-items:center;gap:8px}
.scs .cx-item b{font:600 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-card)}
.scs .cx-item p{margin:0;font:400 var(--rc-text-xs)/1.5 var(--font-body);color:var(--stage-soft)}
.scs .cx-need{display:flex;align-items:center;gap:8px}
.scs .cx-need span{width:72px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:400 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .cx-need .bd-bar{flex:1}
.scs .cx-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.scs .cx-stats div{padding:4px 6px;background:color-mix(in srgb,var(--stage-black) 40%,transparent)}
.scs .cx-stats small{text-transform:uppercase;letter-spacing:.08em;color:var(--stage-mute)}
.scs .cx-stats b{font:700 var(--rc-text-sm)/1.4 var(--font-mono);color:var(--stage-card)}
.scs .cx-bt{display:flex;gap:12px}
.scs .cx-bt>div{flex:1;display:flex;flex-direction:column;gap:2px}
.scs .cx-bt small{font:400 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-mute)}
`;
