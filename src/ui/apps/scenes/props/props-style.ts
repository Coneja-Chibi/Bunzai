/** The Props wing, to RoleCall's classes (StagecraftExtensions.tsx, read as Tailwind and converted): ExtensionRow :2120 (p-2.5, gap-3, rounded-sm,
 * border white/10, bg zinc-900/50, a 32px tile at the tone's 12%, 14px/600 name, .7rem/.16em tier in zinc-400, a p-1.5 gear), DisabledExtension
 * :2240 (zinc-950/40, 55%), SectionLabel :1904, the Storyboards box :1131 and Legacy Trackers box :1205, the module tiles :895-990, and the
 * hover card (packages/ui/src/rich-tooltip.tsx TooltipShell). 8-11px text is RoleCall's own, so the 12px floor does not apply here.
 * The switch is preset-style.ts's .tg, its on colour the prop's tone. The wing opens at RoleCall's 1120px (page.tsx:2778). */
export const PROPS_STYLE = `
@container (min-width:1024px){.scs .wing-panel.l.props-wing{width:min(1120px,100%)}}
.scs .pw{gap:16px;font-family:var(--font-body)}
.scs .pw-heroWrap{position:relative}
.scs .pw-tipbtn{position:absolute;top:12px;right:12px;padding:6px 10px;border:1px solid color-mix(in srgb,var(--stage-card) 15%,transparent);background:color-mix(in srgb,var(--stage-black) 60%,transparent);color:var(--rc-zinc-300);font:700 var(--rc-s-10px)/1.5 var(--font-body);letter-spacing:.14em;text-transform:uppercase;cursor:pointer;transition:color .15s,border-color .15s}
.scs .pw-tipbtn:hover{border-color:var(--w);color:var(--stage-white)}
.scs .pw-label{padding:0 4px;margin-bottom:-8px;font:700 var(--rc-s-p7rem)/1.5 var(--font-body);letter-spacing:.2em;text-transform:uppercase;color:var(--rc-zinc-300)}
.scs .pw-list{display:flex;flex-direction:column;gap:8px}
.scs .pw-trig{display:block;width:100%}
.scs .pw-row{position:relative;display:flex;align-items:center;gap:12px;padding:10px;border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-900) 50%,transparent);cursor:pointer;transition:border-color .15s,box-shadow .15s}
.scs .pw-row:hover{border-color:color-mix(in srgb,var(--stage-card) 20%,transparent)}
.scs .pw-row:focus{outline:0;box-shadow:0 0 0 2px color-mix(in srgb,var(--stage-card) 20%,transparent)}
.scs .pw-row.soon{cursor:default;opacity:.55;background:color-mix(in srgb,var(--rc-zinc-950) 40%,transparent)}
.scs .pw-ic{width:32px;height:32px;flex:none;display:grid;place-items:center;border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--tone) 12%,transparent);color:var(--tone)}
.scs .pw-text{min-width:0;flex:1}
.scs .pw-name{font:600 var(--rc-text-sm)/1.43 var(--font-body);color:var(--rc-zinc-100);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.scs .pw-row.soon .pw-name{color:var(--rc-zinc-300)}
.scs .pw-tier{font:700 var(--rc-s-p7rem)/1.43 var(--font-body);letter-spacing:.16em;text-transform:uppercase;color:var(--rc-zinc-400)}
.scs .pw-row.soon .pw-tier{color:var(--rc-zinc-500)}
.scs .pw-end{display:flex;align-items:center;gap:6px}
.scs .pw-gear{padding:6px;border:0;background:none;color:var(--rc-zinc-300);cursor:pointer;display:grid;place-items:center;transition:color .15s}
.scs .pw-gear:hover{color:var(--stage-white)}
.scs .pw-row.soon .pw-gear{cursor:default;color:var(--rc-zinc-600)}
.scs .pw-row .tg.on{background:var(--tone)}
.scs .pw-sub{margin:8px 0 0 20px;padding-left:12px;border-left:1px solid color-mix(in srgb,var(--tone,var(--w)) 25%,transparent)}
.pw-rt{position:fixed;z-index:9999;width:min(320px,calc(100vw - 24px));overflow:hidden;border:3px solid var(--stage-black);background:var(--stage-black);color:var(--stage-card);font-family:var(--font-body);box-shadow:6px 6px 0 0 var(--tone,var(--rc-zinc-500));animation:pw-rt-in .1s ease-out}
@keyframes pw-rt-in{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.pw-rt{animation:none}}
.pw-rt-head{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:2px solid var(--stage-black);background:var(--stage-panel)}
.pw-rt-head span{font:900 var(--rc-s-11px)/1.5 var(--font-body);letter-spacing:.13em;text-transform:uppercase;color:var(--rc-zinc-200)}
.pw-rt-head button{margin-left:auto;width:28px;height:28px;border:2px solid var(--stage-black);background:var(--stage-panel);color:var(--stage-white);font:900 var(--rc-s-11px) var(--font-mono);cursor:pointer}
.pw-rt-body{display:flex;flex-direction:column;gap:8px;padding:10px 12px}
.pw-rt-body p{margin:0;font-size:12px;line-height:1.625;color:var(--rc-zinc-200)}
.pw-rt-body ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px}
.pw-rt-body li{display:flex;align-items:flex-start;gap:8px;font-size:var(--rc-s-11px);line-height:1.625;color:var(--rc-zinc-400)}
.pw-rt-body li i{font-style:normal;color:var(--tone,var(--rc-zinc-500))}
.pw-rt-hint{border-top:2px solid var(--rc-zinc-800);padding-top:8px;font:400 var(--rc-s-10px)/1.625 var(--font-mono);color:var(--rc-zinc-500)}
.scs .pw-subrow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 8px;border:1px solid var(--rc-zinc-800);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-900) 50%,transparent)}
.scs .pw-subrow b{display:block;font:600 var(--rc-s-10px)/1.5 var(--font-body);color:var(--rc-zinc-400)}
.scs .pw-subrow small{display:block;margin-top:2px;font:400 var(--rc-s-9px)/1.5 var(--font-body);color:var(--rc-zinc-500)}
.scs .wing-panel.l.props-wing:has(.pw[data-open]){width:min(900px,100%)}
.scs .pw-back{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid color-mix(in srgb,var(--stage-card) 15%,transparent);background:color-mix(in srgb,var(--stage-black) 60%,transparent);color:var(--rc-zinc-300);font:700 var(--rc-s-10px)/1 var(--font-body);letter-spacing:.14em;text-transform:uppercase;cursor:pointer;transition:color .15s,border-color .15s}
.scs .pw-back:hover{border-color:var(--w);color:var(--stage-white)}
.scs .pw-box{padding:10px;border:1px solid var(--rc-zinc-800);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-950) 40%,transparent)}
.scs .pw-box.story{border-color:color-mix(in srgb,var(--stage-ok) 20%,transparent);background:color-mix(in srgb,var(--stage-ok) 3%,transparent)}
.scs .pw-box-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.scs .pw-box h4{margin:0;font:600 var(--rc-s-10px)/1.5 var(--font-body);letter-spacing:2px;text-transform:uppercase;color:var(--rc-zinc-300)}
.scs .pw-box.story h4{color:var(--stage-ok)}
.scs .pw-box-head p{margin:4px 0 0;font:400 var(--rc-s-10px)/1.625 var(--font-body);color:var(--rc-zinc-300)}
.scs .pw-chip{flex:none;padding:4px 8px;border:1px solid var(--rc-zinc-700);font:700 var(--rc-s-8px)/1.5 var(--font-body);letter-spacing:1px;text-transform:uppercase;color:var(--rc-zinc-400)}
.scs .pw-box.legacy .pw-chip{padding:0;border:0;font:400 var(--rc-s-9px)/1.5 var(--font-body);color:var(--rc-zinc-400)}
.scs .pw-box.story .pw-chip{border-color:color-mix(in srgb,var(--stage-ok) 30%,transparent);color:var(--stage-ok)}
.scs .pw-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.scs .pw-tile{position:relative;display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-900) 50%,transparent);text-align:left;cursor:pointer;transition:all .15s}
.scs .pw-tile:hover{border-color:color-mix(in srgb,var(--stage-card) 20%,transparent)}
.scs .pw-tile.on{border-color:color-mix(in srgb,var(--tone) 44%,transparent);background:color-mix(in srgb,var(--tone) 8%,transparent)}
.scs .pw-tile.story{min-height:96px;flex-direction:column;align-items:stretch;padding:12px}
.scs .pw-tile-head{display:flex;align-items:center;gap:8px;width:100%;color:var(--rc-zinc-500)}
.scs .pw-tile.on .pw-tile-head{color:var(--tone)}
.scs .pw-tile.soon{cursor:default;opacity:.55}
.scs .pw-tile.soon:hover{border-color:color-mix(in srgb,var(--stage-card) 10%,transparent)}
.scs .pw-tile-name{flex:1;min-width:0;font:400 var(--rc-s-10px)/1.5 var(--font-body);color:var(--rc-zinc-400)}
.scs .pw-tile.on .pw-tile-name{color:var(--stage-white)}
.scs .pw-tile.story .pw-tile-name{font-size:var(--rc-s-11px);font-weight:600;letter-spacing:1.2px;text-transform:uppercase}
.scs .pw-tile-blurb{margin:0;font:400 var(--rc-s-10px)/1.625 var(--font-body);color:var(--rc-zinc-300)}
.scs .pw-tile .pw-chip{margin-left:auto;padding:2px 6px;border-color:var(--rc-zinc-700);color:var(--rc-zinc-400)}
.scs .pw-tile.on .pw-chip{border-color:color-mix(in srgb,var(--stage-white) 30%,transparent);color:var(--stage-white)}
.scs .pw-span2{grid-column:span 2;display:flex;flex-direction:column;gap:4px}
.scs .pw-dots{display:flex;align-items:center;gap:3px;margin-left:auto}
.scs .pw-dots.low{margin:auto 0 0;gap:4px}
.scs .pw-dots i{width:5px;height:5px;border-radius:var(--rc-radius-full);background:var(--rc-zinc-600)}
.scs .pw-dots.low i{width:6px;height:6px}
.scs .pw-dots i.up{background:color-mix(in srgb,var(--tone) 25%,transparent)}
.scs .pw-dots i.on{background:var(--tone)}
.scs .pw-subs{display:flex;flex-direction:column;gap:2px;margin:0 0 2px 12px;padding:2px 0 2px 10px;border-left:2px solid color-mix(in srgb,var(--tone) 25%,transparent)}
.scs .pw-span2.story .pw-subs{margin-top:4px}
.scs .pw-subs button{display:flex;align-items:center;gap:8px;width:100%;padding:2px 0;border:0;background:none;color:var(--rc-zinc-300);font:400 var(--rc-s-10px)/1.5 var(--font-body);text-align:left;cursor:pointer;transition:color .15s}
.scs .pw-subs button:hover{color:var(--rc-zinc-400)}
.scs .pw-subs i{width:12px;height:12px;border:1.5px solid var(--rc-zinc-600);border-radius:var(--rc-radius-full);display:grid;place-items:center;flex:none}
.scs .pw-subs button:hover i{border-color:var(--rc-zinc-500)}
.scs .pw-subs i.on{border-color:var(--tone)}
.scs .pw-subs i.on::after{content:"";width:6px;height:6px;border-radius:var(--rc-radius-full);background:var(--tone)}
.scs .pw-subs button svg{flex:none;color:var(--rc-zinc-600)}
.scs .pw-subs button:has(i.on) svg{color:var(--tone)}
.scs .prop-note{font:400 var(--rc-text-xs)/1.4 var(--font-body);color:var(--rc-zinc-500)}
`;
