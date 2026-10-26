/**
 * The Stage wing's styles: its one width for every tab (RoleCall resized the wing per tab, F1, as `--wing-w`) and the Appearance tab, copied from
 * StageSettingsPanel.tsx's Tailwind classes into values (text-sm 14, text-xs 12, p-4 16, space-y-5 20, the hero at px-6 pt-6). RoleCall's own 10 and
 * 11px sizes stand (they have no plan 19 token, so they are px); its zinc steps read the plan 19 tokens and its violet, amber and pink tints the nearest
 * stage tokens. What the settings paint on the scene is in stage-look-style.ts.
 */
export const STAGE_STYLE = `
.scs .wbody.sa{padding:0;gap:0;line-height:1.5;--w-soft:color-mix(in srgb,var(--w) 12%,transparent);font-family:var(--font-ui)}
.scs .sa .pp-top{padding:24px 24px 0}
.scs .sa-main{flex:1;display:flex;flex-direction:column;gap:20px;padding:16px}
.scs .sa-field{display:block;min-width:0}
.scs .sa-lbl{display:flex;align-items:center;gap:6px;margin-bottom:8px;font:400 var(--rc-text-sm)/1.25rem var(--font-ui);color:var(--rc-zinc-300)}
.scs .sa-help{margin:8px 0 0;font:400 var(--rc-text-xs)/1.625 var(--font-ui);color:var(--rc-zinc-500)}
.scs .sa-cap{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;font:400 var(--rc-text-xs)/1rem var(--font-ui);color:var(--rc-zinc-500)}
.scs .sa-act{border:2px solid color-mix(in srgb,var(--stage-line) 70%,transparent);background:var(--stage-panel)}
.scs .sa-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:8px}
.scs [data-part="scene.stage.tiles"]{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:8px}
.scs .sa-body{display:flex;flex-direction:column;gap:20px;padding:16px 16px 20px;border-top:1px solid var(--stage-seam)}
.scs .sa-sws{display:flex;flex-direction:column;gap:8px}
.scs .sa-sw{display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--rc-zinc-800);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-800) 30%,transparent);transition:border-color .15s}
.scs .sa-sw:hover{border-color:var(--rc-zinc-700)}
.scs .sa-sw .ic{width:28px;height:28px;display:grid;place-items:center;border-radius:var(--rc-radius-sm);color:var(--tone);background:color-mix(in srgb,var(--tone) 12.5%,transparent)}
.scs .sa-sw b{display:block;font:400 var(--rc-text-sm)/1.25rem var(--font-ui);color:var(--rc-zinc-200)}
.scs .sa-sw small{display:block;margin-top:2px;font:400 var(--rc-text-xs)/1rem var(--font-ui);color:var(--rc-zinc-500)}
.scs .sa-edge{margin:0 0 0 24px;padding-left:12px;border-left:1px solid var(--stage-line)}
.scs .sa-edge .sa-cap{text-transform:uppercase;letter-spacing:.08em}
.scs .sa-edgeprev{position:relative;display:block;width:100%;height:32px;overflow:hidden;background:var(--stage-black)}
.scs .sa-edgeprev::after{content:"";position:absolute;top:0;bottom:0;right:0;width:3px;background:var(--accent);box-shadow:0 0 8px var(--accent)}
.scs .sa-edgeprev.segmented::after{width:4px;box-shadow:none;background:linear-gradient(to bottom,var(--accent) 0 20%,var(--deck-character) 20% 40%,var(--deck-preset) 40% 60%,var(--deck-lorebook) 60% 80%,var(--deck-regex) 80% 100%)}
.scs .sa-fonts{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px}
.scs .sa-colors{display:flex;flex-direction:column;gap:12px}
.scs .sa-color{display:grid;grid-template-columns:72px auto 1fr auto;align-items:center;gap:12px}
.scs .sa-color .cp{font:400 var(--text-meta) var(--font-ui);color:var(--stage-mute)}
.scs .sa-color .hx{font:400 var(--text-control) var(--font-mono);color:var(--stage-soft)}
`;
