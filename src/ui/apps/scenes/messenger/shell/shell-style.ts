/**
 * The sidebar's own additions (backlog slices 4, 22 and 30): the More button on a scene row (shown on hover and focus, always on a touch screen), the muted mark, and the Casting Call that opens
 * above the user panel.
 */
const M = ":root .scs .msn";

export const SHELL_STYLE = `
${M} .msn-more{display:flex;opacity:0}
${M} .msn-scn:is(:hover,:focus-within) .msn-more,${M} .msn-more:focus-within{opacity:1}
@media (hover:none){${M} .msn-more{opacity:1}}
${M} .msn-ubar{position:relative}
${M} .msn-swap{position:absolute;left:0;right:0;bottom:100%;z-index:80;display:flex;flex-direction:column}
${M} .msn-swap-note{margin:6px 12px 0;font-size:12px;color:var(--msg-mute)}
`;
