/**
 * The Messenger shell's styles, sizes from RoleCall discord.css (the rail :11-18, the sidebar :19-35, the user bar :36-40, the header :41-44, the 640px step :155-173) and the approved
 * wireframes messenger-discord/shell.html and panels.html. The palette is the layout's own, fixed like RoleCall's: the --msg-* block in tokens.css. The two breakpoints are container queries on
 * the scene (AGENTS rule 11), not on the window. The scene's own sheets are scoped by `.scs`; inside `.msn` the stage tokens are pointed at the Messenger palette, so the chat and every program
 * wear it without a rule per control. The shell is a row: the left side (rail and sidebar), then the main column (header over the body), and the body is the chat beside one right slot (a
 * docked panel or the member list). `.msn-body` is the positioned box the panels and the member list cover when the scene is under 1024px, so it zeroes the header height for them.
 * Layers and popouts are children of `.msn` itself. The frames' sheets (panels, settings) and the chat's sheet are appended below.
 */
import { MESSENGER_CHAT_STYLE } from "./messenger-chat-style";
import { PANELS_STYLE } from "./frames/panels-style";
import { SETTINGS_STYLE } from "./frames/settings-style";
import { MESSENGER_SKIN_STYLE } from "./messenger-skin-style";
import { MSN_DIRECTOR_STYLE } from "./panels/director/director-style";
import { MSN_TRACKERS_STYLE } from "./panels/trackers/trackers-style";
import { CAST_PANELS_STYLE } from "./panels/cast/cast-panels-style";

import { BOOTH_PANEL_STYLE } from "./panels/booth/booth-panel-style";
import { WORKSHOP_STYLE } from "./panels/workshop/workshop-style";
import { LORE_PANEL_STYLE } from "./panels/lore/lore-panel-style";
import { SHELL_STYLE } from "./shell/shell-style";
import { HEADER_NARROW_STYLE } from "./shell/header-narrow-style";

const M = ":root .scs .msn";

