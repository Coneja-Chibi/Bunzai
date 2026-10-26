/**
 * The Messenger skin for the shared scene content its panels place (approved wireframe messenger-discord/panels.html): the
 * same editors Full Chat draws in its wings, worn the Messenger way. It only re-points tokens and the shared hooks: the
 * display fonts become the body font, the stamp shadow goes flat, controls take the Messenger radius, and the wing hero
 * (`header.hero`, one markup across the wings) becomes a plain page heading. No rule names a wing's own classes.
 */
const M = ":root .scs .msn";

export const MESSENGER_SKIN_STYLE = `
${M}{--font-fancy:var(--font-body);--font-big:var(--font-body);--stamp-shadow:transparent}
${M} :is([data-control="button"],[data-control="icon"],[data-control="chip"],[data-control="segmented"],[data-control="card"],[data-control="tile"],[data-control="row"]){border-radius:var(--msn-radius,8px)}
${M} :is([data-control="button"],[data-control="icon"]):hover:not(:disabled){transform:none}
${M} header.hero{padding:4px 0 12px;border:0;border-bottom:1px solid var(--msg-divider);box-shadow:none;background:none}
${M} header.hero .hi{display:none}
${M} header.hero h2{font:800 20px/1.25 var(--font-body);letter-spacing:0;text-transform:none;color:var(--msg-bright)}
${M} header.hero h2 em{font-style:normal}
${M} header.hero p{font-size:13px;line-height:1.5;color:var(--msg-mute)}
`;
