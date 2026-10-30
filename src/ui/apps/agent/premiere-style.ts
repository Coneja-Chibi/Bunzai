/**
 * The docked Agent window in the Premiere house style (design/wireframes/premiere/agent.html). Every rule is scoped to
 * the docked root, so the floating Kit panel, which shares the transcript and widgets, keeps its own look. Kit's colors
 * arrive remapped onto theme roles by premiere-frame.tsx; what is left here is structure: spines, spacing, type, hover.
 * Layout is today's single column. Gold trim is --premiere-gold, rose is --accent, violet is --bk-role-select.
 */
const R = '.agent-room[data-room="docked"]';

export const AGENT_PREMIERE_STYLE = `
${R}{padding:0;height:calc(100% - 5px);margin:0 5px 5px 0;border-top-color:var(--accent);color:var(--text);
  font-family:var(--font-ui);--dim:var(--text-dim);--hair:color-mix(in srgb,var(--text) 14%,transparent);
  background:color-mix(in srgb,var(--bk-role-select) 5%,var(--bk-surface-panel))}

/* header strip: the shared RoomHeader, the fold key at the top right */
${R} .agent-room__head{background:none;border:0;padding:18px 56px 0 28px;flex:none}
${R} .agent-room__head [data-control="room-header"]{margin:0;padding:0 0 18px}
${R} .agent-room__head [data-control="room-header"] h1{margin:0;font:700 clamp(30px,3.6vw,52px)/1.05 var(--font-fancy);letter-spacing:.02em;color:var(--text)}
${R} .agent-room__fold{position:absolute;top:12px;right:14px;z-index:1}
${R} .agent-room__fold[data-folded]{position:static;align-self:flex-end;padding:8px 14px 0}
${R} .agent-room__dot{width:9px;height:9px;flex:none;border-radius:50%;background:none;box-shadow:inset 0 0 0 2px var(--dim)}
${R} .agent-room__dot--live{background:var(--accent);box-shadow:0 0 10px var(--accent)}

/* meter strip and notice */
${R} .kit-meterbar{padding:10px 28px;gap:8px 22px;font-size:13px;background:color-mix(in srgb,var(--bk-role-select) 7%,transparent);
  border-bottom:1px solid var(--hair)}
${R} .kit-meter > .kit-meter__label:first-child{color:var(--premiere-gold);font-weight:600}
${R} .kit-meter__crit{color:var(--bk-role-danger-text);font-weight:700}
${R} .agent-room__notice{padding:14px 28px;border-left:4px solid var(--premiere-gold);border-bottom:1px solid var(--hair);
  background:color-mix(in srgb,var(--premiere-gold) 9%,transparent);color:var(--text)}

/* transcript: full-width bands with a 4px spine */
${R} .agent-room__talk{gap:8px;padding:18px 0 12px;background:none}
${R} .agent-room__empty{padding:34px 20px;text-align:center;font-style:normal;color:var(--dim)}
${R} .agent-room__line{--spine:var(--bk-role-select);--spine-text:var(--bk-role-select-text);--band:color-mix(in srgb,var(--stage-black) 42%,transparent);
  padding:12px 28px 12px 24px;border-left-width:4px;background:var(--band);transition:background .2s}
${R} .agent-room__line--user{--spine:var(--accent);--spine-text:var(--bk-role-brand-text);--band:var(--kit-lift);border-left-color:var(--spine)}
${R} .agent-room__line--assistant{border-left-color:var(--spine)}
${R} .agent-room__line--tool{padding-block:9px;--spine:var(--text-dim);--spine-text:var(--text-dim)}
${R} .agent-room__line--kit{padding:8px 28px;border-left-width:0;background:none}
${R} .agent-room__line:not(.agent-room__line--kit):hover{background:color-mix(in srgb,var(--spine) 9%,var(--band))}
${R} .agent-room__who{display:block;font:700 12px/1 var(--font-ui);letter-spacing:.16em;margin-bottom:8px;color:var(--spine-text)}
${R} .agent-room__said,${R} .agent-room__line--tool .agent-room__said{font:inherit;font-size:14px;color:var(--text)}
${R} .kit-md__head{font:700 15px/1.3 var(--font-fancy);letter-spacing:.02em;color:var(--text)}
${R} .kit-md__mark{color:var(--premiere-gold)}
${R} .kit-md__code{font-size:13px;padding:1px 5px}
${R} .kit-fold{padding:2px 28px 2px 34px}
${R} .kit-fold__dot{color:var(--premiere-gold)}
${R} .kit-error{margin:0;padding:12px 28px 12px 24px;border-left-width:4px;background:color-mix(in srgb,var(--accent) 14%,transparent)}
${R} .kit-toast{align-self:flex-start;margin:4px 28px 8px;padding:5px 14px;font:inherit;font-size:13px;background:var(--stage-black);
  border:1px solid color-mix(in srgb,var(--premiere-gold) 40%,transparent);box-shadow:3px 3px var(--stage-black)}
${R} .kit-toast__dot{color:var(--accent)}

/* choice card: an open column with one violet edge, options nudge on hover, the pick is rose-edged */
${R} .kit-ask{margin:12px 0 2px;padding:6px 0 0 14px;max-width:880px;border-left:3px solid var(--bk-role-select);background:none}
${R} .kit-ask__head{background:none;padding:0;font:700 12px var(--font-ui);letter-spacing:.18em;text-transform:uppercase;color:var(--premiere-gold)}
${R} .kit-ask__q{padding:10px 0 12px;font:700 19px/1.3 var(--font-fancy);letter-spacing:.01em}
${R} .kit-ask__opt{border-left:4px solid transparent;transition:background .2s,border-color .2s,transform .2s}
${R} .kit-ask__opt:hover{background:color-mix(in srgb,var(--bk-role-select) 12%,transparent);border-left-color:var(--bk-role-select);transform:translateX(3px)}
${R} .kit-ask__opt--on{background:color-mix(in srgb,var(--accent) 15%,transparent);border-left-color:var(--accent)}
${R} .kit-ask__opt > [data-control="row"]{font-family:var(--font-ui);font-size:15px;padding:9px 12px}
${R} .kit-ask__caret{color:var(--accent);font-weight:700}
${R} .kit-ask__num{font-family:var(--font-mono);font-size:13px}
${R} .kit-ask__val{font-weight:600;color:var(--text)}
${R} .kit-ask__esc{font-style:normal;color:var(--text-soft)}
${R} .kit-ask__note{font-size:13px;padding:0 12px 6px 3.1rem}
${R} .kit-ask__rule{margin:8px 0;background:color-mix(in srgb,var(--premiere-gold) 35%,transparent)}
${R} .kit-ask__own,${R} .kit-ask__noteField{margin:8px 0 0;width:100%;font-size:13px}
${R} .kit-ask__arm,${R} .kit-ask__arm--ready{margin-top:14px;padding:14px 0 0;background:none;
  border-top:1px dashed color-mix(in srgb,var(--premiere-gold) 45%,transparent);font-size:13px}
${R} .kit-ask__armText{font-family:var(--font-ui);font-size:13px}
${R} .kit-ask--done{padding:10px 0 10px 14px;border-left-color:var(--hair)}
${R} .kit-ask__q--done{font:500 14px var(--font-ui);padding:0}
${R} .kit-ask__said{padding:2px 0 0;color:var(--premiere-gold);font-weight:600}

/* live widgets */
${R} .kit-stagehand{padding:4px 28px 4px 34px;font:inherit;font-size:14px;gap:12px;color:var(--dim)}
${R} .kit-stamp{background:var(--accent-deep);font-size:12px;padding:2px 8px;color:var(--bk-text-on-deep)}
${R} .kit-rehearsal{margin:0 28px;padding:12px 16px;border:0;border-left:4px solid var(--bk-role-select);
  background:color-mix(in srgb,var(--bk-role-select) 7%,transparent)}
${R} .kit-rehearsal__head{padding:0 0 6px;font:700 12px var(--font-ui);letter-spacing:.16em;text-transform:uppercase;color:var(--bk-role-select-text)}
${R} .kit-rehearsal__text{padding:0;font:italic 14px/1.5 var(--font-ui);color:var(--text-soft)}
${R} .kit-trace__full{font:14px/1.5 var(--font-ui)}
${R} .kit-watch{margin:0 28px;padding:10px 16px;border:0;border-left:4px solid var(--premiere-gold);
  background:color-mix(in srgb,var(--premiere-gold) 8%,transparent)}
${R} .kit-watch__head{padding:0;font:700 12px var(--font-ui);letter-spacing:.16em;color:var(--premiere-gold)}
${R} .kit-watch__text{padding:2px 0 0;font-size:14px;color:var(--text)}

/* chips, queue, composer, hints, brief */
${R} .agent-room__chips{padding:4px 28px 12px;gap:8px}
${R} .agent-room__queue{padding:0 28px 10px;gap:6px}
${R} .agent-room__queue li{flex-wrap:wrap;gap:8px 12px;padding:8px 12px;border:1px dashed color-mix(in srgb,var(--premiere-gold) 50%,transparent);
  border-left:4px solid var(--premiere-gold);background:color-mix(in srgb,var(--premiere-gold) 5%,transparent)}
${R} .agent-room__queuekick{font:700 12px var(--font-ui);letter-spacing:.14em;color:var(--premiere-gold)}
${R} .agent-room__queuetext{flex:1 1 200px;font-size:14px;color:var(--text)}
${R} .agent-room__compose{padding:4px 28px 6px}
${R} .agent-room__shots{padding:0 0 12px;gap:12px}
${R} .agent-room__composer{padding:0;border:3px solid var(--stage-black);box-shadow:5px 5px var(--stage-black);
  background:color-mix(in srgb,var(--bk-role-select) 6%,var(--stage-black));transition:box-shadow .25s,border-color .25s}
${R} .agent-room__composer:focus-within{border-color:var(--premiere-gold)}
${R} .agent-room__composer::before{padding:0 16px;font-size:17px;border:0;background:var(--agent-action)}
${R} .agent-room__composer textarea{min-height:66px;padding:12px 16px;border:0;background:none;font-size:15px}
${R} .agent-room__composer > [data-control="button"]{align-self:center;margin:0 10px}
${R} .kit-sweep{top:-3px;left:-3px;right:-3px;height:3px}
${R} .kit-slash{left:28px;right:28px;bottom:calc(100% - 2px);border:3px solid var(--stage-black);border-top-color:var(--bk-role-select);
  background:color-mix(in srgb,var(--stage-black) 93%,var(--bk-role-select));box-shadow:5px 5px var(--stage-black)}
${R} .kit-slash__head{padding:8px 14px;font:700 12px var(--font-ui);letter-spacing:.16em;color:var(--premiere-gold)}
${R} .kit-slash [data-control="menuitem"]{padding:8px 14px;border-left:4px solid transparent}
${R} .kit-slash [data-control="menuitem"][aria-selected="true"]{background:color-mix(in srgb,var(--accent) 20%,transparent);border-left-color:var(--accent)}
${R} .kit-slash__word{font-size:13px;color:var(--premiere-gold)}
${R} .kit-slash__say{font-size:14px}
${R} .kit-hints{padding:12px 28px 8px;gap:6px 22px;font:inherit;font-size:13px;color:var(--dim)}
${R} .kit-hints__key{margin-right:6px;padding:1px 7px;font:600 12px var(--font-mono);color:var(--premiere-gold);
  border:1px solid color-mix(in srgb,var(--premiere-gold) 50%,transparent);background:var(--stage-black)}
${R} .kit-hints__label{color:var(--dim)}
${R} .agent-room__block{padding:4px 28px 22px}
${R} .agent-room__block summary{display:inline-flex;align-items:center;gap:8px;list-style:none;padding:6px 0;font:600 14px var(--font-ui);
  letter-spacing:0;text-transform:none;color:var(--text)}
${R} .agent-room__block summary::-webkit-details-marker{display:none}
${R} .agent-room__block summary::before{content:"\\25B8";color:var(--premiere-gold);transition:transform .2s}
${R} .agent-room__block[open] summary::before{transform:rotate(90deg)}
${R} .agent-room__block summary:hover{color:var(--premiere-gold)}
${R} .agent-room__brief{background:var(--stage-black);border-color:var(--hair);font-size:13px}

/* command output keeps Kit's grammar, on the room's ink */
${R} .kit-list,${R} .kit-doctor,${R} .kit-shelf{padding:8px 0 8px 14px}
${R} .kit-list__head{font:700 12px var(--font-ui);letter-spacing:.16em;color:var(--premiere-gold)}
${R} .kit-doctor__mark{font-family:var(--font-ui);font-weight:700}

@media (prefers-reduced-motion:reduce){
  ${R} .agent-room__line,${R} .kit-ask__opt,${R} .agent-room__composer,${R} .agent-room__block summary::before{transition:none}
  ${R} .kit-ask__opt:hover{transform:none}
}
`;
