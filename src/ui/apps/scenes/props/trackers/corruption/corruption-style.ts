/** The Corruption panel, measured from RoleCall's classes (CorruptionWingPanel.tsx): the overall state, a metric with its -5 and +5 buttons and threshold marks, the NPC card, the history rows. Flat fills and square ends; every colour a theme token. */
export const CORRUPTION_STYLE = `
.scs .cr-over{flex-direction:column;align-items:stretch;gap:8px}
.scs .cr-state{display:flex;align-items:center;justify-content:space-between}
.scs .cr-state small{font:500 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .cr-state b{font:700 var(--rc-text-sm)/1.4 var(--font-body);letter-spacing:.06em}
.scs .cr-metric{display:flex;flex-direction:column;gap:6px}
.scs .cr-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font:500 var(--rc-text-sm)/1.4 var(--font-body);color:var(--stage-soft)}
.scs .cr-head>span{display:inline-flex;align-items:center;gap:8px}
.scs .cr-head i{display:grid;place-items:center}
.scs .cr-metric.small .cr-head{font-size:var(--rc-text-xs);color:var(--stage-mute)}
.scs .cr-step{padding:2px 6px;border:0;font:400 var(--rc-text-xs)/1.4 var(--font-body);cursor:pointer;border-radius:var(--rc-radius-sm)}
.scs .cr-step.down{background:color-mix(in srgb,var(--stage-ok) 20%,transparent);color:var(--stage-ok)}
.scs .cr-step.up{background:color-mix(in srgb,var(--stage-danger-text) 20%,transparent);color:var(--stage-danger-text)}
.scs .cr-val{min-width:2rem;text-align:right;font:700 var(--rc-text-sm)/1.4 var(--font-body)}
.scs .cr-bar{position:relative;height:8px;border:1px solid color-mix(in srgb,var(--stage-line) 50%,transparent);background:color-mix(in srgb,var(--stage-black) 50%,transparent);overflow:hidden;border-radius:var(--rc-radius-full)}
.scs .cr-bar.thin{height:4px;border-radius:var(--rc-radius-full)}
.scs .cr-bar div{height:100%;transition:width .3s;border-radius:var(--rc-radius-full)}
.scs .cr-bar u{position:absolute;top:0;bottom:0;width:1px;background:var(--stage-card);text-decoration:none}
.scs .cr-npc{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid color-mix(in srgb,var(--stage-line) 50%,transparent);background:color-mix(in srgb,var(--stage-panel) 40%,transparent);border-radius:var(--rc-radius-sm)}
.scs .cr-npchead{display:flex;align-items:center;justify-content:space-between;color:var(--stage-macro)}
.scs .cr-npchead span{display:inline-flex;align-items:center;gap:8px}
.scs .cr-npchead b{font:700 var(--rc-text-sm)/1.4 var(--font-body);color:var(--stage-card)}
.scs .cr-log{display:flex;align-items:flex-start;gap:8px;padding:10px;border:1px solid color-mix(in srgb,var(--stage-line) 50%,transparent);background:color-mix(in srgb,var(--stage-panel) 40%,transparent);border-radius:var(--rc-radius-sm)}
.scs .cr-log>span{display:grid;place-items:center;padding:4px}
.scs .cr-log>span.up{background:color-mix(in srgb,var(--stage-danger-text) 20%,transparent);color:var(--stage-danger-text)}
.scs .cr-log>span.down{background:color-mix(in srgb,var(--stage-ok) 20%,transparent);color:var(--stage-ok)}
.scs .cr-log b{font:500 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-soft)}
.scs .cr-log b.up{color:var(--stage-danger-text)}
.scs .cr-log b.down{color:var(--stage-ok)}
.scs .cr-log small{display:block;font:400 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-mute)}
`;
