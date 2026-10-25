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
.scs .cap .tools{width:32px;height:32px;flex:none;display:grid;place-items:center;border:0;border-radius:0;background:none;color:var(--stage-text-dim);cursor:pointer}
.scs .cap .tools:hover,.scs .cap .tools.on{background:color-mix(in srgb,var(--stage-card) 8%,transparent);color:var(--stage-card)}
.scs .menu.cm{left:0;right:auto;min-width:16rem}
.scs .menu .sec{padding:6px 12px 2px;font-size:var(--text-meta);font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--stage-mute)}
.scs .cm button b{display:block;font-weight:600}
.scs .cm button small{display:block;font-size:var(--text-meta);color:var(--stage-mute);white-space:normal}
.scs .cm button:disabled,.scs .menu button:disabled{opacity:.4;cursor:default}
.scs .steer{pointer-events:auto;max-width:880px;margin:0 auto 6px;display:flex;align-items:center;gap:12px;padding:8px 12px;border-left:4px solid var(--accent);background:color-mix(in srgb,var(--accent) 12%,var(--stage-panel));font:var(--text-body)/1.4 var(--font-big);color:var(--stage-card)}
.scs .steer b{flex:none;font-weight:700}
.scs .steer span{flex:1;min-width:0;color:var(--stage-soft)}
.scs .steer button{flex:none;display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border:0;border-radius:0;background:none;color:var(--stage-soft);font:inherit;cursor:pointer}
.scs .steer button:hover{background:color-mix(in srgb,var(--stage-card) 8%,transparent);color:var(--stage-card)}
.scs .menu.cm .ct{display:contents;font-style:normal}
`;

/** RoleCall's capsule and menu, re-rooted under the rolecall chrome so no other theme takes them. */
const ROLECALL = `
.scs .dockbar .cap{gap:8px;padding:12px 16px;border-radius:var(--rc-radius-lg);font-family:var(--font-ui);background:color-mix(in srgb,var(--stage-floor) 50%,transparent);border:1px solid color-mix(in srgb,var(--stage-card) 6%,transparent);box-shadow:0 8px 32px color-mix(in srgb,var(--stage-black) 40%,transparent);transition:border-color .25s,box-shadow .25s}
.scs .dockbar .cap:focus-within{border-color:color-mix(in srgb,var(--accent) 12%,transparent);box-shadow:0 8px 32px color-mix(in srgb,var(--stage-black) 40%,transparent),0 0 20px color-mix(in srgb,var(--accent) 6%,transparent)}
.scs .cap .hold{align-self:flex-end}
.scs .cap .tools{width:32px;height:32px;flex:none;display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--accent) 30%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--accent) 15%,transparent);color:var(--bk-scene-accent-text,var(--bk-role-brand-text));cursor:pointer;transition:all .2s}
.scs .cap .tools svg{transition:transform .2s}
.scs .cap .tools:hover,.scs .cap .tools.on{background:color-mix(in srgb,var(--accent) 15%,transparent);color:var(--bk-scene-accent-text,var(--bk-role-brand-text))}
.scs .cap .tools.on svg{transform:rotate(45deg)}
.scs .dockbar .cap textarea{align-self:flex-end;flex:1;width:100%;min-width:0;padding:0;font:400 14px/20px var(--font-ui);color:color-mix(in srgb,var(--stage-card) 90%,transparent)}
.scs .dockbar .cap textarea::placeholder{color:color-mix(in srgb,var(--stage-card) 25%,transparent)}
.scs .dockbar .cap .send,.scs .dockbar .cap .stop{align-self:flex-end;width:32px;height:32px;border-radius:var(--rc-radius-sm);transition:all .2s}
.scs .dockbar .cap .send{background:var(--accent);color:var(--stage-white);box-shadow:0 0 12px color-mix(in srgb,var(--accent) 25%,transparent)}
.scs .dockbar .cap .send:disabled{background:color-mix(in srgb,var(--accent) 15%,transparent);color:var(--rc-zinc-600);box-shadow:none}
.scs .dockbar .cap .send:not(:disabled):active,.scs .dockbar .cap .stop:active{transform:scale(.95)}
.scs .dockbar .cap .stop{background:var(--stage-danger-hot);color:var(--stage-white);box-shadow:0 0 12px color-mix(in srgb,var(--stage-danger-hot) 40%,transparent)}
.scs .dockbar .cap .stop:hover{filter:brightness(.9)}
.scs .menu.cm{left:50%;right:auto;bottom:calc(100% + 12px);transform:translateX(-50%);min-width:300px;max-width:min(340px,calc(100cqw - 16px));max-height:70vh;overflow-y:auto;padding:6px;border-radius:0;background:color-mix(in srgb,var(--stage-panel) 94%,transparent);backdrop-filter:blur(40px) saturate(1.4);box-shadow:6px 6px 0 0 var(--stage-black),inset 0 1px 0 0 color-mix(in srgb,var(--stage-card) 12%,transparent),inset 0 -1px 0 0 color-mix(in srgb,var(--stage-black) 40%,transparent);isolation:isolate;scrollbar-width:thin;scrollbar-color:var(--bk-role-brand-text) color-mix(in srgb,var(--stage-black) 40%,transparent);animation:cm-in .15s ease-out}
@keyframes cm-in{from{opacity:0;transform:translateX(-50%) translateY(8px) scale(.95)}to{opacity:1;transform:translateX(-50%)}}
@container (max-width:520px){.scs .menu.cm{left:0;transform:none;animation:none}}
@media (prefers-reduced-motion:reduce){.scs .menu.cm{animation:none}.scs .cap .tools,.scs .cap .tools svg,.scs .dockbar .cap{transition:none}}
.scs .menu.cm [role="group"]+[role="group"]{margin-top:4px;padding-top:4px;border-top:1px solid color-mix(in srgb,var(--stage-card) 6%,transparent)}
.scs .menu.cm .sec{padding:10px 12px 6px;font:800 var(--rc-s-p7rem) var(--font-fancy);letter-spacing:.22em;text-transform:uppercase;color:var(--bk-role-brand-text);text-shadow:1px 1px 0 var(--stage-black)}
.scs .menu.cm button{gap:12px;padding:8px 10px;font:600 var(--rc-text-sm)/1.2 var(--font-ui);color:color-mix(in srgb,var(--stage-card) 95%,transparent);white-space:normal;transition:background-color .15s,transform .15s}
.scs .menu.cm button:hover{background:color-mix(in srgb,var(--stage-card) 6%,transparent)}
.scs .menu.cm button:active{transform:scale(.98)}
.scs .menu.cm .ct{width:28px;height:28px;flex:none;display:grid;place-items:center;border:2px solid var(--stage-black);border-radius:0;background:var(--bk-role-select);font-style:normal}
.scs .menu.cm .ct svg{color:var(--stage-white)}
.scs .menu.cm .ct[data-tone="action"]{background:var(--bk-role-action)}
.scs .menu.cm .ct[data-tone="ok"]{background:var(--bk-role-ok)}
.scs .menu.cm .ct[data-tone="mute"]{background:var(--rc-zinc-600)}
.scs .cm button small{display:block;margin-top:3px;font:400 .85rem/1.35 var(--font-ui);color:var(--rc-zinc-300);white-space:normal}
`;

export const COMPOSER_STYLE = SHARED + rcScope(ROLECALL) + BUBBLE_STYLE + RC_SIZE_STYLE;
