/** The Party panel, measured from RoleCall's classes (PartyWingPanel.tsx): the member card with its face, name and crown, the HP bar, the level row, and the Formation and Tactics boxes. Flat fills and square ends; every colour a theme token. */
export const PARTY_STYLE = `
.scs :is(span,b).cap{text-transform:capitalize}
.scs .pt-card{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);background:linear-gradient(135deg,color-mix(in srgb,var(--stage-card) 5%,transparent),transparent);border-radius:var(--rc-radius-sm)}
.scs .pt-card:hover{border-color:color-mix(in srgb,var(--w) 20%,transparent)}
.scs .pt-card.lead{border-color:color-mix(in srgb,var(--w) 30%,transparent);background:linear-gradient(135deg,color-mix(in srgb,var(--w) 15%,transparent),color-mix(in srgb,var(--w) 5%,transparent))}
.scs .pt-card header{display:flex;align-items:center;gap:12px}
.scs .pt-face{position:relative;display:grid;place-items:center;width:40px;height:40px;flex:none;border:2px solid color-mix(in srgb,var(--stage-card) 10%,transparent);background:var(--stage-panel);color:var(--stage-mute);border-radius:var(--rc-radius-sm)}
.scs .pt-face i{position:absolute;top:-4px;right:-4px;display:grid;place-items:center;padding:2px;background:var(--w);color:var(--stage-black)}
.scs .pt-who{flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.scs .pt-who b{font:600 var(--rc-text-sm)/1.4 var(--font-body);color:var(--stage-card)}
.scs .pt-who small{flex-basis:100%;font:400 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .pt-lead{padding:2px 6px;border:1px solid color-mix(in srgb,var(--w) 30%,transparent);background:color-mix(in srgb,var(--w) 20%,transparent);color:var(--w);font:700 var(--rc-text-xs)/1.4 var(--font-body);border-radius:var(--rc-radius-sm)}
.scs .pt-hp{display:flex;flex-direction:column;gap:8px}
.scs .pt-hp>div:first-child{display:flex;align-items:center;justify-content:space-between;font:500 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .pt-hp span{display:inline-flex;align-items:center;gap:8px}
.scs .pt-hp i,.scs .pt-level i{display:grid;place-items:center;padding:4px;background:color-mix(in srgb,var(--stage-danger-text) 20%,transparent);color:var(--stage-danger-text)}
.scs .pt-hp b{font:700 var(--rc-text-sm)/1.4 var(--font-mono);color:var(--stage-card)}
.scs .pt-hp small{color:var(--stage-mute);font-size:var(--rc-text-xs)}
.scs .pt-level{display:flex;align-items:center;gap:8px;padding-top:8px;border-top:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);font:400 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .pt-level i{background:color-mix(in srgb,var(--w) 20%,transparent);color:var(--w)}
.scs .pt-level b{color:var(--w)}
.scs .pt-box{display:flex;flex-direction:column;gap:12px;padding:16px;border:1px solid color-mix(in srgb,var(--w) 20%,transparent);background:linear-gradient(135deg,color-mix(in srgb,var(--w) 10%,transparent),transparent);border-radius:var(--rc-radius-sm)}
.scs .pt-box.plain{border-color:color-mix(in srgb,var(--stage-card) 10%,transparent);background:linear-gradient(135deg,color-mix(in srgb,var(--stage-card) 5%,transparent),transparent)}
.scs .pt-boxhead{display:flex;align-items:center;justify-content:space-between;font:600 var(--rc-text-sm)/1.4 var(--font-body);color:var(--stage-card)}
.scs .pt-boxhead span{display:inline-flex;align-items:center;gap:8px}
.scs .pt-boxhead i{display:grid;place-items:center;padding:6px;border:1px solid color-mix(in srgb,var(--w) 30%,transparent);background:color-mix(in srgb,var(--w) 20%,transparent);color:var(--w);border-radius:var(--rc-radius-sm)}
.scs .pt-box.plain .pt-boxhead i{border-color:color-mix(in srgb,var(--stage-card) 10%,transparent);background:color-mix(in srgb,var(--stage-panel) 50%,transparent);color:var(--stage-mute)}
.scs .pt-boxhead em{padding:4px 8px;border:1px solid color-mix(in srgb,var(--w) 30%,transparent);background:color-mix(in srgb,var(--w) 20%,transparent);color:var(--w);font:700 var(--rc-text-xs)/1.4 var(--font-body);font-style:normal;text-transform:capitalize;border-radius:var(--rc-radius-sm)}
.scs .pt-lane{display:flex;align-items:center;gap:12px;padding:8px;border:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);background:color-mix(in srgb,var(--stage-panel) 50%,transparent);border-radius:var(--rc-radius-sm)}
.scs .pt-lane>span{display:flex;align-items:center;gap:8px;width:80px;flex:none;font:500 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .pt-lane>div{flex:1;display:flex;flex-wrap:wrap;gap:6px}
.scs .pt-lane em{padding:6px 10px;border:1px solid color-mix(in srgb,var(--w) 30%,transparent);background:color-mix(in srgb,var(--w) 15%,transparent);color:var(--w);font:500 var(--rc-text-xs)/1.4 var(--font-body);font-style:normal;border-radius:var(--rc-radius-sm)}
.scs .pt-lane i{font:italic 400 var(--rc-text-xs)/1.4 var(--font-body);color:var(--stage-line)}
.scs .pt-row{display:flex;align-items:center;justify-content:space-between;padding:8px;background:color-mix(in srgb,var(--stage-panel) 50%,transparent);font:400 var(--rc-text-sm)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .pt-row b{font-weight:500;color:var(--stage-card)}
`;
