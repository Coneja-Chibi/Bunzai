/**
 * The Compendium's Browse tab and entry page (RoleCall `BrowsePanel`, `sidebar/*`, `CodexDetailPane`, `details/_shared.tsx`):
 * the 30% Catalogue (260 to 380px) with its virtual list, the "Select an entry" card, the page hero, the field blocks,
 * tiles, chips, rows, Linked Entries. A type's colour arrives as `--tc` from the core's token table. Below 600px the two panes
 * show one at a time. Type is RoleCall's own, 9 to 11px included. Container queries only.
 */
export const COMPENDIUM_BROWSE_STYLE = `
.scs .cp-browse{flex:1;min-height:0;display:flex;background:var(--stage-well)}
.scs .cp-browse .side{width:30%;min-width:260px;max-width:380px;min-height:0;display:flex;flex-direction:column;border-right:3px solid var(--stage-black);background:var(--stage-sunken)}
.scs .cp-browse .main{flex:1;min-width:0;min-height:0;overflow-y:auto}
.scs .cp-browse .back{display:none}
@container (max-width:600px){.scs .cp-browse .side{width:100%;max-width:none;min-width:0;border-right:0}.scs .cp-browse.has .side{display:none}.scs .cp-browse:not(.has) .main{display:none}.scs .cp-browse .back{display:block;padding:4px 8px;border-bottom:2px solid var(--stage-black);background:var(--stage-sunken)}}
.scs .cp-cat{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.scs .cp-cat .hd{flex:none;padding:10px 12px;border-bottom:2px solid var(--stage-black);background:var(--stage-black);font:900 10px var(--font-fancy);letter-spacing:.18em;text-transform:uppercase;color:var(--bk-role-info-text)}
.scs .cp-cat .se{flex:none;position:relative;display:block;padding:8px 10px;border-bottom:2px solid var(--stage-black)}
.scs .cp-cat .se svg{position:absolute;left:18px;top:50%;transform:translateY(-50%);color:var(--stage-mute)}
.scs .cp-cat .se input{width:100%;padding:6px 8px 6px 28px;border:2px solid var(--stage-black);background:var(--stage-panel);color:var(--stage-card);font-size:11px}
.scs .cp-cat .se input:focus{outline:0;border-color:var(--bk-role-info-text)}
.scs .cp-cat .subs{flex:none;display:flex;border-bottom:2px solid var(--stage-black);background:var(--stage-black)}
.scs .cp-cat .st{flex:none;padding:8px 12px;border-bottom:2px solid var(--stage-black);background:var(--stage-black);font:10px var(--font-mono);letter-spacing:.05em;text-transform:uppercase;color:var(--stage-mute)}
.scs .cp-vs{position:relative;flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}
.scs .cp-vs .in{position:relative;width:100%}
.scs .cp-vs .vr{position:absolute;top:0;left:0;width:100%}
.scs .cp-sh{display:flex;align-items:center;justify-content:space-between;height:100%;padding:0 12px;border-left:4px solid var(--tc);border-top:2px solid var(--stage-black);background:var(--stage-sunken);font:700 10px var(--font-fancy);letter-spacing:.18em;text-transform:uppercase;color:var(--stage-card)}
.scs .cp-sh em{font:10px var(--font-mono);font-style:normal;color:var(--stage-mute)}
.scs .cp-vs [data-entry-id][data-off]{opacity:.5}
.scs .cp-vs [data-entry-id] i{font:10px var(--font-mono);font-style:normal;color:var(--stage-mute)}
.scs .cp-none2{padding:48px 16px;text-align:center;font-size:14px;font-style:italic;color:var(--stage-mute)}
.scs .cp-sel{margin:32px auto;max-width:28rem;display:flex;flex-direction:column;align-items:center;gap:12px;padding:40px 48px;border:4px solid var(--stage-black);background:var(--stage-panel);box-shadow:6px 6px 0 0 var(--bk-role-info-text);color:var(--stage-mute)}
.scs .cp-sel svg{opacity:.3}
.scs .cp-sel b{font:700 10px var(--font-fancy);letter-spacing:.25em;text-transform:uppercase;color:var(--bk-role-info-text)}
.scs .cp-sel p{margin:0;text-align:center;font-size:14px;font-style:italic}
.scs .cp-page{min-height:100%;background:var(--stage-well);color:var(--stage-soft);container-type:inline-size}
.scs .cp-page .ph{padding:18px 24px;border-bottom:3px solid var(--stage-black);background:var(--stage-black)}
.scs .cp-page .crumb2 .cur{color:var(--wa)}
.scs .cp-page .pb{padding:32px 48px}
@container (max-width:700px){.scs .cp-page .ph{padding:12px 16px}.scs .cp-page .pb{padding:20px 16px}}
.scs .cp-page .hero{display:flex;gap:32px;align-items:flex-start;margin-bottom:32px}
@container (max-width:700px){.scs .cp-page .hero{flex-direction:column;align-items:stretch;gap:20px}}
.scs .cp-page .por{width:144px;aspect-ratio:3/4;flex:none;display:grid;place-items:center;border:4px solid var(--tc);box-shadow:6px 6px 0 0 var(--tc);background:linear-gradient(135deg,color-mix(in srgb,var(--tc) 22%,var(--stage-black)),var(--stage-black));font:900 2.25rem var(--font-fancy);color:var(--tc)}
@container (max-width:700px){.scs .cp-page .por{width:100%;max-width:192px;align-self:center}}
.scs .cp-page .hb{flex:1;min-width:0}
.scs .cp-page .tr{display:flex;align-items:center;gap:12px;margin-bottom:8px}
.scs .cp-page .tchip{display:inline-block;padding:3px 10px;border:2px solid var(--stage-black);background:color-mix(in srgb,var(--tc) 10%,transparent);box-shadow:2px 2px 0 0 var(--tc);font:700 11px var(--font-fancy);letter-spacing:.2em;text-transform:uppercase;color:var(--tc)}
.scs .cp-page .sub{font:12px var(--font-fancy);letter-spacing:.1em;text-transform:uppercase;color:var(--stage-mute)}
.scs .cp-page h1{margin:0 0 4px;font:900 2rem/1.25 var(--font-fancy);overflow-wrap:anywhere;color:var(--stage-card)}
@container (min-width:700px){.scs .cp-page h1{font-size:2.6rem}}
.scs .cp-page .tg{margin:0 0 16px;font-size:18px;font-style:italic;color:var(--stage-soft)}
.scs .cp-page .rule{height:3px;margin-bottom:16px;background:linear-gradient(90deg,transparent,var(--tc) 30%,var(--tc) 70%,transparent)}
.scs .cp-page .ds{margin:0;font-size:14px;line-height:1.625;color:var(--stage-soft)}
.scs .cp-fb{min-width:0;margin-bottom:16px;padding:16px 20px;border:3px solid var(--stage-black);background:var(--stage-panel);box-shadow:3px 3px 0 0 var(--stage-black)}
.scs .cp-fb .fl{display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid var(--stage-black);font:700 11px var(--font-fancy);letter-spacing:.2em;text-transform:uppercase;color:var(--wa)}
.scs .cp-fb .fl span{font-size:10px;color:var(--wa)}
.scs .cp-tiles3{display:grid;grid-template-columns:1fr;gap:0}
@container (min-width:520px){.scs .cp-tiles3{grid-template-columns:repeat(3,1fr);gap:12px}}
.scs .cp-txt{font-size:14px;white-space:pre-wrap;color:var(--stage-card)}
.scs .cp-chips{display:flex;flex-wrap:wrap;gap:6px}
.scs .cp-chips span{padding:4px 8px;border:2px solid var(--stage-black);font:700 10px var(--font-fancy);letter-spacing:.05em;text-transform:uppercase;color:var(--wa)}
.scs .cp-ors{display:flex;flex-direction:column;gap:8px}
.scs .cp-or{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:8px;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent)}
.scs .cp-or:last-child{border-bottom:0;padding-bottom:0}
.scs .cp-or .m{font-size:14px;color:var(--stage-card)}
.scs .cp-or .q{font-size:13px;font-style:italic;color:var(--stage-soft)}
.scs .cp-or .r{flex:none;font:11px var(--font-fancy);letter-spacing:.1em;text-transform:uppercase;color:var(--wa)}
.scs .cp-kv{display:flex;flex-direction:column;gap:10px;font-size:14px}
.scs .cp-kv .k{display:block;font:10px var(--font-fancy);letter-spacing:.18em;text-transform:uppercase;color:var(--stage-mute)}
.scs .cp-kv .x{color:var(--stage-card);white-space:pre-wrap}
.scs .cp-arc{display:flex;min-width:0;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:14px}
.scs .cp-arc .l{font:700 11px var(--font-fancy);letter-spacing:.14em;text-transform:uppercase;color:var(--stage-soft)}
.scs .cp-arc .c{margin-top:3px;font:italic 13px var(--font-ui);color:var(--stage-mute)}
.scs .cp-arc .pg{flex:none;display:inline-flex;align-items:baseline;gap:5px;padding:5px 8px;border:1px solid color-mix(in srgb,var(--wa) 32%,transparent);background:color-mix(in srgb,var(--wa) 7%,transparent);font:700 9px var(--font-fancy);letter-spacing:.09em;text-transform:uppercase;color:var(--stage-soft)}
.scs .cp-arc .pg strong{font-size:13px;letter-spacing:.04em;color:var(--wa)}
.scs .cp-wide{display:none;margin:-3px 0 9px;font:9px var(--font-fancy);letter-spacing:.08em;text-align:right;text-transform:uppercase;color:var(--stage-mute)}
.scs .cp-vp{min-width:0;max-width:100%}
.scs .cp-ms{display:grid;min-width:0;margin:0;padding:2px 0 0;list-style:none}
.scs .cp-ms li{position:relative;display:grid;min-width:0;grid-template-columns:22px minmax(0,1fr);gap:11px;padding:0 0 16px}
.scs .cp-ms li:last-child{padding-bottom:0}
.scs .cp-ms .tk{position:absolute;z-index:0;top:12px;bottom:-2px;left:6px;width:2px;background:linear-gradient(180deg,color-mix(in srgb,var(--stage-line) 75%,transparent),color-mix(in srgb,var(--stage-line) 35%,transparent))}
.scs .cp-ms li:last-child .tk{display:none}
.scs .cp-ms li.done .tk{background:linear-gradient(180deg,var(--wa),color-mix(in srgb,var(--wa) 45%,transparent))}
.scs .cp-ms .mk{position:relative;z-index:1;width:14px;height:14px;margin-top:3px;border:2px solid var(--stage-line);border-radius:var(--rc-radius-full);background:var(--stage-sunken);box-shadow:0 0 0 3px var(--stage-panel)}
.scs .cp-ms li.done .mk{border-color:var(--wa);background:var(--wa)}
.scs .cp-ms li.cur .mk{border-color:var(--stage-card);background:var(--wa);box-shadow:0 0 0 3px var(--stage-panel),0 0 15px color-mix(in srgb,var(--wa) 82%,transparent);transform:scale(1.14)}
.scs .cp-ms .mb{min-width:0;padding:8px 10px 9px;border:1px solid color-mix(in srgb,var(--stage-mute) 18%,transparent);border-left:3px solid var(--stage-line);background:color-mix(in srgb,var(--stage-black) 19%,transparent)}
.scs .cp-ms li.done .mb{border-left-color:color-mix(in srgb,var(--wa) 62%,transparent)}
.scs .cp-ms li.cur .mb{border-color:color-mix(in srgb,var(--wa) 38%,transparent);border-left-color:var(--wa);background:linear-gradient(105deg,color-mix(in srgb,var(--wa) 13%,transparent),color-mix(in srgb,var(--wa) 3%,transparent));box-shadow:2px 2px 0 color-mix(in srgb,var(--stage-black) 70%,transparent)}
.scs .cp-ms li:not(.done):not(.cur) .mb{opacity:.72}
.scs .cp-ms .mb i{display:block;margin-bottom:3px;font:700 9px var(--font-fancy);font-style:normal;letter-spacing:.16em;color:var(--stage-mute)}
.scs .cp-ms li.cur .mb i{color:var(--wa)}
.scs .cp-ms .mb span{display:block;min-width:0;overflow-wrap:anywhere;font:italic 14px/1.35 var(--font-ui);color:var(--stage-soft)}
.scs .cp-ms li.cur .mb span{font-weight:600;color:var(--wa)}
@container (min-width:601px){
.scs .cp-wide{display:block}
.scs .cp-vp{overflow-x:auto;overscroll-behavior-x:contain;padding:3px 2px 12px;scroll-snap-type:x proximity;scrollbar-gutter:stable;touch-action:pan-x}
.scs .cp-ms{display:flex;width:max-content;min-width:100%;padding-top:5px}
.scs .cp-ms li{flex:1 0 11.5rem;grid-template-columns:1fr;grid-template-rows:20px auto;gap:7px;align-content:start;padding:0 14px 0 0;scroll-snap-align:start}
.scs .cp-ms li:last-child{padding-right:0}
.scs .cp-ms .tk{top:7px;right:-7px;bottom:auto;left:7px;width:auto;height:2px;background:linear-gradient(90deg,color-mix(in srgb,var(--stage-line) 75%,transparent),color-mix(in srgb,var(--stage-line) 35%,transparent))}
.scs .cp-ms li.done .tk{background:linear-gradient(90deg,var(--wa),color-mix(in srgb,var(--wa) 45%,transparent))}
.scs .cp-ms .mk{margin-top:0}
.scs .cp-ms .mb{min-height:90px;padding:10px 11px;border-top:3px solid var(--stage-line);border-left:1px solid color-mix(in srgb,var(--stage-mute) 18%,transparent)}
.scs .cp-ms li.done .mb{border-top-color:color-mix(in srgb,var(--wa) 62%,transparent);border-left-color:color-mix(in srgb,var(--stage-mute) 18%,transparent)}
.scs .cp-ms li.cur .mb{border-top-color:var(--wa);border-left-color:color-mix(in srgb,var(--wa) 38%,transparent)}
}
.scs .cp-quiet{margin:0 0 16px;font-size:14px;font-style:italic;color:var(--stage-mute)}
.scs .cp-linked{margin-top:16px;padding:16px;display:flex;flex-direction:column;gap:16px;border-radius:var(--rc-radius-sm);border:1px solid color-mix(in srgb,var(--wa) 15%,transparent);background:color-mix(in srgb,var(--wa) 3%,transparent)}
.scs .cp-linked .ln{font:700 11px var(--font-fancy);letter-spacing:.25em;text-transform:uppercase;color:var(--wa)}
.scs .cp-page .lt{margin-bottom:8px;font:10px var(--font-fancy);letter-spacing:.2em;text-transform:uppercase;color:var(--stage-soft)}
.scs .cp-linked .lr{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.scs .cp-linked .lr>span{flex:none;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--stage-mute)}
.scs .cp-linked .lr>div{display:flex;flex-wrap:wrap;gap:6px;flex:1}
`;
