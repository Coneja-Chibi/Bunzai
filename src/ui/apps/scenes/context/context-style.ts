/**
 * The Context wing's styles: its one width for both tabs (RoleCall resized the wing per tab, 08-context F1; here it opens at 880 and the viewer can drag the edge) and the Prompt Inspector's header and
 * sub-tab tiles, copied from PromptInspectorShell.tsx's Tailwind classes into values (p-4 16, text-xl 20/28, gap-1.5 6, px-2.5 py-2 10/8, and its own 11,
 * 11.5, 10.5 and 13px text, which have no plan 19 token). Its zinc steps read the plan 19 tokens and its accent tints the wing's own tone (`--w`).
 */
export const CONTEXT_STYLE = `
@container (max-width:1023px){.scs .wing-panel.r.context-wing{width:100%;padding:0}}
.scs .cx{display:flex;flex:1;min-height:0;flex-direction:column;background:color-mix(in srgb,var(--rc-zinc-950) 95%,transparent);line-height:1.5;--w-soft:color-mix(in srgb,var(--w) 12%,transparent);font-family:var(--font-ui)}
.scs .cx-hd{flex:none;padding:16px;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent)}
.scs .cx-eb{margin:0;font:700 var(--rc-text-11, 11px) var(--font-ui);letter-spacing:.28em;text-transform:uppercase;color:var(--w)}
.scs .cx-hd h2{margin:4px 0 0;font:400 1.25rem/1.75rem var(--font-fancy);color:var(--rc-zinc-100)}
.scs .cx-hd p.cx-sub{margin:4px 0 0;font:400 var(--rc-text-13, 13px)/1.5 var(--font-ui);color:var(--rc-zinc-400)}
.scs .cx-tabs{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:16px}
.scs .cx-tabs b,.scs .cx-tabs small{display:block}
.scs .cx-tabs small{margin-top:2px;opacity:.7}
.scs .cx-body{flex:1;min-height:0;overflow-y:auto}
.scs .cx-toast{position:fixed;left:50%;bottom:24px;z-index:150;display:flex;width:min(92vw,42rem);transform:translateX(-50%);align-items:flex-start;gap:12px;padding:12px 16px;border:2px solid var(--stage-mute);background:var(--stage-panel);box-shadow:5px 5px 0 0 var(--stage-black);font:700 var(--text-control)/1.4 var(--font-ui);color:var(--stage-card)}
.scs .cx-toast svg{flex:none;margin-top:2px}
.scs .cx-toast span{flex:1}
`;
