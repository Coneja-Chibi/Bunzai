/**
 * The Messenger shell's styles, every size from RoleCall discord.css (the rail :11-18, the sidebar :19-35, the user bar :36-40, the header :41-44, the portrait :45-55, the settings surface
 * :91-110, the 1023px step :146-153 and the 640px step :155-173) and the approved wireframe rc-port/messenger.html. The palette is the layout's own, fixed like RoleCall's: the --msg-* block in
 * tokens.css. The two breakpoints are container queries on the scene (AGENTS rule 11), not on the window. The scene's own sheets are scoped by `.scs`; inside `.msn` the stage
 * tokens are pointed at the Messenger palette, so the chat and every wing panel wear it without a rule per control. Two more shell rules live in messenger-chat-style.ts.
 */
import { MESSENGER_CHAT_STYLE } from "./messenger-chat-style";

const M = ":root .scs .msn";

export const MESSENGER_STYLE = `
${M}{--msg-left:calc(var(--msg-rail-w) + var(--msg-side-w));--msg-portrait-w:0px;--msg-head-h:56px;position:absolute;inset:0;overflow:hidden;isolation:isolate;background:var(--msg-chat);color:var(--msg-text);font:14px/1.45 var(--font-body),ui-sans-serif,system-ui,sans-serif;
--accent:var(--msg-brand);--stage-well:var(--msg-chat);--stage-floor:var(--msg-chat);--stage-panel:var(--msg-side);--stage-deck:var(--msg-side);--stage-row:var(--msg-bar);--stage-sunken:var(--msg-rail);
--stage-card:var(--msg-bright);--stage-paper:var(--msg-bright);--stage-soft:var(--msg-text);--stage-mute:var(--msg-mute);--stage-text-dim:var(--msg-mute);--stage-dim:var(--msg-faint);
--stage-line:var(--msg-field-edge);--stage-seam:var(--msg-divider);--focus-ring:var(--msg-focus)}
${M}[data-has-portrait="true"]{--msg-portrait-w:clamp(240px,20cqw,288px)}
${M} :is(a,input,textarea,select):focus-visible{outline:2px solid var(--msg-focus);outline-offset:2px}
${M} .msn-left{position:absolute;inset:0 auto 0 0;width:var(--msg-left);display:flex;z-index:50}
${M} .msn-av{display:flex;align-items:center;justify-content:center;width:36px;height:36px;flex:0 0 36px;overflow:hidden;border-radius:50%;background:var(--msg-brand);color:var(--msg-white);font-size:13px;font-weight:700}
${M} .msn-av img{width:100%;height:100%;object-fit:cover;object-position:center 20%}
${M} .msn-av .ini{font:inherit;color:inherit}
${M} .msn-rail{display:flex;flex-direction:column;align-items:center;gap:12px;flex:0 0 var(--msg-rail-w);padding:14px 0 8px;background:var(--msg-rail);min-height:0}
${M} .msn-tabs{display:flex;flex-direction:column;align-items:center;gap:12px;flex:1;min-height:0;width:100%;overflow-y:auto;scrollbar-width:thin;padding-bottom:8px}
${M} .msn-rail [data-control="tabs"]{align-items:center;gap:12px}
${M} .msn-rail [role="tab"]{display:flex;align-items:center;justify-content:center;width:48px;height:48px;min-height:48px;padding:0;border-radius:16px;background:var(--msg-chat);color:var(--msg-text);position:relative}
${M} .msn-rail [role="tab"]:is(:hover,[aria-selected="true"]){background:var(--msg-brand);color:var(--msg-white)}
${M} .msn-rail [role="tab"] svg{width:23px;height:23px}
${M} .msn-rail [role="tab"][aria-selected="true"]::before{content:"";position:absolute;left:-12px;width:4px;height:34px;border-radius:0 4px 4px 0;background:var(--msg-white)}
${M} .msn-rail [role="tab"]:first-child{margin-bottom:14px}
${M} .msn-rail [role="tab"]:first-child::after{content:"";position:absolute;left:10px;bottom:-14px;width:28px;height:2px;background:var(--msg-divider)}
${M} .msn-side{display:flex;flex:1;flex-direction:column;min-width:0;background:var(--msg-side)}
${M} .msn-side-h{min-height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;box-shadow:0 1px 0 var(--msg-rail);font-weight:750;font-size:16px}
${M} .msn-browse{margin:12px 8px 8px}
${M} .msn-side [data-control="row"]{border-radius:5px;color:inherit;--text-soft:var(--msg-mute)}
${M} .msn-side [data-control="row"]:hover:not(:disabled){background:var(--msg-hover)}
${M} .msn-side [data-control="row"][data-selected]{background:var(--msg-active);color:var(--msg-white);border-left-color:transparent}
${M} .msn-dms{flex:1;min-height:0;overflow-y:auto;padding:4px 8px 12px;scrollbar-width:thin}
${M} .msn-dms h2{margin:8px 10px 10px;color:var(--msg-mute);font:700 11px/1.4 var(--font-body);letter-spacing:.04em}
${M} .msn-empty{margin:12px 10px;color:var(--msg-mute);font-size:12px}
${M} .msn-empty>p{margin:0 0 8px}
${M} .msn-acts{display:flex;gap:6px;flex-wrap:wrap;max-height:100px;overflow-y:auto;padding:8px 12px}
${M} .msn-ubar{display:flex;align-items:center;gap:4px;min-height:62px;padding:8px;background:var(--msg-bar);padding-bottom:max(8px,env(safe-area-inset-bottom))}
${M} .msn-profile{flex:1;min-width:0}
${M} :is(.msn-mmenu,.msn-mclose){display:none}
${M} .msn-bg>[data-control="scrim"]{display:none}
${M} .msn-head{position:absolute;top:0;left:var(--msg-left);right:0;height:var(--msg-head-h);display:flex;align-items:center;gap:10px;padding:0 20px;background:var(--msg-chat);border-bottom:1px solid var(--msg-edge);box-shadow:0 1px 3px color-mix(in srgb,var(--msg-rail) 19%,transparent);z-index:50}
${M} .msn-head>div:not(.msn-actions){min-width:0;display:flex;flex-direction:column}
${M} .msn-head strong{color:var(--msg-bright);font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${M} .msn-head small{font-size:11px;color:var(--msg-mute)}
${M} .msn-head .msn-actions.sh{position:static;height:auto;padding:0;background:none;margin-left:auto;gap:8px;z-index:auto}
${M} .msn-portrait{position:absolute;right:0;top:var(--msg-head-h);bottom:0;width:var(--msg-portrait-w);display:flex;flex-direction:column;gap:14px;padding:18px;background:var(--msg-side);border-left:1px solid var(--msg-active);z-index:50}
${M} .msn-portrait [data-part="scene.portrait.zoom"]{position:static;display:flex;align-items:center;justify-content:center;width:100%;flex:1;min-height:0;background:var(--msg-bar);padding:0;border:0;border-radius:8px;overflow:hidden}
${M} .msn-portrait [data-part="scene.portrait.zoom"] img{width:100%;height:100%;object-fit:contain}
${M} .msn-portrait>div{display:flex;flex-direction:column;text-align:center}
${M} .msn-portrait strong{color:var(--msg-bright);overflow-wrap:anywhere}
${M} .msn-portrait small{color:var(--msg-mute);font-size:11px}
${M} .msn-sb{position:absolute;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--msg-scrim);backdrop-filter:blur(5px)}
${M} .msn-sb[data-view="tab"]{inset:var(--msg-head-h) var(--msg-portrait-w) 0 var(--msg-left);z-index:45;display:block;padding:0;background:var(--msg-chat);backdrop-filter:none}
${M} .msn-sb[data-view="tab"] .msn-set{width:100%;height:100%;max-height:none;border:0;border-radius:0;box-shadow:none}
${M} .msn-sb[hidden]{display:none}
${M} .msn-set{display:flex;width:min(1180px,100%);height:100%;max-height:920px;min-width:0;min-height:0;overflow:hidden;border:1px solid var(--msg-modal-edge);border-radius:10px;box-shadow:0 24px 80px var(--msg-shadow);background:var(--msg-chat)}
${M} .msn-snav{display:flex;flex-direction:column;width:220px;flex:0 0 220px;padding:24px 14px;background:var(--msg-side);overflow-y:auto;scrollbar-width:thin}
${M} .msn-snav[hidden]{display:none}
${M} .msn-cap{padding:14px 10px 8px;color:var(--msg-mute);font-size:10px;font-weight:700;letter-spacing:.05em}
${M} .msn-snav>[data-control="row"]{border-radius:4px;color:var(--msg-mute);margin:1px 0}
${M} .msn-snav>[data-control="row"]:hover:not(:disabled){background:var(--msg-hover);color:var(--msg-bright)}
${M} .msn-snav>[data-control="row"][data-selected]{background:var(--msg-active);color:var(--msg-white);border-left-color:transparent}
${M} .msn-scont{display:flex;flex:1;flex-direction:column;min-width:0;min-height:0}
${M} .msn-scont>header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:24px 28px 20px;flex-shrink:0}
${M} .msn-scont>header>div{min-width:0}
${M} .msn-scont>header span{color:var(--msg-mute);font-size:10px;font-weight:700;letter-spacing:.07em}
${M} .msn-scont>header h2{margin:5px 0 0;color:var(--msg-bright);font:700 24px/1.25 var(--font-body);overflow-wrap:anywhere}
${M} [data-msn-close]{flex-direction:column;gap:3px;color:var(--msg-mute)}
${M} [data-msn-close] svg{width:34px;height:34px;padding:6px;border:2px solid var(--msg-close-ring);border-radius:50%}
${M} [data-msn-close] small{font-size:10px}
${M} .msn-outlets{flex:1;min-height:0;min-width:0;padding:0 20px 20px;overflow:hidden}
${M} .msn-prog{position:relative;height:100%;min-height:0;min-width:0;overflow:auto;color:var(--msg-text);background:var(--msg-chat);border-radius:6px}
${M} .msn-prog[hidden]{display:none}
${M} .msn-prog nav.fold{display:none}
${M} .msn-prog .wing-panel[data-wing]{position:relative;inset:auto;width:100%;height:100%;padding:0;border:0;background:none;color:inherit}
${M} .msn-prog :is(input:not([type="color"],[type="range"],[type="checkbox"],[type="radio"]),textarea,select){background-color:var(--msg-rail);border-color:var(--msg-field-edge);color:var(--msg-text)}

@container (max-width:1023px){
${M}[data-has-portrait="true"]{--msg-portrait-w:0px;--msg-head-h:144px}
${M}[data-has-portrait="true"] .msn-head{right:128px}
${M} .msn-portrait{top:0;bottom:auto;width:128px;height:144px;padding:8px;border-left:0;border-bottom:1px solid var(--msg-edge);background:var(--msg-chat)}
${M} .msn-portrait>div{display:none}
}
@container (max-width:640px){
${M}{--msg-left:0px}
${M} .msn-left{display:none;width:min(312px,calc(100% - 40px));z-index:102;box-shadow:8px 0 32px var(--msg-drawer-shadow)}
${M}[data-nav-open="true"] .msn-left{display:flex}
${M} .msn-bg>[data-control="scrim"]{display:block;background:var(--msg-dim);z-index:101}
${M} :is(.msn-mmenu,.msn-mclose){display:flex}
${M} .msn-head{padding:0 10px}
${M} .msn-sb{padding:0}
${M} .msn-set{border:0;border-radius:0;max-height:none}
${M} .msn-snav{width:124px;flex-basis:124px;padding:12px 6px}
${M} .msn-cap{padding-left:6px;font-size:9px}
${M} .msn-snav>[data-control="row"]{padding:10px 6px;font-size:12px}
${M} .msn-scont>header{padding:16px 12px;gap:8px}
${M} .msn-scont>header h2{font-size:19px}
${M} .msn-outlets{padding:0 8px max(10px,env(safe-area-inset-bottom))}
${M} [data-msn-close] svg{width:30px;height:30px}
}
${MESSENGER_CHAT_STYLE}`;
