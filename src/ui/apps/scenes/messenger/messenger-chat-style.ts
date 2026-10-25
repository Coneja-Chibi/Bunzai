/**
 * The scene's own chat wearing the Messenger look (RoleCall discord.css:56-90, which restyles RoleCall's transcript and composer in place): the same markup, positioned between the
 * header and the portrait, messages as an avatar and a name over plain text with no bubble, and the composer as the 8px input box. Every selector is rooted `:root .scs .msn-chat`
 * so it outranks the scene's own sheets, including the ones scoped to RoleCall's chrome. Colors are the stage tokens pointed at the Messenger palette (messenger-style.ts).
 */
const C = ":root .scs .msn-chat";

export const MESSENGER_CHAT_STYLE = `
${C}{position:absolute;inset:var(--msg-head-h) var(--msg-portrait-w) 0 var(--msg-left);z-index:40;background:var(--msg-chat)}
${C}[hidden]{display:none}
${C}>.chat{position:absolute;inset:0;display:flex;flex-direction:column;background:var(--msg-chat);transition:none}
${C}>.chat>.scroll{position:static;flex:1 1 auto;min-height:0;padding:20px 24px;color:var(--msg-text)}
${C} .msg,${C} .msg.user{flex-direction:row;gap:16px;margin:0;padding:10px 0 14px;animation:none}
${C} .msg .pw{position:static;flex:0 0 40px;width:40px;height:auto;max-width:none;overflow:visible;border-radius:0;box-shadow:none}
${C} .msg .pw .por{position:relative;width:40px;height:40px;border-radius:50%;overflow:hidden;background:var(--msg-brand);box-shadow:none}
${C} .msg .pw .por::before{display:none}
${C} .msg .pw .por .ini{font:700 13px var(--rc-font-inter);color:var(--msg-white)}
/* the time sits after the name, not under the avatar (discord.css:79-80, .message-header and .message-timestamp) */
${C} .msg .pw .pstamp{display:none}
${C} .msg .spk,${C} .msg.user .spk{display:inline-block}
${C} .msg .spk-time[hidden]{display:inline;margin-left:8px;font:400 11px/1.4 var(--rc-font-inter);color:var(--msg-faint)}
${C} .msg .body,${C} .msg.user .body{padding:0}
${C} .msg .bnum,${C} .msg.user .bnum{justify-content:flex-start}
${C} .msg.user .badge{float:none}
${C} .msg .spk,${C} .msg.user .spk{margin:0 0 4px;text-align:left;font:600 15px/1.4 var(--rc-font-inter);letter-spacing:0;text-transform:none;color:var(--msg-bright);text-shadow:none}
${C} .msg .bub,${C} .msg.user .bub{padding:0;border:0;border-radius:0;background:none}
${C} .msg .bub::before{display:none}
${C} .msg .prose,${C} .msg.user .prose{font:400 16px/1.6 var(--rc-font-inter);color:var(--msg-text);text-shadow:none}
${C} .msg .prose em{color:var(--msg-mute)}
${C} .msg .prose q{color:var(--msg-pill-text)}
${C} .msg .prose a{color:var(--msg-link)}
${C} .msg .prose pre{background:var(--msg-side);border:1px solid var(--msg-rail);border-radius:4px;color:var(--msg-text)}
${C}>.chat>.dockbar{position:static;flex:0 0 auto;padding:8px 20px 20px;padding-bottom:max(20px,env(safe-area-inset-bottom))}
${C}>.chat>.dockbar .cap{max-width:none;margin:0;gap:6px;padding:6px;border:0;border-radius:8px;background:var(--msg-input);backdrop-filter:none;box-shadow:none}
${C}>.chat>.dockbar .cap textarea{align-self:stretch;padding:10px 8px;border-radius:6px;background:var(--msg-input);color:var(--msg-text);font:16px/1.4 var(--rc-font-inter)}
${C}>.chat>.dockbar .cap textarea::placeholder{color:var(--msg-faint)}
${C}>.chat>.dockbar .cap :is(.tools,.send,.stop){align-self:flex-end;border:0;border-radius:6px;background:var(--msg-input);color:var(--msg-text);box-shadow:none}
${C} .greet{background:var(--msg-side);border-color:var(--msg-active);border-radius:8px;backdrop-filter:none}
@container (max-width:640px){
${C}>.chat>.scroll{padding:12px}
${C}>.chat>.dockbar{padding:6px 10px 12px}
}
`;
