/**
 * The Compendium Settings tab's look (RoleCall `CompendiumSettings.tsx`, its screenshot `rc-world-comp-settings.png`): a header with an eyebrow,
 * a display title and an Essentials / Advanced switch, then section cards with a dot, an uppercase title and a blurb, and RoleCall's four
 * controls (switch, stepper, segmented row, select). Sizes and fonts are RoleCall's own (Inter labels, Cinzel titles);
 * every colour is a theme token, no glass. The accent is the scene's (`--w`).
 */
export const COMPENDIUM_SETTINGS_STYLE = `
.scs .cps{--cpa:var(--w,var(--stage-card));display:flex;flex-direction:column;gap:16px;padding:20px;container-type:inline-size;color:var(--stage-text-dim)}
.scs .cps-hd{padding-bottom:16px;border-bottom:1px solid color-mix(in srgb,var(--cpa) 20%,transparent)}
.scs .cps-eb{font:700 11px var(--font-ui);letter-spacing:.2em;text-transform:uppercase;color:var(--cpa)}
.scs .cps-hd h1{margin:6px 0 0;font:900 1.5rem/1.2 var(--font-fancy);text-transform:uppercase;color:var(--stage-card);text-shadow:3px 3px 0 var(--stage-black)}
.scs .cps-hd p{max-width:42rem;margin:8px 0 0;font:14px/1.625 var(--font-ui);color:var(--stage-soft)}
.scs .cps-sec{padding:20px;border:3px solid var(--stage-black);background:var(--stage-panel);box-shadow:3px 3px 0 0 var(--stage-black)}
.scs .cps-sec>h3{display:flex;align-items:center;gap:8px;margin:0 0 4px;font:700 11px var(--font-fancy);letter-spacing:.2em;text-transform:uppercase;color:var(--stage-card)}
.scs .cps-sec>h3 i{width:6px;height:6px;background:var(--dot,var(--cpa))}
.scs .cps-sec>p{max-width:42rem;margin:0 0 16px;font:13px/1.625 var(--font-ui);color:var(--stage-soft)}
.scs .cps-body{display:flex;flex-direction:column;gap:16px}
.scs .cps-lab{display:block;margin-bottom:4px;font:700 11px var(--font-ui);letter-spacing:.14em;text-transform:uppercase;color:var(--stage-card)}
.scs .cps-hint{margin:0 0 8px;font:13px/1.625 var(--font-ui);color:var(--stage-soft)}
.scs .cps-tg{display:flex;align-items:flex-start;gap:12px}
.scs .cps-tg>div{flex:1}
.scs .cps-tg .cps-hint{margin:4px 0 0}
.scs .cps-sw{position:relative;width:36px;height:20px;flex:none;margin-top:2px;border:0;border-radius:var(--rc-radius-full);background:var(--stage-seam);cursor:pointer;transition:background .15s}
.scs .cps-sw i{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:var(--rc-radius-full);background:var(--stage-card);transition:left .15s}
.scs .cps-sw.on{background:var(--cpa)}
.scs .cps-sw.on i{left:18px;background:var(--stage-card)}
.scs .cps-step{display:flex;align-items:center;gap:8px}
.scs .cps-step output{flex:1;padding:6px 0;text-align:center;border:2px solid var(--stage-black);background:var(--stage-row);font:var(--text-control) var(--font-mono);color:var(--stage-card)}
.scs .cps-seg{display:block}
.scs .cps-in,.scs .cps-ta,.scs .cps-sel{display:block;width:100%;box-sizing:border-box;padding:8px 12px;border:2px solid var(--stage-black);background:var(--stage-row);color:var(--stage-card);font:var(--text-control) var(--font-ui);outline:none}
.scs .cps-ta{min-height:96px;resize:vertical;line-height:1.6}
.scs .cps-in:focus,.scs .cps-ta:focus,.scs .cps-sel:focus{border-color:var(--cpa)}
.scs .cps-box{display:flex;flex-direction:column;gap:12px;padding:12px;border:2px solid var(--stage-black);background:var(--stage-row)}
.scs .cps-box .cps-ta,.scs .cps-box .cps-sel{background:var(--stage-well)}
.scs .cps-book{padding:12px;border:2px solid var(--stage-black);background:var(--stage-row)}
.scs .cps-bk{display:flex;align-items:center;justify-content:space-between;gap:12px}
.scs .cps-bk>span{display:flex;align-items:center;gap:8px;min-width:0}
.scs .cps-bk b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 var(--text-control) var(--font-ui);color:var(--stage-card)}
.scs .cps-bk em{font:11px var(--font-mono);font-style:normal;color:var(--stage-mute)}
.scs .cps-book .cps-seg{margin-top:12px}
.scs .cps-make{display:flex;flex-direction:column;align-items:flex-start;gap:6px}
.scs .cps-note{margin:0;font:700 11px var(--font-ui);color:var(--stage-warn)}
`;
