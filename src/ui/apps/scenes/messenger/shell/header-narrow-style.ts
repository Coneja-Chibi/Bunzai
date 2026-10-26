/** The narrow header and the member drawer's scrim (backlog slice 8). The drawer itself is `.msn-mem` in messenger-style.ts; the scrim covers the body behind it. */
const M = ":root .scs .msn";

export const HEADER_NARROW_STYLE = `
${M} .msn-body>[data-part="scene.messenger.members.scrim"]{z-index:59;background:var(--msg-dim)}
`;
