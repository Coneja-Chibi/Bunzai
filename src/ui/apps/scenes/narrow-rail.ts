/**
 * Below a 1024px scene container the side rails cannot stand as columns, so they become one wing button row under the
 * header, and a wing's panel opens beneath it. Written once and spliced into the core stylesheet (`.scs`) and into every
 * wings variant that lays its rail out as a column (`&`), so no wing is ever unreachable on a narrow screen.
 */
export const narrowRail = (p: string): string => `
${p} .rail{display:flex;top:44px;bottom:auto;height:3.25rem;width:auto;flex-direction:row;align-items:center;gap:.35rem;padding:.35rem .5rem;opacity:1;overflow-x:auto;background:var(--stage-well)}
${p} .rail::before,${p} .rail::after{display:none}
${p} .rail{justify-content:flex-start;max-width:50%}
${p} .rail.l{left:0;right:auto}
${p} .rail.r{left:auto;right:0}
${p}.open-l .rail.l,${p}.open-r .rail.r{width:auto}
${p} .wi{width:auto;min-width:2.5rem;height:2.5rem;flex:none;display:flex;justify-content:center;align-items:center;gap:.4rem;padding:0 .5rem;border-bottom:0}
${p} .wi .tip,${p} .wi .lbl{display:none}
${p} .scroll{padding-top:6.5rem}
${p} .wing-panel.l,${p} .wing-panel.r{top:calc(44px + 3.25rem)}
`;
