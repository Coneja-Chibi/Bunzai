/** In-scene search panel, the ringed hit, and Jump to latest (ports of RoleCall's ChatSearchOverlay and SceneJumpToLatestButton). */
export const FIND_STYLE = `
.scs .find{position:absolute;top:52px;left:50%;transform:translateX(-50%);z-index:55;width:min(520px,calc(100% - 32px));display:flex;flex-direction:column;max-height:calc(100% - 120px);background:var(--stage-panel);color:var(--stage-card);border:3px solid var(--stage-black);box-shadow:5px 5px 0 0 var(--stage-black);font-family:var(--font-big)}
.scs .find input:focus-visible{outline:2px solid var(--focus-ring);outline-offset:-2px}
.scs .find .fhd{padding:12px 14px;border-bottom:1px solid var(--stage-seam)}
.scs .find .frow{display:flex;align-items:center;gap:10px;color:var(--accent)}
.scs .find input{flex:1;min-width:0;padding:4px 0;border:0;outline:0;background:none;color:var(--stage-card);font:var(--text-control) var(--font-body);font-variant:normal;text-transform:none;letter-spacing:0}
.scs .find input::placeholder{color:var(--stage-mute);opacity:1}
.scs .find .fnav{display:flex;align-items:center;gap:4px;padding-left:10px;border-left:1px solid var(--stage-seam);color:var(--stage-soft)}
.scs .find .fct{margin-right:4px;font:var(--text-meta) var(--font-mono);color:var(--stage-card);font-variant-numeric:tabular-nums}
.scs .find .fsort{display:flex;align-items:center;gap:6px;margin-top:8px;padding-left:26px}
.scs .find .fsort small{font:var(--text-meta) var(--font-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--stage-mute)}
.scs .find .ffil{display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px;border-bottom:1px solid var(--stage-seam)}
.scs .find .ffil .n{margin-left:4px;opacity:.75}
.scs .find .fres{overflow-y:auto;min-height:0;max-height:20rem}
.scs .find .fnone{margin:0;padding:20px;text-align:center;font:var(--text-body) var(--font-mono);color:var(--stage-mute)}
.scs .find [data-control="row"] .who{display:flex;align-items:center;gap:10px;margin-bottom:4px;font:700 var(--text-meta) var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--sp)}
.scs .find [data-control="row"] .who .ftag{padding:1px 6px;font-style:normal;font-weight:400;letter-spacing:.04em;border:1px solid color-mix(in srgb,var(--sp) 40%,transparent)}
.scs .find [data-control="row"] .who small{margin-left:auto;font-weight:400;letter-spacing:0;text-transform:none;color:var(--stage-mute)}
.scs .find [data-control="row"] .ctx{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;padding-left:12px;font:var(--text-body)/1.5 var(--font-mono);color:var(--stage-soft);overflow-wrap:anywhere}
.scs .find [data-control="row"] mark{background:none;color:var(--stage-card);font-weight:700;border-bottom:2px solid var(--accent)}
.scs .find [data-control="row"] .act{font-style:italic;color:var(--stage-mute)}
.scs .find .fst{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 12px;padding:8px 14px;border-top:1px solid var(--stage-seam);background:var(--stage-row);font:var(--text-meta) var(--font-mono);color:var(--stage-soft)}
.scs .find .fst kbd{padding:1px 6px;margin:0 2px 0 8px;background:var(--stage-faint);color:var(--stage-card);font:inherit}
.scs .msg[data-hit] .bub{outline:2px solid var(--accent);outline-offset:-2px;box-shadow:0 0 18px color-mix(in srgb,var(--accent) 35%,transparent);animation:findpulse 1s ease-in-out 2}
@keyframes findpulse{50%{outline-color:transparent}}
@media (prefers-reduced-motion:reduce){.scs .msg[data-hit] .bub{animation:none}}
/* sticky offsets are measured inside the scroller's padding, and the composer overlays that padding, so 12px lands just above it */
.scs .jtl{position:sticky;bottom:12px;height:0;display:flex;justify-content:center;pointer-events:none;z-index:30}
.scs .jtl>[data-control]{pointer-events:auto;margin-top:-40px}
`;
