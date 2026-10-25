/**
 * The Branching Tree page (RoleCall app/scenes/branching-tree page.tsx), scoped under `.sct`, read as Tailwind and converted: a zinc-950 to black page
 * (p-6, max-w-4xl), a 40px icon tile in a purple-to-pink wash, text-2xl title and text-sm subtitle, rows of rounded-sm with a white/10 border that
 * brightens on hover (p-3, gap-3, 40px indent per level, space-y-2), a 32px tile that is purple on the main timeline, a 9px MAIN chip, and a delete
 * button that shows only while the row is hovered (here the compare and rename buttons too, which RoleCall's page does not have). Purple is the
 * select role. Colors are theme tokens.
 */
export const TREE_STYLE = `
.sct{height:100%;overflow-y:auto;background:linear-gradient(to bottom,var(--rc-zinc-950),var(--rc-zinc-900),var(--stage-black));color:var(--text);font-family:var(--font-body)}
.sct .pg{max-width:896px;margin:0 auto;padding:24px}
.sct .hd{margin-bottom:24px}
.sct .back{display:inline-flex;align-items:center;gap:8px;margin-bottom:16px;padding:0;border:0;background:none;color:var(--rc-zinc-400);font:500 var(--rc-text-sm)/1.43 var(--font-body);cursor:pointer;transition:color .15s}
.sct .back:hover{color:var(--stage-white)}
.sct .ttl{display:flex;align-items:center;gap:12px}
.sct .tile{width:40px;height:40px;flex:none;display:grid;place-items:center;border-radius:var(--rc-radius-sm);background:linear-gradient(to bottom right,color-mix(in srgb,var(--bk-role-select) 20%,transparent),color-mix(in srgb,var(--bk-role-brand) 20%,transparent));color:var(--bk-role-select-text)}
.sct h1{margin:0;font:700 1.5rem/2rem var(--font-body);color:var(--stage-white)}
.sct .sub{margin:0;font:var(--rc-text-sm)/1.43 var(--font-body);color:var(--rc-zinc-500)}
.sct .list{display:flex;flex-direction:column;gap:8px}
.sct .kids{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.sct .row{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);border-radius:var(--rc-radius-sm);background:transparent;cursor:pointer;transition:all .15s}
.sct .row:hover{border-color:color-mix(in srgb,var(--stage-card) 20%,transparent);background:color-mix(in srgb,var(--stage-card) 5%,transparent)}
.sct .row.cur{border-color:var(--accent)}
.sct .ic{width:32px;height:32px;flex:none;display:grid;place-items:center;border:1px solid transparent;border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-800) 60%,transparent);color:var(--rc-zinc-400)}
.sct .row.main .ic{border-color:color-mix(in srgb,var(--bk-role-select) 30%,transparent);background:color-mix(in srgb,var(--bk-role-select-deep) 40%,transparent);color:var(--bk-role-select-text)}
.sct .open{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;padding:0;border:0;background:none;text-align:left;color:inherit;cursor:pointer}
.sct .nm{display:flex;align-items:center;gap:8px;min-width:0}
.sct .nm b{font:500 var(--rc-text-sm)/1.43 var(--font-body);color:var(--stage-white);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sct .chip{flex:none;padding:2px 6px;border-radius:var(--rc-radius);background:color-mix(in srgb,var(--bk-role-select-deep) 80%,transparent);color:var(--bk-role-select-text);font:700 var(--rc-s-9px)/1.5 var(--font-body);text-transform:uppercase}
.sct .chip.here{background:var(--accent);color:var(--stage-ink)}
.sct .meta{margin-top:2px;font:var(--rc-text-xs)/1.33 var(--font-body);color:var(--rc-zinc-500)}
.sct .act.on{color:var(--accent)}
.sct .rename{flex:1;min-width:0;padding:4px 8px;border:1px solid var(--edge);border-radius:var(--rc-radius);background:var(--stage-well);color:var(--text);font:500 var(--rc-text-sm)/1.43 var(--font-body)}
.sct .act{width:32px;height:32px;flex:none;display:grid;place-items:center;border:0;border-radius:var(--rc-radius-sm);background:none;color:var(--rc-zinc-400);cursor:pointer;opacity:0;transition:all .15s}
.sct .row:hover .act,.sct .row:focus-within .act,.sct .act.on{opacity:1}
.sct .act:hover{background:color-mix(in srgb,var(--stage-card) 5%,transparent);color:var(--stage-white)}
.sct .act.x:hover{background:color-mix(in srgb,var(--stage-danger-text) 10%,transparent);color:var(--stage-danger-text)}
.sct .act:disabled{opacity:.5;cursor:default}
.sct .go{flex:none;color:var(--rc-zinc-500)}
.sct .note{display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:12px;border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);border-radius:var(--rc-radius-sm);color:var(--rc-zinc-300);font:var(--rc-text-sm)/1.43 var(--font-body)}
.sct .note button{border:1px solid var(--edge);border-radius:var(--rc-radius);background:none;color:var(--text);padding:4px 10px;font:600 var(--rc-text-sm)/1.43 var(--font-body);cursor:pointer}
.sct .empty{padding:48px 0;text-align:center;color:var(--rc-zinc-500)}
@media (prefers-reduced-motion:reduce){.sct .row,.sct .act,.sct .back{transition:none}}
.scs .takes{width:260px;border:1px solid color-mix(in srgb,var(--rc-zinc-700) 80%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-900) 98%,transparent);backdrop-filter:blur(24px);box-shadow:0 25px 50px -12px color-mix(in srgb,var(--stage-black) 50%,transparent);font-family:var(--font-ui);animation:takes-in .15s ease-out}
@keyframes takes-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.scs .takes{animation:none}}
.scs .takes .hd{padding:8px 12px;border-bottom:1px solid color-mix(in srgb,var(--rc-zinc-700) 50%,transparent);background:color-mix(in srgb,var(--rc-zinc-800) 30%,transparent)}
.scs .takes .hd b{gap:6px;font:600 var(--rc-s-10px)/1.5 var(--font-ui);letter-spacing:.05em;text-transform:uppercase;color:color-mix(in srgb,var(--accent) 80%,transparent)}
.scs .takes .hd small{margin-top:2px;font:400 var(--rc-s-10px)/1.5 var(--font-ui);color:var(--rc-zinc-500)}
.scs .takes .pad{padding:6px}
.scs .takes .pad.list{display:flex;flex-direction:column;gap:2px;padding:0 6px 6px}
.scs .takes .sep{padding:4px 12px;gap:6px;font:600 var(--rc-s-9px)/1.5 var(--font-ui);letter-spacing:.05em;text-transform:uppercase;color:var(--rc-zinc-500)}
.scs .takes .sep::before,.scs .takes .sep::after{background:color-mix(in srgb,var(--rc-zinc-700) 50%,transparent)}
.scs .take{gap:10px;padding:8px 10px;border-radius:var(--rc-radius-sm);transition:all .15s}
.scs .take:hover{background:color-mix(in srgb,var(--rc-zinc-800) 70%,transparent)}
.scs .take .ic{width:28px;height:28px;border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-700) 60%,transparent);color:var(--rc-zinc-400)}
.scs .take.sub .ic{width:24px;height:24px}
.scs .take .tn{gap:6px;font:500 var(--rc-text-xs)/1.33 var(--font-ui);color:var(--rc-zinc-200)}
.scs .take .chip{padding:2px 4px;border-radius:var(--rc-radius);background:color-mix(in srgb,var(--rc-zinc-700) 80%,transparent);color:var(--rc-zinc-400);font:700 var(--rc-s-9px)/1.5 var(--font-ui)}
.scs .take .meta{margin-top:2px;font:400 var(--rc-s-10px)/1.5 var(--font-ui);color:var(--rc-zinc-500)}
.scs .take .meta i{color:var(--rc-zinc-600)}
.scs .take .tx input{padding:2px 6px;border:1px solid var(--rc-zinc-600);border-radius:var(--rc-radius);background:var(--rc-zinc-800);color:var(--rc-zinc-100);font:400 var(--rc-text-xs)/1.33 var(--font-ui)}
.scs .take .act{padding:4px;border-radius:var(--rc-radius);color:var(--rc-zinc-500);transition:all .15s}
.scs .take .act:hover{background:var(--rc-zinc-700);color:var(--rc-zinc-300)}
.scs .take .act.x{color:var(--stage-danger-text)}
.scs .take .dot{width:6px;height:6px;border-radius:var(--rc-radius-full)}
.scs .take.cur{border-color:transparent;background:color-mix(in srgb,var(--stage-warn) 12%,transparent)}
.scs .take.cur .ic{color:var(--stage-warn)}
.scs .take.cur .tn{color:var(--stage-warn)}
.scs .take.cur .dot{background:var(--stage-warn)}
.scs .takes .foot{border-top:1px solid color-mix(in srgb,var(--rc-zinc-700) 50%,transparent);background:color-mix(in srgb,var(--rc-zinc-800) 20%,transparent)}
.scs .takes .foot .tree{padding:10px 12px;border-bottom:1px solid color-mix(in srgb,var(--rc-zinc-700) 50%,transparent);color:color-mix(in srgb,var(--accent) 80%,transparent);font:500 var(--rc-text-xs)/1.33 var(--font-ui);transition:color .15s}
.scs .takes .foot .hint{padding:8px 12px;font:400 var(--rc-s-10px)/1.5 var(--font-ui);color:var(--rc-zinc-500)}
.scs .takes .foot .hint svg{color:color-mix(in srgb,var(--stage-warn) 70%,transparent)}
`;
