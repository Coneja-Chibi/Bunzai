/**
 * The World wing's chrome and the Compendium's shell (RoleCall `FoldoutTabs`, `CompendiumWingPanel.tsx:891-1234`): the
 * wide world panel (RoleCall `getLeftPanelWidth`, `left-world` 1258px), the two cards over the body, the hero, the tab strip,
 * the book bar and the access chip. Sizes are RoleCall's own. Colours are
 * roles: RoleCall's amber world accent is `--wa` (the scene accent), so a theme and the accent still apply. Every class is
 * `cp-` prefixed; the wing shares one scene stylesheet. Layout answers to the pane (`@container`), never the viewport.
 */
export const COMPENDIUM_SHELL_STYLE = `
.scs .wfold{display:flex;flex-direction:column;gap:12px;padding:12px 16px}
.scs .wfold .tabs{margin-top:0;gap:8px}
.scs .wfold .tabs button{min-height:56px;display:flex;flex-direction:column;justify-content:center;padding:8px 12px}
.scs .wfold .tabs b{font-size:12px;letter-spacing:.1em}
.scs .wfold .tabs small{margin-top:4px;font-size:10px;letter-spacing:.025em;text-transform:uppercase;opacity:.6}
.scs .wtab{flex:1;min-height:0;display:flex;flex-direction:column}
.scs .wtab[hidden]{display:none}
.scs .cp{--wa:var(--bk-scene-accent-text,var(--bk-role-brand-text));--wa-soft:color-mix(in srgb,var(--wa) 12%,transparent);--wa-line:color-mix(in srgb,var(--wa) 35%,transparent);--cp-k:var(--stage-black);--cp-card:var(--stage-panel);--cp-sunk:var(--stage-sunken);--cp-mute:var(--stage-mute);--cp-text:var(--stage-card);--cp-soft:var(--stage-soft);--cp-info:var(--bk-role-info-text);--cp-rule:color-mix(in srgb,var(--stage-card) 10%,transparent);flex:1;min-height:0;display:flex;flex-direction:column;overflow-y:auto;container-type:size;background:var(--stage-well);color:var(--stage-soft);font-family:var(--font-ui);scrollbar-width:thin;scrollbar-color:var(--stage-line) transparent}
.scs .cp :where(button,input){font:inherit}
.scs .cp-hero-w{flex:none;padding:20px 20px 0}
.scs .cp-hero{position:relative;display:flex;gap:16px;align-items:flex-start;padding:24px;border:1px solid var(--wa-line);background:radial-gradient(ellipse at top left,var(--wa-soft),transparent 55%),linear-gradient(135deg,color-mix(in srgb,var(--stage-panel) 90%,transparent),var(--stage-well));box-shadow:6px 6px 0 0 var(--wa-soft)}
.scs .cp-hero .ico{width:48px;height:48px;flex:none;display:grid;place-items:center;border:2px solid color-mix(in srgb,var(--wa) 70%,transparent);background:var(--cp-k);color:var(--wa)}
.scs .cp-hero .eb{font:700 .74rem var(--font-ui);letter-spacing:.24em;text-transform:uppercase;color:var(--wa)}
.scs .cp-hero h2{margin:8px 0 0;font:900 2rem/.95 var(--font-fancy);letter-spacing:.05em;text-transform:uppercase;color:var(--cp-text);text-shadow:3px 3px 0 var(--stage-black)}
.scs .cp-hero h2 em{font-style:normal;color:var(--wa)}
.scs .cp-hero p{margin:10px 0 0;max-width:42rem;font-size:.95rem;line-height:1.625;color:var(--cp-text)}
.scs .cp-tabs{flex:none;display:flex;margin-top:20px;border-bottom:1px solid var(--wa-line);background:var(--cp-k)}
.scs .cp-tabs button{display:flex;align-items:center;gap:8px;padding:10px 16px;border:0;border-bottom:2px solid transparent;background:none;color:var(--cp-soft);font:700 11px var(--font-fancy);letter-spacing:.2em;text-transform:uppercase;cursor:pointer;transition:color .15s}
.scs .cp-tabs button:hover{color:var(--wa)}
.scs .cp-tabs button.on{color:var(--wa);border-bottom-color:var(--wa);background:var(--wa-soft)}
.scs .cp-tabsel{display:none}
@container (max-width:511px){.scs .cp-tabs{display:none}.scs .cp-tabsel{display:block;flex:none;margin-top:20px;padding:8px 16px;border-bottom:1px solid var(--wa-line);background:var(--cp-k)}.scs .cp-tabsel select{width:100%;padding:8px;border:1px solid var(--wa-line);background:var(--cp-k);color:var(--wa);font:700 11px var(--font-fancy);letter-spacing:.2em;text-transform:uppercase}}
.scs .cp-bar{flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 16px;border-bottom:1px solid color-mix(in srgb,var(--wa) 20%,transparent);background:var(--stage-sunken)}
.scs .cp-bk{position:relative;flex:1;min-width:0}
.scs .cp-bk>button,.scs .cp-bk>div.cur{display:flex;align-items:center;gap:8px;max-width:100%;padding:0;border:0;background:none;text-align:left;cursor:pointer}
.scs .cp-bk>div.cur{cursor:default}
.scs .cp-bk .lb{font:700 11px var(--font-fancy);letter-spacing:.2em;text-transform:uppercase;color:var(--cp-soft)}
.scs .cp-bk .nm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 14px var(--font-ui);color:var(--wa)}
.scs .cp-bk .pick{position:absolute;top:100%;left:0;z-index:5;width:320px;max-height:384px;overflow-y:auto;margin-top:4px;border:1px solid var(--wa-line);border-radius:var(--rc-radius-sm);background:var(--stage-well);box-shadow:0 8px 24px color-mix(in srgb,var(--stage-black) 60%,transparent)}
.scs .cp-bk .pick button{display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px;border:0;border-bottom:1px solid var(--cp-rule);background:none;text-align:left;cursor:pointer;color:var(--cp-text);font-size:14px}
.scs .cp-bk .pick button:hover,.scs .cp-bk .pick button.on{background:var(--wa-soft)}
.scs .cp-chip{flex:none;display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border:1px solid color-mix(in srgb,var(--wa) 50%,transparent);border-radius:var(--rc-radius-sm);background:var(--wa-soft);color:var(--wa);font:700 11px var(--font-ui);letter-spacing:.05em;text-transform:uppercase}
.scs .cp-none{padding:32px 16px;text-align:center}
.scs .cp-none b{display:block;font:600 14px var(--font-fancy);letter-spacing:.1em;text-transform:uppercase;color:var(--wa)}
.scs .cp-none p{margin:8px 0 0;font-size:14px;color:var(--cp-soft)}
.scs .cp-none small{display:block;margin-top:4px;font-size:12px;color:var(--cp-mute)}
.scs .cp-note{margin:24px;padding:12px 16px;border:1px solid var(--cp-rule);background:var(--stage-sunken);font-size:14px;color:var(--cp-text)}
.scs .cp-load{padding:48px 0;text-align:center;font:600 11px var(--font-fancy);letter-spacing:.2em;text-transform:uppercase;color:var(--cp-mute)}
.scs .cp-load.bad{color:var(--bk-role-danger-text)}
`;
