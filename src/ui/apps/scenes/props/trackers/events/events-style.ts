/** The Events panel, measured from RoleCall's classes (ParallelEventsWingPanel.tsx): the involved-character row and the outcome box. Flat fills and square ends; every colour a theme token. */
export const EVENTS_STYLE = `
.scs .it-ic:empty{display:none}
.scs .ev-npc{display:flex;align-items:center;gap:8px;padding:8px;border:1px solid color-mix(in srgb,var(--stage-line) 50%,transparent);background:color-mix(in srgb,var(--stage-black) 50%,transparent);color:var(--stage-mute);border-radius:var(--rc-radius-sm)}
.scs .ev-npc div{flex:1}
.scs .ev-npc b{display:block;font:500 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-soft)}
.scs .ev-npc small{display:block;font:400 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .ev-npc em{font:italic 400 var(--rc-text-xs)/1.4 var(--font-body)}
.scs .ev-out{padding:8px;border:1px solid color-mix(in srgb,var(--stage-var) 20%,transparent);background:color-mix(in srgb,var(--stage-var) 10%,transparent);border-radius:var(--rc-radius-sm)}
.scs .ev-out p{color:var(--stage-var)}
`;