export const MESSENGER_STYLE = `
${M}{--msg-left:calc(var(--msg-rail-w) + var(--msg-side-w));--msg-head-h:56px;--msg-mem-w:240px;position:absolute;inset:0;overflow:hidden;isolation:isolate;background:var(--msg-chat);color:var(--msg-text);font:14px/1.45 var(--font-body),ui-sans-serif,system-ui,sans-serif;
--accent:var(--msg-brand);--stage-well:var(--msg-chat);--stage-floor:var(--msg-chat);--stage-panel:var(--msg-side);--stage-deck:var(--msg-side);--stage-row:var(--msg-bar);--stage-sunken:var(--msg-rail);
--stage-card:var(--msg-bright);--stage-paper:var(--msg-bright);--stage-soft:var(--msg-text);--stage-mute:var(--msg-mute);--stage-text-dim:var(--msg-mute);--stage-dim:var(--msg-faint);
--stage-line:var(--msg-field-edge);--stage-seam:var(--msg-divider);--focus-ring:var(--msg-focus)}
${M} :is(a,input,textarea,select):focus-visible{outline:2px solid var(--msg-focus);outline-offset:2px}
${M} .msn-bg{position:absolute;inset:0;display:flex;min-width:0}
${M} .msn-left{position:relative;display:flex;flex:0 0 var(--msg-left);width:var(--msg-left);min-width:0;z-index:53}
${M} .msn-main{display:flex;flex:1;flex-direction:column;min-width:0;min-height:0}
${M} .msn-body{--msg-head-h:0px;position:relative;display:flex;flex:1;min-width:0;min-height:0}
${M} .msn-dock{display:contents}
${M} .msn-av{display:flex;align-items:center;justify-content:center;width:36px;height:36px;flex:0 0 36px;overflow:hidden;border-radius:50%;background:var(--msg-brand);color:var(--msg-white);font-size:13px;font-weight:700}
${M} .msn-av img{width:100%;height:100%;object-fit:cover;object-position:center 20%}
${M} .msn-av .ini{font:inherit;color:inherit}
${M} .msn-rail{display:flex;flex-direction:column;align-items:center;gap:8px;flex:0 0 var(--msg-rail-w);padding:12px 0 8px;background:var(--msg-rail);min-height:0}
${M} .msn-rail-sep{flex:none;width:32px;height:2px;border-radius:1px;background:var(--msg-divider)}
${M} .msn-tabs{display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;min-height:0;width:100%;overflow-y:auto;scrollbar-width:thin;padding-bottom:8px}
${M} .msn-rail [data-control="tile"]{position:relative;flex:none;width:48px;height:48px;min-height:48px;padding:0;border:0;border-radius:calc(var(--msn-radius) * 2);background:var(--msg-chat);color:var(--msg-text);box-shadow:none;overflow:visible}
${M} .msn-rail [data-control="tile"][data-kind="thumb"]{overflow:hidden}
${M} .msn-rail [data-control="tile"][data-kind="add"]{border:2px dashed var(--msg-divider);background:transparent;color:var(--msg-mute)}
${M} .msn-rail [data-control="tile"]:hover:not(:disabled){border-radius:var(--msn-radius);background:var(--msg-brand);color:var(--msg-white)}
${M} .msn-rail [data-control="tile"][data-selected]{border-radius:var(--msn-radius);background:var(--msg-brand);color:var(--msg-white);box-shadow:none}
${M} .msn-rail [data-control="tile"] .msn-av{width:100%;height:100%;flex-basis:100%;border-radius:0}
${M} .msn-rail [data-control="tile"] svg{width:23px;height:23px}
${M} .msn-rail [data-control="tile"][data-selected]::before{content:"";position:absolute;left:-12px;top:7px;width:4px;height:34px;border-radius:0 4px 4px 0;background:var(--msg-white)}
${M} .msn-side{display:flex;flex:1;flex-direction:column;min-width:0;background:var(--msg-side)}
${M} .msn-side-h{display:flex;align-items:center;gap:4px;min-height:56px;padding:0 8px;box-shadow:0 1px 0 var(--msg-rail)}
${M} .msn-side-h [data-control="button"]{justify-content:space-between;min-height:44px;color:var(--msg-bright);font-weight:750;font-size:16px}
${M} .msn-side [data-control="row"]{border-radius:var(--msn-radius);color:inherit;--text-soft:var(--msg-mute)}
${M} .msn-side [data-control="row"]:hover:not(:disabled){background:var(--msg-hover)}
${M} .msn-side [data-control="row"][data-selected]{background:var(--msg-active);color:var(--msg-white);border-left-color:transparent}
${M} .msn-dms{flex:1;min-height:0;overflow-y:auto;padding:4px 8px 12px;scrollbar-width:thin}
${M} .msn-cat{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:12px 0 4px 10px}
${M} .msn-cat h2,${M} .msn-cap{margin:0;color:var(--msg-mute);font:700 12px/1.4 var(--font-body);letter-spacing:.02em}
${M} .msn-cap{margin:12px 10px 6px}
${M} .msn-rail [data-control="tile"] [data-slot="badge"]{top:auto;right:-4px;bottom:-4px;border-radius:8px;background:var(--msg-unread);color:var(--msg-white);box-shadow:0 0 0 3px var(--msg-rail)}
${M} .msn-side [data-control="row"][data-unread]{color:var(--msg-bright);font-weight:700}
${M} .msn-pip{display:inline-block;min-width:16px;padding:0 5px;border-radius:8px;background:var(--msg-unread);color:var(--msg-white);font:700 11px/16px var(--font-body);text-align:center}
${M} .msn-scn{display:flex;flex-wrap:wrap;align-items:center;gap:2px}
${M} .msn-scn>[data-control="row"]{flex:1;min-width:0}
${M} .msn-threads{flex:0 0 100%;display:flex;flex-direction:column}
${M} .msn-empty{margin:12px 10px;color:var(--msg-mute);font-size:12px}
${M} .msn-empty>p{margin:0 0 8px}
${M} .msn-ubar{display:flex;align-items:center;gap:2px;min-height:62px;padding:8px;background:var(--msg-bar);padding-bottom:max(8px,env(safe-area-inset-bottom))}
${M} .msn-profile{flex:1;min-width:0}
${M} :is(.msn-mmenu,.msn-mclose){display:none}
${M} .msn-bg>[data-control="scrim"]{display:none}
${M} .msn-head{display:flex;flex:none;align-items:center;gap:10px;height:var(--msg-head-h);padding:0 16px;background:var(--msg-chat);border-bottom:1px solid var(--msg-edge);box-shadow:0 1px 3px color-mix(in srgb,var(--msg-rail) 19%,transparent);position:relative;z-index:53}
${M} .msn-hash{flex:none;color:var(--msg-mute);font-size:24px;font-weight:300;line-height:1}
${M} .msn-title{flex:0 1 auto;min-width:0;color:var(--msg-bright);font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${M} .msn-topic{flex:1 1 0;min-width:0;color:var(--msg-mute);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-left:10px;border-left:1px solid var(--msg-divider)}
${M} .msn-head .msn-actions.sh{position:static;height:auto;padding:0;background:none;margin-left:auto;gap:8px;z-index:auto}
${M} .msn-mem{display:flex;flex:0 0 var(--msg-mem-w);width:var(--msg-mem-w);flex-direction:column;min-height:0;background:var(--msg-side);border-left:1px solid var(--msg-edge)}
${M} .msn-mem-h{display:flex;align-items:center;justify-content:space-between;flex:none;min-height:48px;padding:0 8px 0 14px;border-bottom:1px solid var(--msg-edge);color:var(--msg-bright)}
${M} .msn-mem-b{flex:1;min-height:0;overflow-y:auto;padding:8px;scrollbar-width:thin}
${M} .msn-mem [data-control="row"]{border-radius:var(--msn-radius);color:inherit;--text-soft:var(--msg-mute)}
${M} .msn-mem [data-control="row"]:hover:not(:disabled){background:var(--msg-hover)}
${M} .msn-portrait{display:flex;height:180px;margin-bottom:8px}
${M} .msn-portrait [data-part="scene.portrait.zoom"]{position:static;display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:var(--msg-bar);padding:0;border:0;border-radius:var(--msn-radius);overflow:hidden}
${M} .msn-portrait [data-part="scene.portrait.zoom"] img{width:100%;height:100%;object-fit:contain}
${M} .msn-slot{height:100%;min-width:0}
${M} .msn-prog{position:relative;height:100%;min-height:0;min-width:0;overflow:auto;color:var(--msg-text);background:var(--msg-chat);border-radius:var(--msn-radius)}
${M} .msn-prog nav.fold{display:none}
${M} .msn-prog .wing-panel[data-wing]{position:relative;inset:auto;width:100%;height:100%;padding:0;border:0;background:none;color:inherit}
${M} .msn-prog :is(input:not([type="color"],[type="range"],[type="checkbox"],[type="radio"]),textarea,select){background-color:var(--msg-rail);border-color:var(--msg-field-edge);color:var(--msg-text)}
${M} .msn-pnl .msn-pnl-b{padding:0}
${M} .msn-pnl-b .msn-prog{border-radius:0}
${M} .msn-lyr{display:flex;flex:1;flex-direction:column;min-width:0;min-height:0}
${M} .msn-lyr-h{flex:none;padding:24px 72px 12px 28px}
${M} .msn-lyr-h>[data-part="scene.messenger.layer.popout"]{float:right}
${M} .msn-lyr-h h2{margin:0;color:var(--msg-bright);font:700 24px/1.25 var(--font-body);overflow-wrap:anywhere}
${M} .msn-lyr-b{flex:1;min-height:0;min-width:0;padding:0 20px 20px;overflow:hidden}
${M} [data-msn-close]{flex-direction:column;gap:3px;color:var(--msg-mute)}
${M} [data-msn-close] svg{width:34px;height:34px;padding:6px;border:2px solid var(--msg-close-ring);border-radius:50%}
${M} [data-msn-close] small{font-size:10px}

@container (max-width:1199px){
${M} .msn-pnl[data-width="wide"]{position:absolute;inset:var(--msg-head-h) 0 0 0;width:auto;z-index:60;border-left:0}
}
@container (max-width:1023px){
${M} .msn-mem{position:absolute;inset:var(--msg-head-h) 0 0 auto;width:min(var(--msg-mem-w),100%);z-index:60;box-shadow:-8px 0 32px var(--msg-drawer-shadow)}
}
@container (max-width:640px){
${M}{--msg-left:0px}
${M} .msn-left{position:absolute;inset:0 auto 0 0;display:none;width:min(312px,calc(100% - 40px));z-index:102;box-shadow:8px 0 32px var(--msg-drawer-shadow)}
${M}[data-nav-open="true"] .msn-left{display:flex}
${M} .msn-bg>[data-control="scrim"]{display:block;background:var(--msg-dim);z-index:101}
${M} :is(.msn-mmenu,.msn-mclose){display:flex}
${M} .msn-head{padding:0 10px;gap:6px}
${M} .msn-topic,${M} .msn-sw-pins,${M} .msn-sw-sep{display:none}
${M} .msn-lyr-h{padding:16px 64px 8px 12px}
${M} .msn-lyr-h h2{font-size:19px}
${M} .msn-lyr-b{padding:0 8px max(10px,env(safe-area-inset-bottom))}
${M} [data-msn-close] svg{width:30px;height:30px}
}
${MESSENGER_CHAT_STYLE}
${PANELS_STYLE}
${SETTINGS_STYLE}${MESSENGER_SKIN_STYLE}${MSN_DIRECTOR_STYLE}${MSN_TRACKERS_STYLE}${CAST_PANELS_STYLE}${BOOTH_PANEL_STYLE}${WORKSHOP_STYLE}${LORE_PANEL_STYLE}${SHELL_STYLE}${HEADER_NARROW_STYLE}`;
