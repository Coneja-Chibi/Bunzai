/**
 * The Memory tab's styles (.mm), copied from MemoryPanel.tsx's Tailwind classes into px (p-5 20, space-y-4 16, p-4 16, p-3 12, gap-4 16, h-7 w-12 28/48, h-5 w-5 20, min-h-10 40, px-3 py-2.5 12/10, text-sm 14,
 * text-[0.8rem] 12.8, text-[0.78rem] 12.5). RoleCall's rounded switch, zinc tints and black offset shadows map to the stage tokens with square corners; the offset shadow is kept (`3px 3px`).
 */
export const MEMORY_STYLE = `
.scs .wbody.mm{padding:20px;gap:16px}
.scs .mm-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
.scs .mm-stats>div{padding:12px 16px;border:1px solid var(--stage-seam);background:color-mix(in srgb,var(--stage-floor) 70%,transparent);box-shadow:3px 3px 0 0 var(--stage-black)}
.scs .mm-stats small{display:block;font:700 var(--text-meta) var(--font-ui);letter-spacing:.18em;text-transform:uppercase;color:var(--stage-mute)}
.scs .mm-stats b{display:block;margin-top:6px;font:900 20px/1.2 var(--font-ui);color:var(--w)}
.scs .mm-stats b.wrap{font-size:16px;overflow-wrap:anywhere}
.scs .mm-card{display:flex;flex-direction:column;gap:20px;padding:16px;border:1px solid color-mix(in srgb,var(--stage-seam) 80%,transparent);background:color-mix(in srgb,var(--stage-floor) 55%,transparent);box-shadow:3px 3px 0 0 var(--stage-black)}
.scs .mm-card.on{border-color:color-mix(in srgb,var(--w) 45%,transparent);box-shadow:5px 5px 0 0 color-mix(in srgb,var(--w) 12%,transparent)}
.scs .mm-sec{display:flex;align-items:center;gap:8px;font:700 var(--text-meta) var(--font-mono);letter-spacing:.2em;text-transform:uppercase;color:var(--w)}
.scs .mm-sec small{margin-left:auto;font:400 var(--text-meta) var(--font-mono);letter-spacing:.08em;color:var(--stage-mute)}
.scs .mm-line{margin:-12px 0 0;font:400 12.8px/1.5 var(--font-ui);color:var(--stage-mute)}
.scs .mm-line.box{margin:0;padding:12px;border:1px solid color-mix(in srgb,var(--stage-seam) 80%,transparent);background:color-mix(in srgb,var(--stage-black) 20%,transparent)}
.scs .mm-st{display:block;min-width:0}
.scs .mm-sn{display:flex;align-items:center;gap:8px;font:600 var(--text-control) var(--font-ui);color:var(--stage-card)}
.scs .mm-sn svg{color:var(--w)}
.scs .mm-sd{display:block;margin-top:6px;font:400 12.5px/1.6 var(--font-ui);color:var(--stage-mute)}
.scs .mm-field{display:flex;flex-direction:column;gap:8px}
.scs .mm-fl{font:600 var(--text-meta) var(--font-ui);letter-spacing:.04em;color:var(--stage-card)}
.scs .mm-fh{font:400 12.5px/1.6 var(--font-ui);color:var(--stage-mute)}
.scs .mm-in{width:100%;box-sizing:border-box;min-height:40px;padding:10px 12px;border:1px solid var(--stage-line);background:color-mix(in srgb,var(--stage-floor) 80%,transparent);font:400 var(--text-control) var(--font-ui);color:var(--stage-card);box-shadow:2px 2px 0 0 var(--stage-black)}
.scs .mm-in:focus{outline:2px solid color-mix(in srgb,var(--w) 40%,transparent);border-color:color-mix(in srgb,var(--w) 70%,transparent)}
.scs .mm-in::placeholder{color:var(--stage-dim)}
.scs textarea.mm-in{resize:vertical;line-height:1.6}
.scs textarea.mm-in.tall{min-height:170px}
.scs textarea.mm-in.mono{font:var(--text-meta)/1.6 var(--font-mono)}
.scs .mm-err{margin:0;padding:12px;border:1px solid color-mix(in srgb,var(--stage-danger-text) 40%,transparent);background:var(--stage-danger-bg);font:400 var(--text-meta)/1.6 var(--font-ui);color:var(--stage-danger-text);box-shadow:2px 2px 0 0 var(--stage-black)}
.scs .mm-note{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid color-mix(in srgb,var(--stage-seam) 80%,transparent);background:color-mix(in srgb,var(--stage-black) 20%,transparent);font:400 var(--text-meta)/1.6 var(--font-ui);color:var(--stage-mute)}
.scs .mm-note.on{display:block;border-color:color-mix(in srgb,var(--w) 35%,transparent);background:color-mix(in srgb,var(--w) 10%,transparent);color:var(--stage-soft);box-shadow:2px 2px 0 0 var(--stage-black)}
.scs .mm-dis{border-top:1px solid color-mix(in srgb,var(--stage-seam) 80%,transparent);padding-top:16px}
.scs .mm-dis>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 -8px;padding:8px;cursor:pointer;list-style:none;color:var(--stage-mute)}
.scs .mm-dis>summary::-webkit-details-marker{display:none}
.scs .mm-dis>summary:hover{background:color-mix(in srgb,var(--stage-card) 4%,transparent)}
.scs .mm-dis[open]>summary>svg{transform:rotate(180deg)}
.scs .mm-lbl{display:flex;align-items:center;gap:8px;font:700 var(--text-meta) var(--font-mono);letter-spacing:.2em;text-transform:uppercase;color:var(--w)}
.scs .mm-lbl small{font:400 var(--text-meta) var(--font-mono);letter-spacing:.08em;color:var(--stage-mute)}
.scs .mm-dbody{display:flex;flex-direction:column;gap:16px;padding-top:12px}
.scs .mm-vars{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;font:400 12.5px/1.6 var(--font-ui);color:var(--stage-mute)}
.scs .mm-vars code{margin:0 4px 0 0;padding:2px 6px;border:1px solid var(--stage-seam);background:color-mix(in srgb,var(--stage-black) 40%,transparent);font:var(--text-meta) var(--font-mono);color:var(--w)}
.scs .mm-text{padding:16px;border:1px solid color-mix(in srgb,var(--stage-seam) 80%,transparent);background:color-mix(in srgb,var(--stage-black) 25%,transparent);box-shadow:2px 2px 0 0 var(--stage-black)}
.scs .mm-text p{margin:0;white-space:pre-wrap;font:400 var(--text-control)/1.65 var(--font-ui);color:var(--stage-soft)}
.scs .mm-edit{display:flex;flex-direction:column;gap:12px}
.scs .mm-acts{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}
.scs .mm-wait{padding:48px 0;text-align:center;color:var(--w)}
.scs .mm-wait p{margin:12px 0 0;font:var(--text-control) var(--font-ui);color:var(--stage-mute)}
.scs .mm-empty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:32px 16px;text-align:center;border:1px dashed var(--stage-seam);background:color-mix(in srgb,var(--stage-black) 20%,transparent);color:var(--stage-dim)}
.scs .mm-empty p{margin:6px 0 0;font:var(--text-control) var(--font-ui);color:var(--stage-mute)}
.scs .mm-empty small{font:var(--text-meta) var(--font-ui);color:var(--stage-dim)}
.scs .mm-empty small{margin-bottom:10px}
.scs .mm-back{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding-top:16px;border-top:1px solid var(--stage-seam)}
.scs .mm-back p{margin:0;flex:1;min-width:200px;font:var(--text-meta)/1.6 var(--font-ui);color:var(--stage-dim)}
.scs .mm-back b{color:var(--stage-soft)}
.scs .mm select:focus-visible,.scs .mm summary:focus-visible{outline:2px solid var(--focus-ring);outline-offset:1px}
`;
