/**
 * The Cast wing's styles (approved wireframe, design/wireframes/features/cast-wing): the hero, the tall
 * portrait column, the form cards, the pinned footer, the Casting Call and the emoji popover, and the
 * transcript's swap line. Tokens only; sizes, radii and fonts are RoleCall's CharacterPanel (plan 19). The wing is its own size container, so the layout
 * answers the width of the panel (a container query), never the viewport (AGENTS rule 11).
 */
export const CAST_STYLE = `
.scs .cast-wing{--acc:var(--deck-character)}
.scs .cw-wrap{flex:1;min-height:0;display:flex;flex-direction:column;container:cwing/inline-size;position:relative;overflow-y:auto}
.scs .cw-wrap>.notice{margin:12px 12px 0}
.scs .cw-quiet{margin:8px 12px 0;font-size:12px;color:var(--stage-mute);display:flex;gap:8px;align-items:baseline}
.scs .cw-pad .empty2{font-size:13px}
.scs .empty2 b,.scs .empty2 span{display:block}.scs .empty2 b{margin-bottom:6px}
.scs .cast-wing .tabs b,.scs .cast-wing .tabs small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.scs .cast-wing .tabs small{margin-top:2px;font-size:10px;letter-spacing:.025em;text-transform:uppercase;opacity:.6}
.scs .cw-hint{margin:0;font-size:12px;line-height:1.45;color:var(--stage-mute)}
/* swatches: the one colour component of both tabs (cast-palette.tsx) */
.scs .cw-swatches{display:flex;flex-wrap:wrap;gap:16px 14px;align-items:flex-start}
.scs .cw-swatches.row{gap:10px}
.scs .cw-sw{width:64px;display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center}
.scs .cw-sw .cw-hold{position:relative;display:block}
.scs .cw-pick{margin-top:10px;display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.scs .cw-sw .cw-hold>i{position:absolute;top:-6px;right:-6px;width:16px;height:16px;display:grid;place-items:center;background:var(--stage-warn);color:var(--stage-ink)}
.scs .cw-sw .cw-hold>[data-control=icon]{position:absolute;top:-6px;right:-6px}
.scs .cw-sw .cw-nm,.scs .cw-sw .cw-lab{width:100%;min-width:0;box-sizing:border-box;background:transparent;border:0;text-align:center;color:var(--stage-card);font:12px var(--font-ui);padding:1px 0}
.scs .cast-wing .cw-sw input.cw-nm,.scs .cast-wing .cw-sw input.cw-lab{appearance:none;border:0!important;border-radius:0;box-shadow:none!important;background:transparent!important;background-image:none!important;outline:0;height:auto;min-height:0;padding:1px 0}
.scs .cw-sw .cw-nm:focus,.scs .cw-sw .cw-lab:focus{background:color-mix(in srgb,var(--stage-card) 8%,transparent);outline:0}
.scs .cw-sw .cw-lab{font:12px var(--font-mono);letter-spacing:.02em;text-transform:uppercase;color:var(--stage-mute)}
.scs .cw-sw .cw-lab.gold{color:var(--stage-warn);font-weight:700}
.scs .cw-sw .cw-ar{display:flex;gap:2px}
.scs .cw-theme{display:flex;flex-direction:column;gap:8px}
.scs .cw-gbar{height:10px;border:1px solid var(--stage-line)}
.scs .cw-upd{margin:8px 12px 0}
.scs .cw,.scs .cw-cc{--acc-t:color-mix(in srgb,var(--acc) 40%,var(--stage-card))}
.scs .cw{--w:var(--bk-character-accent-text,var(--deck-character));--acc:var(--bk-character-accent,var(--deck-character));--acc-t:var(--bk-character-accent-text,color-mix(in srgb,var(--acc) 40%,var(--stage-card)));flex:1 0 auto;display:flex;flex-direction:column}
.scs .cw-persona{--w:var(--bk-persona-accent-text,var(--deck-persona));--acc:var(--bk-persona-accent,var(--deck-persona));--acc-t:var(--bk-persona-accent-text,color-mix(in srgb,var(--acc) 40%,var(--stage-card)))}
.scs .cw-hero .hi{background:color-mix(in srgb,var(--acc) 22%,var(--stage-well))}
.scs .cw-hero{margin:20px 20px 0;box-shadow:6px 6px 0 0 color-mix(in srgb,var(--acc) 14%,transparent)}
.scs .cw-hero .hi{color:var(--acc-t);border-color:color-mix(in srgb,var(--acc) 50%,transparent)}
.scs .cw-hero h2 em{font-style:normal;color:var(--acc-t)}
.scs .cw-hero p{font:.95rem/1.625 var(--font-ui);text-transform:none;letter-spacing:normal;color:var(--stage-soft)}
.scs .cw-body{flex:1 0 30rem;min-height:30rem;display:flex}
.scs .cw-pad{padding:12px;display:flex;flex-direction:column;gap:12px}
.scs .cw-pad .cw-acts,.scs .cw-create .cw-acts,.scs .empty2 .cw-acts{display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap}
.scs .cw-newp{align-self:flex-start;border-style:dashed;background:transparent;color:var(--stage-soft)}
.scs .cw-roster{list-style:none;margin:0;padding:0;border:1px solid var(--stage-seam)}
.scs .cw-roster li{display:flex;gap:10px;align-items:center;padding:10px;border-bottom:1px solid var(--stage-seam)}
.scs .cw-roster li:last-child{border-bottom:0}
.scs .cw-roster .av{width:30px;height:30px;display:grid;place-items:center;font-family:var(--font-fancy);color:var(--stage-ink)}
.scs .cw-roster .ch{background:var(--bk-character-accent,var(--deck-character))}.scs .cw-roster .pe{background:var(--bk-persona-accent,var(--deck-persona))}
.scs .cw-roster b{display:block;font-size:13.5px;color:var(--stage-card)}.scs .cw-roster small{font-size:12px;color:var(--stage-mute)}

/* the portrait column */
.scs .cw-por{width:380px;flex:none;position:relative;overflow-x:hidden;overflow-y:auto;background:linear-gradient(170deg,color-mix(in srgb,var(--acc) 55%,var(--stage-panel)),var(--stage-black) 92%)}
.scs .cw-por .img{position:absolute;inset:0;display:grid;place-items:center;color:color-mix(in srgb,var(--stage-card) 22%,transparent)}
.scs .cw-por .img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.scs .cw-por .standin{font-size:4.5rem;font-family:var(--font-fancy);line-height:1;opacity:.5}
.scs .cw-por .tl,.scs .cw-por .tr{position:absolute;top:10px;z-index:3;display:flex;gap:6px}
.scs .cw-por .tl{left:10px}.scs .cw-por .tr{right:10px}
.scs .cw-por .fadeb{position:absolute;left:0;right:0;bottom:0;height:60%;background:linear-gradient(to top,var(--stage-black) 0%,color-mix(in srgb,var(--stage-black) 80%,transparent) 40%,transparent)}
.scs .cw-por .cw-info{position:absolute;left:0;right:0;bottom:0;padding:20px;z-index:2}
.scs .nowchip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;margin-bottom:12px;border-radius:var(--rc-radius-sm);font:600 10px var(--font-ui);letter-spacing:.05em;text-transform:uppercase;color:var(--stage-card);background:color-mix(in srgb,var(--acc) 35%,var(--stage-panel));border:1px solid color-mix(in srgb,var(--acc) 60%,transparent)}
.scs .nowchip i{width:6px;height:6px;border-radius:var(--rc-radius-full);background:var(--acc-t);animation:cwPulse 2s ease-in-out infinite}
@keyframes cwPulse{50%{opacity:.5}}
.scs .cw-por h1{margin:0 0 4px;font:700 1.5rem/2rem var(--font-ui);color:var(--stage-card)}
.scs .cw-por .cw-tg{margin:0 0 12px;font-size:14px;line-height:1.43;color:var(--stage-soft)}
.scs .cw-por .cw-tg.mut{color:var(--stage-mute)}
.scs .cw-por .badges{margin-top:8px;display:flex;gap:6px}
.scs .cw-por .vb{padding:2px 8px;border-radius:var(--rc-radius);font:500 10px var(--font-mono);color:var(--stage-soft);border:1px solid var(--stage-line);background:color-mix(in srgb,var(--stage-black) 50%,transparent)}
.scs .cw-por .vth{margin-top:8px;display:flex;gap:5px;flex-wrap:wrap}
.scs .cw-por .stats{margin-top:6px;display:flex;gap:14px;font:12px var(--font-mono);color:var(--stage-soft);align-items:center}
.scs .cw-por .stats span{display:inline-flex;gap:5px;align-items:center}

/* the form column */
.scs .cw-form{flex:1;min-width:0;display:flex;flex-direction:column;background:var(--stage-panel)}
.scs .cw-scroll{flex:1;min-height:0;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:12px}
.scs .cw-card{position:relative;border-radius:var(--rc-radius-sm);border:1px solid color-mix(in srgb,var(--acc) 30%,transparent);background:linear-gradient(135deg,color-mix(in srgb,var(--acc) 9%,var(--stage-panel)),var(--stage-panel) 55%);padding:12px;display:flex;flex-direction:column;gap:10px}
.scs .cw-card::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.4;background:linear-gradient(var(--acc),var(--acc)) 0 0/32px 2px,linear-gradient(var(--acc),var(--acc)) 0 0/2px 32px,linear-gradient(var(--acc),var(--acc)) 100% 0/32px 2px,linear-gradient(var(--acc),var(--acc)) 100% 0/2px 32px,linear-gradient(var(--acc),var(--acc)) 0 100%/32px 2px,linear-gradient(var(--acc),var(--acc)) 0 100%/2px 32px,linear-gradient(var(--acc),var(--acc)) 100% 100%/32px 2px,linear-gradient(var(--acc),var(--acc)) 100% 100%/2px 32px;background-repeat:no-repeat}
.scs .cw-card .idr{display:flex;gap:12px;align-items:flex-start}
.scs .cw-card .names{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
.scs .cw-card .pair{display:flex;gap:10px}.scs .cw-card .pair>*{flex:1;min-width:0}
.scs .cw-card .theme{text-align:center;flex:none;display:flex;flex-direction:column;gap:4px;align-items:center}
.scs .cw-card .sw0{width:48px;height:48px;border:2px solid color-mix(in srgb,var(--stage-card) 35%,transparent)}
.scs .cw .lb{font:700 10px var(--font-ui);letter-spacing:.18em;text-transform:uppercase;color:var(--stage-soft)}
.scs .cw-line{display:flex;flex-direction:column;gap:3px;min-width:0}
.scs .cw-line small{font-weight:400;opacity:.5}
.scs .cw-line input{background:color-mix(in srgb,var(--stage-card) 5%,transparent);border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);border-radius:var(--rc-radius-sm);padding:8px 12px;font:14px var(--font-ui);color:var(--stage-card);min-width:0}
.scs .cw-line.big input{background:transparent;border:0;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 20%,transparent);border-radius:0;padding:4px 0;font:700 18px var(--font-ui)}
.scs .cw-line.line input{background:transparent;border:0;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);border-radius:0;padding:4px 0}
.scs .cw-line.bare{padding-top:8px;border-top:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent)}
.scs .cw-line.bare input{background:transparent;border:0;border-radius:0;padding:4px 0;color:var(--stage-soft)}
.scs .cw-line input.bad{border-color:var(--stage-danger-edge)}
.scs .cw-line .err{font-size:12px;color:var(--stage-danger-text)}
.scs .cw-sec{--c:var(--acc);border:2px solid var(--stage-seam);border-left:4px solid var(--c);background:var(--stage-well);box-shadow:3px 3px 0 0 var(--stage-black);padding:16px;display:flex;flex-direction:column;gap:12px}
.scs .cw-sec>h3{margin:0;display:flex;align-items:center;gap:8px;font:700 .92rem var(--font-fancy);letter-spacing:.18em;text-transform:uppercase;color:color-mix(in srgb,var(--c) 40%,var(--stage-card))}
.scs .cw-sec>h3 small{font:400 12px var(--font-ui);letter-spacing:0;text-transform:none;color:var(--stage-mute)}
.scs .cw-sec>h3 .xp{margin-left:auto;display:flex}
.scs .cw-sub{display:flex;flex-direction:column;gap:6px}
.scs .cw-ta,.scs .cw-sec textarea{width:100%;box-sizing:border-box;padding:6px 8px;min-height:50px;background:color-mix(in srgb,var(--stage-black) 60%,transparent);border:2px solid var(--stage-line);box-shadow:inset 2px 2px 0 0 color-mix(in srgb,var(--stage-black) 60%,transparent);font:14px/20px var(--font-ui);color:var(--stage-card);resize:vertical}
.scs .cw-ta:focus,.scs .cw-sec textarea:focus{outline:0;border-color:color-mix(in srgb,var(--c) 60%,transparent);box-shadow:inset 2px 2px 0 0 color-mix(in srgb,var(--stage-black) 60%,transparent),0 0 15px color-mix(in srgb,var(--c) 15%,transparent)}
.scs .cw-rate-ic{display:inline-flex}
.scs .cw-chips{display:flex;flex-wrap:wrap;gap:6px}.scs .cw-chips span{padding:4px 8px;font:700 .74rem var(--font-ui);letter-spacing:.06em;text-transform:uppercase;color:var(--stage-card);background:var(--stage-row);border:2px solid var(--stage-line)}
.scs .cw-tags{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.scs .cw-tags input{background:var(--stage-row);border:1px solid var(--stage-seam);padding:4px 8px;font:12px var(--font-ui);color:var(--stage-card)}
.scs .cw-star{text-align:center;padding:4px 8px 2px;display:flex;flex-direction:column;gap:6px;align-items:center}
.scs .cw-star .t{display:flex;align-items:center;gap:8px;font:800 13px var(--font-ui);letter-spacing:.2em;text-transform:uppercase;color:var(--acc-t)}
.scs .cw-star .nm{display:flex;gap:10px;align-items:center;justify-content:center;width:100%}
.scs .cw-star input{background:transparent;border:0;color:var(--stage-card);text-align:center;font:inherit;min-width:0}
.scs .cw-star .nm input{font:700 17px var(--font-ui);flex:1;max-width:16rem}
.scs .cw-star .tg2{font:13px var(--font-ui);color:var(--stage-soft);width:100%}
.scs .cw-star .pr3{display:flex;gap:8px;width:100%;justify-content:center}.scs .cw-star .pr3 input{width:30%;font:12px var(--font-mono);border-bottom:1px solid var(--stage-seam)}
.scs .cw-star .line{margin:0;font:12px var(--font-mono);color:var(--stage-soft);letter-spacing:.04em}
.scs .cw-emoji-hold{position:relative;flex:none}

/* the Prompt Injection status and Live Preview (cast-injection.tsx) */
.scs .cw-scan,.scs .cw-auto{margin:0;display:flex;gap:8px;align-items:center;font-size:13px;color:var(--stage-soft)}
.scs .cw-auto{padding:10px;color:var(--stage-ok);border:1px solid color-mix(in srgb,var(--stage-ok) 30%,transparent);background:color-mix(in srgb,var(--stage-ok) 10%,transparent)}
.scs .cw-auto b{font-weight:600}
.scs .cw-prev{border:1px solid color-mix(in srgb,var(--acc) 25%,transparent);overflow:hidden}
.scs .cw-prev .ph{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 12px;background:color-mix(in srgb,var(--acc) 10%,transparent);border-bottom:1px solid color-mix(in srgb,var(--acc) 25%,transparent)}
.scs .cw-prev .ph span{display:inline-flex;gap:8px;align-items:center;font:700 13px var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--acc-t)}
.scs .cw-prev .ph small{font-size:12px;color:var(--stage-soft)}
.scs .cw-prev pre{margin:0;padding:12px;max-height:14rem;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.6 var(--font-mono);color:var(--stage-card);background:var(--stage-black)}
.scs .cw-prev .pf{display:flex;justify-content:space-between;padding:6px 12px;background:var(--stage-row);border-top:1px solid var(--stage-seam);font:700 13px var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--stage-soft)}
.scs .cw-prev .pf b{color:var(--stage-card)}
/* the Lorebooks section and Open Full Editor */
.scs .cw-lore{border:1px solid color-mix(in srgb,var(--acc) 20%,transparent);background:linear-gradient(135deg,color-mix(in srgb,var(--acc) 5%,transparent),var(--stage-well) 50%)}
.scs .cw-lore-b,.scs .cw-chips{font-family:var(--font-ui)}
.scs .cw-lore-b{text-transform:none;letter-spacing:normal}
.scs .cw-lore-b{display:flex;flex-direction:column;gap:10px;padding:0 16px 16px}
.scs .cw-lore-k{margin:0;display:flex;align-items:center;gap:4px;font:12px var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--stage-mute)}
.scs .cw-lore-none{margin:0;padding:16px 0;text-align:center;font-size:12px;color:var(--stage-mute)}.scs .cw-lore-none b{display:block;margin-bottom:4px;font-weight:600}
.scs .cw-lb{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid var(--stage-line);background:var(--stage-row)}
.scs .cw-lb.off{opacity:.6;background:var(--stage-well);border-color:var(--stage-seam)}
.scs .cw-lb>div{min-width:0}.scs .cw-lb b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:500;color:var(--stage-card)}.scs .cw-lb small{font-size:12px;color:var(--stage-mute)}
.scs .cw-lb .acts{display:flex;align-items:center;gap:8px}
.scs .cw-sw2{position:relative;flex:none;width:40px;height:20px;padding:0;background:var(--stage-line);border:0;border-radius:10px;cursor:pointer}
.scs .cw-sw2 i{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--stage-card);transition:transform .15s}.scs .cw-sw2.on{background:var(--stage-ok)}.scs .cw-sw2.on i{transform:translateX(20px)}
.scs .cw-lore-man{margin:0;text-align:center;font-size:12px;color:var(--stage-mute)}
/* RoleCall's Cast wing is 1000px on a desktop pane (page.tsx getLeftPanelWidth, left-cast) */

/* the footer */
.scs .cw-foot{position:sticky;bottom:0;z-index:2;padding:16px;border-top:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);display:flex;flex-direction:column;gap:8px;background:var(--stage-panel)}
.scs .cw-note{margin:0;padding:6px 10px;border-left:4px solid var(--stage-warn);background:color-mix(in srgb,var(--stage-warn) 10%,transparent);font-size:12px;line-height:1.45;color:var(--stage-card)}
.scs .cw-note.saved{border-left-color:var(--stage-ok)}.scs .cw-note.failed,.scs .cw-note.stale{border-left-color:var(--stage-danger-text)}
.scs .cw-note.busy{border-left-color:var(--stage-var)}.scs .cw-note.hint{border-left-color:var(--stage-line);background:transparent;color:var(--stage-soft)}

/* the Casting Call */
.scs .cw-cc{position:relative;flex:none;align-self:flex-end;margin:10px 12px 0;width:min(21rem,calc(100% - 24px));z-index:70;background:var(--stage-black);border:2px solid var(--stage-black);box-shadow:6px 6px 0 0 color-mix(in srgb,var(--stage-black) 60%,transparent),0 0 0 1px var(--stage-line);padding:14px;--acc:var(--deck-persona);display:flex;flex-direction:column;gap:10px}
.scs .cw-cc .hd{text-align:center;padding-bottom:8px;border-bottom:1px dashed var(--stage-line)}
.scs .cw-cc .hd b{display:block;font:500 12px var(--font-fancy);letter-spacing:.3em;text-transform:uppercase;color:var(--acc-t)}
.scs .cw-cc .hd span{display:block;margin-top:3px;font-size:12px;color:var(--stage-mute)}
.scs .cw-cc .srch{display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--stage-row);border:1px solid var(--stage-seam);color:var(--stage-mute)}
.scs .cw-cc .srch input{flex:1;min-width:0;background:transparent;border:0;color:var(--stage-card);font:12px var(--font-ui)}
.scs .cw-cc .grid{display:grid;grid-template-columns:repeat(var(--cols,4),1fr);gap:8px;max-height:11rem;overflow-y:auto}
.scs .cw-cc [data-control="tile"]{aspect-ratio:3/4;height:auto;width:auto;display:flex;flex-direction:column;gap:0;padding:0;border:1px solid var(--stage-seam);background:var(--stage-well)}
.scs .cw-cc [data-control="tile"] [data-slot="mark"]{flex:1;min-height:0;display:grid;place-items:center;overflow:hidden;background:var(--stage-row)}
.scs .cw-cc [data-control="tile"] .ph{display:grid;place-items:center;overflow:hidden}
.scs .cw-cc [data-control="tile"] .ph img{width:100%;height:100%;object-fit:cover}
.scs .cw-cc [data-control="tile"] .fb,.scs .cw-cc .lead .fb{font:1.4rem var(--font-fancy);color:var(--stage-card)}
.scs .cw-cc [data-control="tile"] [data-slot="caption"]{padding:3px 2px;text-align:center;font:12px var(--font-mono);letter-spacing:.04em;text-transform:uppercase;color:var(--stage-mute)}
.scs .cw-cc [data-control="tile"]::before{content:"";position:absolute;top:-4px;left:50%;width:8px;height:8px;margin-left:-4px;background:var(--stage-danger-text);opacity:.7;z-index:2}
.scs .cw-cc [data-control="tile"][data-selected]{outline:2px solid var(--acc);outline-offset:1px}.scs .cw-cc [data-control="tile"][data-selected] [data-slot="caption"]{color:var(--acc-t)}
.scs .cw-cc [data-control="tile"] [data-slot="badge"]{top:4px;right:4px;width:7px;height:7px;min-width:0;padding:0;background:var(--stage-warn)}
.scs .cw-cc .lead{display:flex;gap:10px;padding:10px;background:var(--stage-well);border:1px solid var(--stage-seam)}
.scs .cw-cc .lead .ph{width:40px;height:54px;flex:none;display:grid;place-items:center;overflow:hidden;background:var(--stage-row);border:1px solid var(--stage-line)}
.scs .cw-cc .lead .ph img{width:100%;height:100%;object-fit:cover}
.scs .cw-cc .lead .k{font:12px var(--font-mono);letter-spacing:.2em;text-transform:uppercase;color:var(--stage-mute)}
.scs .cw-cc .lead .n{margin-top:3px;font:13px var(--font-fancy);color:var(--stage-card)}
.scs .cw-cc .lead .s{margin-top:3px;font-size:12px;color:var(--stage-mute)}.scs .cw-cc .lead .s b{color:var(--acc-t)}
.scs .cw-cc .lead .q{margin-top:4px;font-size:12px;font-style:italic;color:var(--stage-mute)}
.scs .cw-cc .cw-acts{display:flex;gap:8px}
.scs .cw-cc .empty{padding:14px;text-align:center;font-size:12px;line-height:1.5;color:var(--stage-soft)}.scs .cw-cc .empty b{display:block;color:var(--stage-card);margin-bottom:4px}
.scs .cw-create{display:flex;flex-direction:column;gap:10px}.scs .cw-create h3{margin:0;font:800 15px var(--font-ui);color:var(--stage-card)}.scs .cw-create .hint{margin:0;font-size:12px;color:var(--stage-soft)}
.scs .cw-create .cw-acts{justify-content:flex-end}

/* the transcript's swap line, like the cut line */
.scs .swapline{display:flex;align-items:center;gap:10px;max-width:768px;margin:6px auto 14px;font:12px var(--font-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--stage-mute)}
.scs .swapline::before,.scs .swapline::after{content:"";flex:1;height:1px;background:var(--stage-seam)}
.scs .swapline b{color:var(--bk-persona-accent-text,color-mix(in srgb,var(--deck-persona) 40%,var(--stage-card)))}

@container cwing (max-width:48rem){
.scs .cw-body{flex-direction:column;min-height:0}
.scs .cw-por{width:auto;height:12rem;flex:none}
.scs .cw-form{flex:none;min-height:0}
.scs .cw-scroll{overflow:visible}
}
`;
