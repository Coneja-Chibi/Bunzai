/** The Cycles panel, measured from RoleCall's classes (BiologicalCyclesWingPanel.tsx): the labelled bars under a card, the fertility window and the pregnancy rows. Flat fills and square ends; every colour a theme token. */
export const CYCLES_STYLE = `
.scs .cy-under{display:flex;flex-direction:column;gap:6px}
.scs .cy-phase{display:flex;justify-content:space-between;font:400 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .cy-phase b{font-weight:500;color:var(--stage-card)}
.scs .cy-bar{display:flex;flex-direction:column;gap:4px}
.scs .cy-bar>div:first-child{display:flex;align-items:center;justify-content:space-between;font:400 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .cy-row{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.scs .cy-row small,.scs .it-box small{display:block;font:400 var(--rc-text-xs)/1.5 var(--font-body);color:var(--stage-soft)}
.scs .cy-window{display:flex;height:6px;background:var(--stage-black);border-radius:var(--rc-radius-full)}
.scs .cy-window i{background:color-mix(in srgb,var(--stage-danger-text) 20%,transparent)}
.scs .cy-window b{width:2%;background:var(--stage-danger-text)}
.scs .cy-list{margin:0;padding-left:16px;font:400 var(--rc-text-xs)/1.5 var(--font-body);color:var(--stage-soft)}
.scs .bd-bar.thin{height:4px;border-radius:var(--rc-radius-full)}
`;
