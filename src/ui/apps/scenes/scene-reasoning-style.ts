/**
 * The scene.reasoning surface's own styles (approved wireframe rc-port/scene-reasoning-themes.html): the anatomy every look
 * shares, and the "core" look, RoleCall's two cards with the glass taken out (solid fills, crisp borders, one flat offset on
 * the native card; no blur, no glow, no gradient, no translucent fill). The four picked looks are variants/scene.reasoning.
 * One role per meaning: info marks the model's own reasoning channel (native), select marks thinking written inside the
 * reply text (tags); the character's tone only tints the core cards. All colour is a --bk-* token. Square, 12px floor.
 * Every class carries the rb- prefix: the scene stylesheet already owns .hd, .chip, .tag, .open and the like.
 */
export const REASONING_STYLE = `
.scs .rb-list{--z-well:var(--bk-surface-well);--z-panel:var(--bk-surface-panel);--z-sunken:var(--bk-surface-sunken);--z-field:var(--bk-surface-field);--z-ink:var(--bk-surface-ink);--z-line:var(--bk-line);--z-strong:var(--bk-line-strong);--z-ctl:var(--bk-line-control);--z-text:var(--bk-text);--z-soft:var(--bk-text-soft);--z-dim:var(--bk-text-dim);--z-nat:var(--bk-role-info);--z-nat-t:var(--bk-role-info-text);--z-nat-d:var(--bk-role-info-deep);--z-tag:var(--bk-role-select);--z-tag-t:var(--bk-role-select-text);--z-tag-d:var(--bk-role-select-deep);--z-ondeep:var(--bk-text-on-deep);--z-sans:var(--font-body);--z-serif:var(--font-fancy);--z-mono:var(--font-mono);--z-disp:var(--font-fancy);display:flex;flex-direction:column;gap:8px;margin:0 0 8px;clear:both}
.scs .rb{position:relative;min-width:0;font-family:var(--z-sans)}
.scs .rb [data-part="scene.reasoning.header"]{flex-wrap:wrap;gap:4px 10px;padding-block:8px;padding-left:10px;padding-right:6.5rem}
.scs .rb .rb-info{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;white-space:normal}
.scs .rb .rb-chip{font-family:var(--z-mono);font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;line-height:20px;padding:0 8px}
.scs .rb .rb-no{font-family:var(--z-mono);font-weight:700;margin-right:6px}
.scs .rb .rb-dur{font-size:13px;color:var(--z-soft);white-space:nowrap}
.scs .rb .rb-snip{order:5;flex:1 1 100%;min-width:0;font-size:13px;color:var(--z-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.scs .rb:not(.rb-core).rb-open .rb-dur{order:4;flex:1 1 100%}
.scs .rb .rb-cv{margin-left:auto;display:inline-flex;flex:none;transition:transform .15s}
.scs .rb.rb-open .rb-cv{transform:rotate(180deg)}
.scs .rb .rb-copy{position:absolute;top:7px;right:2.6rem;z-index:1;opacity:0}
.scs .rb:hover .rb-copy,.scs .rb:focus-within .rb-copy,.scs .rb.rb-open .rb-copy{opacity:1}
.scs .rb .rb-bd{font-size:14px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}
.scs .rb .rb-bd[data-cap]{max-height:300px;overflow:auto}
.scs .rb .rb-bd:focus-visible{outline:2px solid var(--bk-focus-color);outline-offset:-2px}
.scs .rb.rb-nat .rb-bd{font-family:var(--z-mono);font-size:13px;line-height:1.65;color:var(--z-text)}
.scs .rb.rb-tag .rb-bd{font-family:var(--z-sans);font-style:italic;color:var(--z-text)}
.scs .rb .rb-dots i{display:inline-block;width:4px;height:4px;margin-left:3px;vertical-align:middle;background:currentColor;animation:scs-pulse 1s steps(2) infinite}
.scs .rb .rb-dots i:nth-child(2){animation-delay:.2s}
.scs .rb .rb-dots i:nth-child(3){animation-delay:.4s}
.scs .rb .caret{margin-left:2px}
.scs .noreply{margin:0;font-size:14px;color:var(--bk-text-dim);font-style:italic}

.scs .rb.rb-core{--a:var(--tone)}
.scs .rb.rb-core [data-part="scene.reasoning.header"]{padding-block:10px;padding-left:12px;flex-wrap:nowrap}
.scs .rb.rb-core .rb-copy{top:14px}
.scs .rb.rb-core .rb-ico{display:grid;place-items:center;width:28px;height:28px;flex:none;color:var(--z-text)}
.scs .rb.rb-core .rb-cv{color:var(--z-text)}
.scs .rb.rb-core.rb-thinking .rb-ico{animation:scs-pulse 1.2s steps(2) infinite}
.scs .rb.rb-core .rb-info{flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:2px 10px}
.scs .rb.rb-core .rb-chip{font-family:var(--z-sans);font-weight:600;letter-spacing:.1em;padding:0;color:var(--z-text)}
.scs .rb.rb-core.rb-open .rb-dur{order:0;flex:none}
.scs .rb.rb-core.rb-tag{border:1px solid color-mix(in srgb,var(--a) 60%,var(--z-well));background:color-mix(in srgb,var(--a) 12%,var(--z-panel))}
.scs .rb.rb-core.rb-tag .rb-ico{border:1px solid color-mix(in srgb,var(--a) 60%,var(--z-well));background:color-mix(in srgb,var(--a) 22%,var(--z-panel))}
.scs .rb.rb-core.rb-tag .rb-snip{font-style:italic}
.scs .rb.rb-core.rb-tag.rb-open .rb-bd{border-top:1px solid var(--a);padding:12px 14px}
.scs .rb.rb-core.rb-nat{border:2px solid color-mix(in srgb,var(--a) 70%,var(--z-well));background:color-mix(in srgb,var(--a) 7%,var(--z-ink));margin:0 4px 4px 0;box-shadow:4px 4px 0 color-mix(in srgb,var(--a) 40%,var(--z-well))}
.scs .rb.rb-core.rb-nat [data-part="scene.reasoning.header"]{background:color-mix(in srgb,var(--a) 16%,var(--z-ink))}
.scs .rb.rb-core.rb-nat .rb-ico{border:1px solid color-mix(in srgb,var(--a) 70%,var(--z-well));background:color-mix(in srgb,var(--a) 14%,var(--z-ink))}
.scs .rb.rb-core.rb-nat .rb-chip{letter-spacing:.08em}
.scs .rb.rb-core.rb-nat .rb-snip{font-family:var(--z-sans);font-style:italic;color:var(--z-soft)}
.scs .rb.rb-core.rb-nat.rb-open .rb-bd{border-top:1px solid color-mix(in srgb,var(--a) 70%,var(--z-well));padding:12px 14px 14px}
.scs .rb.rb-core .rb-cur{font-family:var(--z-disp);font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;margin-bottom:8px;color:var(--z-text)}
`;
