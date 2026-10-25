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
.scs .sa-reset{padding:0;border:0;background:none;font:400 var(--rc-text-xs) var(--font-ui);color:var(--rc-zinc-500);text-decoration:underline;cursor:pointer}
.scs .sa-reset:hover{color:var(--rc-zinc-300)}
.scs .sa-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:8px}
.scs .sa-card{min-width:0;padding:12px;text-align:left;border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);background:color-mix(in srgb,var(--stage-black) 20%,transparent);color:var(--stage-mute);cursor:pointer;transition:border-color .15s,color .15s}
.scs .sa-card:hover{border-color:color-mix(in srgb,var(--stage-card) 25%,transparent);color:var(--stage-soft)}
.scs .sa-card.on{border-color:color-mix(in srgb,var(--stage-warn) 70%,transparent);background:color-mix(in srgb,var(--stage-warn) 8%,transparent);color:var(--stage-card)}
.scs .sa-card b{display:block;font:600 var(--rc-text-xs) var(--font-fancy);letter-spacing:.12em;text-transform:uppercase}
.scs .sa-card small{display:block;margin-top:4px;font:400 var(--rc-text-11, 11px)/1.375 var(--font-ui);color:var(--rc-zinc-500)}
.scs .sa-act{border:2px solid color-mix(in srgb,var(--stage-line) 70%,transparent);background:var(--stage-panel)}
.scs .sa-act>button{display:flex;width:100%;align-items:baseline;gap:12px;padding:12px 16px;text-align:left;border:0;background:none;color:inherit;cursor:pointer}
.scs .sa-act .chev{font:var(--rc-text-xs) var(--font-mono);color:var(--rc-zinc-500);transition:transform .15s}
.scs .sa-act.open .chev{transform:rotate(90deg)}
.scs .sa-act .ttl{font:700 var(--rc-text-13, 13px) var(--font-fancy);letter-spacing:.16em;text-transform:uppercase;color:var(--rc-zinc-100)}
.scs .sa-act .sp{flex:1}
.scs .sa-act .st{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:var(--rc-text-10, 10px) var(--font-mono);letter-spacing:.08em;color:var(--rc-zinc-500)}
.scs .sa-body{display:flex;flex-direction:column;gap:20px;padding:16px 16px 20px;border-top:1px solid var(--stage-seam)}
.scs .sa-sws{display:flex;flex-direction:column;gap:8px}
.scs .sa-sw{display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--rc-zinc-800);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-800) 30%,transparent);transition:border-color .15s}
.scs .sa-sw:hover{border-color:var(--rc-zinc-700)}
.scs .sa-sw .ic{width:28px;height:28px;display:grid;place-items:center;border-radius:var(--rc-radius-sm);color:var(--tone);background:color-mix(in srgb,var(--tone) 12.5%,transparent)}
.scs .sa-sw b{display:block;font:400 var(--rc-text-sm)/1.25rem var(--font-ui);color:var(--rc-zinc-200)}
.scs .sa-sw small{display:block;margin-top:2px;font:400 var(--rc-text-xs)/1rem var(--font-ui);color:var(--rc-zinc-500)}
.scs .sa-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:8px}
.scs .sa-tile{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px;text-align:center;border:1px solid var(--stage-seam);background:color-mix(in srgb,var(--stage-row) 60%,transparent);color:var(--stage-mute);font:500 var(--text-meta) var(--font-ui);cursor:pointer}
.scs .sa-tile small{font-weight:400;color:var(--stage-mute)}
.scs .sa-tile:hover{border-color:var(--stage-line);color:var(--stage-soft)}
.scs .sa-tile.on{border-color:color-mix(in srgb,var(--accent) 50%,transparent);background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--bk-scene-accent-text,var(--bk-role-brand-text))}
.scs .sa-edge{margin:0 0 0 24px;padding-left:12px;border-left:1px solid var(--stage-line)}
.scs .sa-edge .sa-cap{text-transform:uppercase;letter-spacing:.08em}
.scs .sa-edgeprev{position:relative;display:block;width:100%;height:32px;overflow:hidden;background:var(--stage-black)}
.scs .sa-edgeprev::after{content:"";position:absolute;top:0;bottom:0;right:0;width:3px;background:var(--accent);box-shadow:0 0 8px var(--accent)}
.scs .sa-edgeprev.segmented::after{width:4px;box-shadow:none;background:linear-gradient(to bottom,var(--accent) 0 20%,var(--deck-character) 20% 40%,var(--deck-preset) 40% 60%,var(--deck-lorebook) 60% 80%,var(--deck-regex) 80% 100%)}
.scs .sa-fonts{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px}
.scs .sa-font{display:block;min-width:0;padding:10px 12px;text-align:left;border:1px solid var(--stage-line);background:color-mix(in srgb,var(--stage-row) 40%,transparent);color:var(--stage-soft);cursor:pointer}
.scs .sa-font:hover{border-color:var(--stage-mute);background:color-mix(in srgb,var(--stage-row) 70%,transparent)}
.scs .sa-font.on{border-color:color-mix(in srgb,var(--stage-var) 60%,transparent);background:color-mix(in srgb,var(--stage-var) 10%,transparent);color:var(--stage-card)}
.scs .sa-font .nm{font-size:var(--text-control)}
.scs .sa-font .nt{margin-left:8px;padding:2px 6px;font:500 var(--text-meta) var(--font-ui);letter-spacing:.04em;text-transform:uppercase;color:var(--stage-var);background:color-mix(in srgb,var(--stage-var) 15%,transparent)}
.scs .sa-font small{display:block;margin-top:2px;font-size:var(--text-meta);color:var(--stage-mute)}
.scs .sa-colors{display:flex;flex-direction:column;gap:12px}
.scs .sa-color{display:grid;grid-template-columns:72px auto 1fr auto;align-items:center;gap:12px}
.scs .sa-color .cp{font:400 var(--text-meta) var(--font-ui);color:var(--stage-mute)}
.scs .sa-color .hx{font:400 var(--text-control) var(--font-mono);color:var(--stage-soft)}
`;
