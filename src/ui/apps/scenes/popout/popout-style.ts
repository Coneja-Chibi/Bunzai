/**
 * Pop-out panels (RoleCall `LorebookActivityFeed.tsx:747-842` and the placeholder at `:815-838`). Sizes are RoleCall's Tailwind
 * values: 380px wide, 70% tall at most, header `px-3 py-2`, 24px header buttons, 12px type. Colours are stage tokens; the dot is the
 * scene accent. The layer covers the scene and passes clicks through to everything but the panels.
 */
export const POPOUT_STYLE = `
.scs .po-layer{position:absolute;inset:0;z-index:52;pointer-events:none;overflow:hidden}
.scs .po{position:absolute;display:flex;flex-direction:column;max-height:70%;pointer-events:auto;background:var(--stage-panel);border:1px solid var(--stage-line);box-shadow:6px 6px 0 var(--stage-black);font-family:var(--font-body);color:var(--stage-soft)}
.scs .po:focus{outline:none}
.scs .po-hd{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--stage-sunken);border-bottom:1px solid var(--stage-line);cursor:grab;user-select:none;touch-action:none;color:var(--stage-mute)}
.scs .po-hd.drag{cursor:grabbing}
.scs .po-hd b{font:600 12px var(--font-body);letter-spacing:.05em;text-transform:uppercase;color:var(--stage-soft)}
.scs .po-hd .grow{flex:1}
.scs .po-hd .dot{width:6px;height:6px;border-radius:50%;background:var(--bk-scene-accent-text,var(--bk-role-brand-text))}
.scs .po-hd button,.scs .po-btn{display:grid;place-items:center;width:24px;height:24px;border:0;background:none;color:var(--stage-mute);cursor:pointer}
.scs .po-hd button:hover,.scs .po-btn:hover{color:var(--stage-soft);background:color-mix(in srgb,var(--stage-card) 8%,transparent)}
.scs .po-body{flex:1;min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--stage-line) transparent}
.scs .po-ph{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 16px;text-align:center}
.scs .po-ph .ring{display:grid;place-items:center;width:40px;height:40px;margin-bottom:12px;border-radius:50%;border:1px solid var(--stage-line);background:var(--stage-sunken);color:var(--stage-mute)}
.scs .po-ph p{margin:0;font:500 12px var(--font-body);color:var(--stage-mute)}
.scs .po-ph button{margin-top:8px;padding:0;border:0;background:none;color:var(--bk-scene-accent-text,var(--bk-role-brand-text));font:500 12px var(--font-body);cursor:pointer}
@media (prefers-reduced-motion:no-preference){.scs .po-hd .dot{animation:po-pulse 2s ease-in-out infinite}}
@keyframes po-pulse{50%{opacity:.5}}
`;
