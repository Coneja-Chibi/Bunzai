/**
 * The Control Booth's tool tiles (approved wireframe premiere/scene-pieces.html, 2a): a grid of tiles in a scroll box, a tile dimmed while its tool is unlinked, the per-reply cost line with the
 * share bar, and the link picker. Colors are the Booth's palette (RoleCall's zinc scale, which the Messenger re-points at its own tokens), so both layouts draw it.
 */
export const BOOTH_TOOLS_STYLE = `
.scs .bth-tools{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.scs .bth-tools-scroll{max-height:280px;overflow-y:auto}
.scs .bth-tools-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.scs .bth-tool{display:flex;flex-direction:column;gap:6px;min-width:0;padding:10px;border:1px solid var(--rc-zinc-800);background:color-mix(in srgb,var(--rc-zinc-950) 60%,transparent)}
.scs .bth-tool[data-off]{opacity:.55}
.scs .bth-tool-t{display:flex;align-items:center;gap:6px;min-width:0;color:var(--rc-zinc-200)}
.scs .bth-tool-t>b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 var(--rc-text-sm,14px) var(--font-ui)}
.scs .bth-tool>small{color:var(--rc-zinc-400);font:400 var(--rc-text-10,12px)/1.4 var(--font-ui)}
.scs .bth-tool-f{display:flex;align-items:center;justify-content:space-between;color:var(--rc-zinc-400);font:600 var(--rc-text-10,12px) var(--font-mono)}
.scs .bth-tools-cost{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;color:var(--rc-zinc-300);font:400 var(--rc-text-10,12px) var(--font-ui)}
.scs .bth-tools-cost>b{grid-column:3;font:600 var(--rc-text-10,12px) var(--font-mono);color:var(--rc-zinc-200)}
.scs .bth-tools-bar{display:block;grid-column:2;height:6px;background:var(--rc-zinc-800);overflow:hidden}
.scs .bth-tools-bar>i{display:block;width:var(--fill);height:100%;background:var(--w)}
.scs .bth-tools-act{display:flex;flex-wrap:wrap;gap:8px}
.scs .bth-tools-pick{display:flex;flex-direction:column;gap:4px;max-height:280px;overflow-y:auto}
`;
