/** The Bonds panel, measured from RoleCall's classes (BondsWingPanel.tsx): the intensity bar, the roles grid and the effect and drawback rows. Flat fills and square ends; every colour a theme token. */
export const BONDS_STYLE = `
.scs .bd-bar{height:6px;border:1px solid color-mix(in srgb,var(--stage-line) 50%,transparent);background:color-mix(in srgb,var(--stage-black) 50%,transparent);overflow:hidden;border-radius:var(--rc-radius-full)}
.scs .bd-bar div{height:100%;transition:width .3s;border-radius:var(--rc-radius-full)}
.scs .bd-roles{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.scs .bd-roles small{display:block;font:400 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .bd-roles b{font:500 var(--rc-text-sm)/1.4 var(--font-body);color:var(--stage-soft)}
.scs .bd-eff{display:flex;align-items:flex-start;gap:8px;margin-top:4px;padding:8px;border:1px solid color-mix(in srgb,var(--c) 20%,transparent);background:color-mix(in srgb,var(--c) 10%,transparent);color:var(--c);font:400 var(--rc-text-xs)/1.4 var(--font-body);border-radius:var(--rc-radius-sm)}
.scs .bd-eff.good{--c:var(--stage-ok)}
.scs .bd-eff.bad{--c:var(--stage-danger-text)}
.scs .it-quiet{font-style:italic;color:var(--stage-mute)}
`;
