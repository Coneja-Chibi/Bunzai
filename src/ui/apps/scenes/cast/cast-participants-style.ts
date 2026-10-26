/**
 * The Participants tab's styles (RoleCall's ParticipantRegistryPanel.tsx, drawn from its live screenshots): the stat tiles, the Reconcile
 * card, the section headings, and a participant row with its swatch, chips, registry lines and action buttons. Tokens only,
 * RoleCall's own type sizes; the only colours that are not tokens are the participants' own, set inline as data.
 */
export const PARTICIPANTS_STYLE = `
.scs .cw-reg{display:flex;flex-direction:column;gap:12px;padding:12px}
.scs .cw-reg .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.scs .cw-reg .stat{border:1px solid var(--stage-line);background:var(--stage-sunken);padding:8px 12px}
.scs .cw-reg .stat small{display:block;font:700 10px var(--font-ui);letter-spacing:.16em;text-transform:uppercase;color:var(--stage-mute)}
.scs .cw-reg .stat b{display:block;margin-top:4px;font-size:1.25rem;font-weight:700;color:var(--stage-card)}
.scs .cw-reg .recon{border:1px solid var(--stage-line);background:var(--stage-sunken);padding:12px}
.scs .cw-reg .recon .top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px}
.scs .cw-reg .recon h3,.scs .cw-reg .sec>h3{margin:0;font:700 11px var(--font-ui);letter-spacing:.18em;text-transform:uppercase;color:var(--stage-card)}
.scs .cw-reg .recon p{margin:4px 0 0;font-size:12px;color:var(--stage-mute)}
.scs .cw-reg .recon .ctl{display:flex;align-items:center;gap:8px;min-width:220px;flex:1 1 220px;max-width:340px}
.scs .cw-reg .recon output{width:3rem;text-align:right;font-family:var(--font-mono);font-size:12px;color:var(--stage-card)}
.scs .cw-reg .recon .st{margin-top:8px;font-size:12px;color:var(--stage-soft)}
.scs .cw-reg .recon .found{margin-top:10px;border-top:1px solid var(--stage-seam);padding-top:10px;display:flex;flex-direction:column;gap:6px}
.scs .cw-reg .recon .found label{display:flex;gap:8px;align-items:baseline;font-size:12px;color:var(--stage-card)}
.scs .cw-reg .recon .found label small{color:var(--stage-mute)}
.scs .cw-reg .sec{margin-top:4px}
.scs .cw-reg .sec>h3{margin-bottom:8px}
.scs .cw-reg .none{border:1px dashed var(--stage-line);background:var(--stage-sunken);padding:16px 12px;font-size:12px;color:var(--stage-mute)}
.scs .cw-reg .rows{display:flex;flex-direction:column;gap:8px}
.scs .cw-reg .prow{border:1px solid var(--stage-line);background:var(--stage-row);padding:12px;display:flex;gap:12px;align-items:flex-start}
.scs .cw-reg .prow.main{border-color:color-mix(in srgb,var(--acc) 60%,transparent)}
.scs .cw-reg .prow .sw{width:32px;height:32px;flex:none;margin-top:2px;border:1px solid var(--stage-line);background:var(--stage-sunken)}
.scs .cw-reg .prow .bd{min-width:0;flex:1}
.scs .cw-reg .prow .hd{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.scs .cw-reg .prow .nm{min-width:220px;flex:1;background:transparent;border:0;border-bottom:1px solid transparent;outline:0;font:700 14px var(--font-ui);color:var(--stage-card);padding:0}
.scs .cw-reg .prow .nm:focus{border-bottom-color:var(--acc)}
.scs .cw-reg .chip{flex:none;border:1px solid var(--stage-line);padding:2px 6px;font:700 9px var(--font-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--stage-mute)}
.scs .cw-reg .chip.on{border-color:color-mix(in srgb,var(--acc) 40%,transparent);background:color-mix(in srgb,var(--acc) 14%,transparent);color:var(--acc-t)}
.scs .cw-reg .lines{margin-top:4px;display:grid;gap:4px;font-size:11px;color:var(--stage-mute)}
.scs .cw-reg .lines div{display:flex;gap:8px;align-items:center;min-width:0}
.scs .cw-reg .lines dt{width:3rem;flex:none;font:700 10px var(--font-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--stage-faint)}
.scs .cw-reg .lines dd{margin:0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-mono);color:var(--stage-soft)}
.scs .cw-reg .acts{margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start}
.scs .cw-reg select{font:700 10px var(--font-ui);letter-spacing:.12em;text-transform:uppercase;padding:6px 8px;border:1px solid var(--stage-line);background:var(--stage-sunken);color:var(--stage-soft);cursor:pointer}
.scs .cw-reg .anch{border:1px solid var(--stage-seam);padding:6px 8px;font:700 10px var(--font-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--stage-mute)}
.scs .cw-reg .anch.card{border-color:color-mix(in srgb,var(--acc) 30%,transparent);color:var(--acc-t)}
.scs .cw-reg .scene{display:flex;align-items:center;gap:8px;border:1px solid color-mix(in srgb,var(--deck-persona) 30%,transparent);background:color-mix(in srgb,var(--deck-persona) 8%,transparent);padding:2px 8px;font:700 10px var(--font-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--stage-card)}
.scs .cw-reg .scene select{border:0;background:transparent;padding:4px 0}
.scs .cw-reg .colors{display:flex;flex-direction:column;gap:4px}
.scs .cw-reg .colors .box{display:flex;align-items:center;gap:8px;border:1px solid var(--stage-line);background:var(--stage-sunken);padding:4px 8px;font:700 10px var(--font-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--stage-mute)}
.scs .cw-reg .colors .box.off{opacity:.45}
.scs .cw-reg .colors .stop{width:28px;height:20px;border:1px solid var(--stage-line)}
.scs .cw-reg .colors small{font-size:10px;line-height:1.2;color:var(--stage-faint)}
.scs .addp{display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.scs .addp.open{align-items:stretch;border:1px solid var(--stage-line);background:var(--stage-sunken);padding:12px}
.scs .addp input{background:var(--stage-row);border:1px solid var(--stage-line);padding:6px 8px;font:14px var(--font-ui);color:var(--stage-card)}
.scs .addp input:focus{outline:0;border-color:var(--acc)}
.scs .addp .addp-err{margin:0;font-size:12px;color:var(--stage-soft)}
.scs .addp .acts{display:flex;gap:8px}
`;
