/**
 * The composer capsule and its "+" menu, to RoleCall's ImmersiveChatboxCapsule.tsx and composer-shell-styles.ts: a 2px capsule (the inline radius, --rc-radius-lg) (12px 16px,
 * glass at 50%, 1px edge at 6%) that takes the accent edge and a faint glow on focus, a 32px "+" in the accent at 15% with a 30% edge, a
 * 14px/20px Inter box that grows to ten rows (composer-grow.ts), a 32px send (accent when it can send, a wash with a zinc-600 glyph when it
 * cannot), and a centered glass menu with 28px coloured icon tiles and Cinzel section labels (:1355-1560). The steering ribbon is unchanged.
 * The first sheet is every theme's; the second is RoleCall's, under html[data-chrome="rolecall"] (rc-chrome.ts), so no other theme takes it. The message sheet and the
 * sub-12px size tokens ride along (scene-bubble-style.ts, rc-chrome.ts).
 */
import { RC_SIZE_STYLE, rcScope } from "./rc-chrome";
import { BUBBLE_STYLE } from "./scene-bubble-style";

/** Every theme: the capsule and menu as they were, with the new icon tile left to the row's own layout. */
const SHARED = `
.scs .cap .hold{align-self:center}
.scs .menu.cm{left:0;right:auto;min-width:16rem}
.scs .menu .sec{padding:6px 12px 2px;font-size:var(--text-meta);font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--stage-mute)}
.scs .steer{pointer-events:auto;max-width:880px;margin:0 auto 6px;display:flex;align-items:center;gap:12px;padding:8px 12px;border-left:4px solid var(--accent);background:color-mix(in srgb,var(--accent) 12%,var(--stage-panel));font:var(--text-body)/1.4 var(--font-big);color:var(--stage-card)}
.scs .steer b{flex:none;font-weight:700}
.scs .steer span{flex:1;min-width:0;color:var(--stage-soft)}
.scs .menu.cm .ct{display:contents;font-style:normal}
`;

/** RoleCall's capsule and menu, re-rooted under the rolecall chrome so no other theme takes them. */
const ROLECALL = `
.scs .dockbar .cap{gap:8px;padding:12px 16px;border-radius:var(--rc-radius-lg);font-family:var(--font-ui);background:color-mix(in srgb,var(--stage-floor) 50%,transparent);border:1px solid color-mix(in srgb,var(--stage-card) 6%,transparent);box-shadow:0 8px 32px color-mix(in srgb,var(--stage-black) 40%,transparent);transition:border-color .25s,box-shadow .25s}
.scs .dockbar .cap:focus-within{border-color:color-mix(in srgb,var(--accent) 12%,transparent);box-shadow:0 8px 32px color-mix(in srgb,var(--stage-black) 40%,transparent),0 0 20px color-mix(in srgb,var(--accent) 6%,transparent)}
.scs .cap .hold{align-self:flex-end}
.scs .dockbar .cap>[data-control]{align-self:flex-end}
.scs .dockbar .cap textarea{align-self:flex-end;flex:1;width:100%;min-width:0;padding:0;font:400 14px/20px var(--font-ui);color:color-mix(in srgb,var(--stage-card) 90%,transparent)}
.scs .dockbar .cap textarea::placeholder{color:color-mix(in srgb,var(--stage-card) 25%,transparent)}
.scs .menu.cm{left:50%;right:auto;bottom:calc(100% + 12px);transform:translateX(-50%);min-width:300px;max-width:min(340px,calc(100cqw - 16px));max-height:70vh;overflow-y:auto;padding:6px;border-radius:0;background:color-mix(in srgb,var(--stage-panel) 94%,transparent);backdrop-filter:blur(40px) saturate(1.4);box-shadow:6px 6px 0 0 var(--stage-black),inset 0 1px 0 0 color-mix(in srgb,var(--stage-card) 12%,transparent),inset 0 -1px 0 0 color-mix(in srgb,var(--stage-black) 40%,transparent);isolation:isolate;scrollbar-width:thin;scrollbar-color:var(--bk-role-brand-text) color-mix(in srgb,var(--stage-black) 40%,transparent);animation:cm-in .15s ease-out}
@keyframes cm-in{from{opacity:0;transform:translateX(-50%) translateY(8px) scale(.95)}to{opacity:1;transform:translateX(-50%)}}
@container (max-width:520px){.scs .menu.cm{left:0;transform:none;animation:none}}

@media (prefers-reduced-motion:reduce){.scs .menu.cm{animation:none}.scs .dockbar .cap{transition:none}}
.scs .menu.cm [role="group"]+[role="group"]{margin-top:4px;padding-top:4px;border-top:1px solid color-mix(in srgb,var(--stage-card) 6%,transparent)}
.scs .menu.cm .sec{padding:10px 12px 6px;font:800 var(--rc-s-p7rem) var(--font-fancy);letter-spacing:.22em;text-transform:uppercase;color:var(--bk-role-brand-text);text-shadow:1px 1px 0 var(--stage-black)}
.scs .menu.cm .ct{width:28px;height:28px;flex:none;display:grid;place-items:center;border:2px solid var(--stage-black);border-radius:0;background:var(--bk-role-select);font-style:normal}
.scs .menu.cm .ct svg{color:var(--stage-white)}
.scs .menu.cm .ct[data-tone="action"]{background:var(--bk-role-action)}
.scs .menu.cm .ct[data-tone="ok"]{background:var(--bk-role-ok)}
.scs .menu.cm .ct[data-tone="mute"]{background:var(--rc-zinc-600)}
`;

const PHONE = `@container (max-width:30rem){
html:root .scs .dockbar{padding:8px}
html:root .scs .dockbar .cap{gap:6px;padding:8px 10px}
html:root .scs .dockbar .cap textarea{max-height:5.5rem;font-size:16px;line-height:22px}
html:root .scs .cap .hint{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
}`;

export const COMPOSER_STYLE = SHARED + rcScope(ROLECALL) + BUBBLE_STYLE + PHONE + RC_SIZE_STYLE;
