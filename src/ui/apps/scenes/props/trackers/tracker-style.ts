/**
 * The tracker panels, to RoleCall's classes (immersion/index.tsx ImmersionPanelWrapper :420-640, ResourcesWingPanel.tsx): the frame (hero in a 16px
 * gutter, an action strip at 10px 16px on black/40, the settings drawer on zinc-900/60), then the Stats panel's tabs, gradient cards with their
 * soft corner glow, bars with a glowing gradient fill and a sheen, and the need rows. RoleCall animates these with framer-motion; here the same
 * moves are CSS: tabs lift 2px and grow 2% on hover and press to 95%, cards rise 10px and fade in 60ms apart, bars grow with a springy ease.
 * Reduced motion drops every one of them. Every colour is a theme token, set per element through --c (the bar, card or band it paints).
 * The first sheet is every theme's (flat fills, square ends); the second is RoleCall's, under html[data-chrome="rolecall"] (rc-chrome.ts), so no other theme takes the glows, gradients or motion.
 */
import { rcScope } from "../../rc-chrome";

const SHARED = `
.scs .trk{display:flex;flex-direction:column;min-height:0}
.scs .trk>.hero{margin:16px 16px 0}
.scs .trk-strip{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding:10px 16px;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);background:color-mix(in srgb,var(--stage-black) 40%,transparent)}
.scs .trk-badges,.scs .trk-actions{display:flex;align-items:center;gap:6px;min-width:0}
.scs .trk-tokens{padding:2px 8px;border:1px solid var(--stage-line);background:color-mix(in srgb,var(--stage-black) 60%,transparent);font:700 var(--text-meta)/1.4 var(--font-body);letter-spacing:.14em;text-transform:uppercase;color:var(--stage-soft)}
.scs .trk-btn{display:grid;place-items:center;padding:6px;border:1px solid var(--stage-line);background:color-mix(in srgb,var(--stage-black) 40%,transparent);color:var(--stage-soft);box-shadow:2px 2px 0 0 var(--stage-black);cursor:pointer}
.scs .trk-btn:hover,.scs .trk-btn.on{border-color:var(--w);color:var(--w)}
.scs .trk-settings{display:flex;flex-direction:column;gap:10px;padding:12px 16px;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);background:color-mix(in srgb,var(--stage-panel) 60%,transparent)}
.scs .trk-row{display:flex;align-items:center;justify-content:space-between;gap:12px;font:400 var(--text-control)/1.4 var(--font-body);color:var(--stage-soft)}
.scs .trk-row span{display:inline-flex;align-items:center;gap:6px}
.scs .trk-row select{padding:2px 6px;border:1px solid var(--stage-line);background:var(--stage-black);color:var(--stage-card);font:400 var(--text-control)/1.4 var(--font-body);cursor:pointer}
.scs .trk-row select:focus{outline:none;border-color:var(--w)}
.scs .trk-rule{border-top:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent)}
.scs .trk-clear{display:inline-flex;align-items:center;gap:6px;padding:4px 0;border:0;background:none;color:var(--stage-danger-text);font:400 var(--text-control)/1.4 var(--font-body);cursor:pointer;text-align:left}
.scs .trk-confirm p{margin:0 0 6px;color:var(--stage-danger-text);font:400 var(--text-control)/1.4 var(--font-body)}
.scs .trk-confirm div{display:flex;gap:8px}
.scs .trk-yes,.scs .trk-no{padding:4px 10px;border:0;font:400 var(--text-control)/1.4 var(--font-body);cursor:pointer}
.scs .trk-yes{background:var(--stage-danger-bg);color:var(--stage-danger-text)}
.scs .trk-no{background:var(--stage-black);color:var(--stage-soft)}
.scs .trk-error{margin:0;padding:8px 16px;background:var(--stage-danger-bg);color:var(--stage-danger-text);font:400 var(--text-control)/1.4 var(--font-body)}
.scs .trk-undo{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 16px;background:var(--stage-panel);color:var(--stage-soft);font:400 var(--text-control)/1.4 var(--font-body)}
.scs .trk-undo button{padding:2px 10px;border:1px solid var(--stage-line);background:var(--stage-black);color:var(--stage-card);font:700 var(--text-meta)/1.4 var(--font-body);letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
.scs .trk-body{flex:1;min-height:0}
.scs .st-tabs{display:flex;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);background:color-mix(in srgb,var(--stage-black) 20%,transparent)}
.scs .st-tabs button{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 12px;border:0;border-bottom:2px solid transparent;background:none;color:var(--stage-mute);font:500 var(--text-control)/1.4 var(--font-body);cursor:pointer}
.scs .st-tabs button:hover{color:var(--stage-card);background:color-mix(in srgb,var(--stage-card) 5%,transparent)}
.scs .st-tabs button.on{color:var(--stage-card);border-bottom-color:var(--stage-ok);background:color-mix(in srgb,var(--stage-ok) 5%,transparent)}
.scs .st-body{display:flex;flex-direction:column;gap:16px;padding:12px}
.scs .st-card{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid color-mix(in srgb,var(--c) 20%,transparent);background:linear-gradient(135deg,color-mix(in srgb,var(--c) 10%,transparent),transparent 70%)}
.scs .st-card .st-ic{padding:8px;border:1px solid color-mix(in srgb,var(--c) 30%,transparent);background:color-mix(in srgb,var(--c) 20%,transparent);color:var(--c);display:grid;place-items:center}
.scs .st-card b{font:700 var(--text-control)/1.4 var(--font-body);color:var(--stage-card)}
.scs .st-card small{display:block;font:400 var(--text-meta)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .st-card strong{margin-left:auto;font:700 1.125rem/1.4 var(--font-body);color:var(--c)}
.scs .st-card.st-shield b,.scs .st-card:not(.st-shield) b{flex:1}
.scs .st-card div b{flex:none}
.scs .st-bar{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);background:color-mix(in srgb,var(--stage-card) 4%,transparent)}
.scs .st-bar:hover{border-color:color-mix(in srgb,var(--stage-card) 10%,transparent)}
.scs .st-bar-head{display:flex;align-items:center;gap:8px}
.scs .st-bar-head .st-ic{padding:6px;border:1px solid color-mix(in srgb,var(--c) 40%,transparent);background:color-mix(in srgb,var(--c) 20%,transparent);color:var(--c);display:grid;place-items:center}
.scs .st-bar-head b{flex:1;font:500 var(--text-meta)/1.4 var(--font-body);color:var(--stage-soft)}
.scs .st-val{font:700 var(--text-control)/1.4 var(--font-mono);color:var(--stage-card)}
.scs .st-bar-row{display:flex;align-items:center;gap:8px}
.scs .st-step{display:grid;place-items:center;padding:6px;border:1px solid var(--stage-line);background:color-mix(in srgb,var(--stage-black) 50%,transparent);color:var(--stage-mute);cursor:pointer}
.scs .st-step:hover{color:var(--stage-card);border-color:var(--c)}
.scs .st-track{flex:1;height:12px;border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);background:var(--stage-black)}
.scs .st-track.thin{height:8px}
.scs .st-track div{height:100%;background:var(--c);transition:width .2s}
.scs .st-needs-head{display:flex;align-items:center;gap:8px;margin-bottom:12px;font:500 var(--text-meta)/1.4 var(--font-body);letter-spacing:.08em;text-transform:uppercase;color:var(--stage-mute)}
.scs .st-needs{display:flex;flex-direction:column;gap:4px}
.scs .st-need{display:flex;align-items:center;gap:8px;padding:8px;border:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);background:color-mix(in srgb,var(--stage-black) 40%,transparent)}
.scs .st-need .st-ic{padding:4px;background:color-mix(in srgb,var(--c) 15%,transparent);color:var(--c);display:grid;place-items:center}
.scs .st-need-label{width:64px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:400 var(--text-meta)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .st-need .st-step{padding:4px;opacity:0}
.scs .st-need:hover .st-step,.scs .st-need:focus-within .st-step{opacity:1}
.scs .st-need-val{width:48px;flex:none;text-align:right;font:400 var(--text-meta)/1.4 var(--font-mono);color:var(--stage-mute)}
.scs .st-loghead{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;font:400 var(--text-control)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .st-loghead button{border:0;background:none;color:var(--stage-mute);font:400 var(--text-meta)/1.4 var(--font-body);cursor:pointer}
.scs .st-loghead button:hover{color:var(--stage-card)}
.scs .st-log{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}
.scs .st-log li{display:flex;align-items:center;gap:8px;padding:8px;background:color-mix(in srgb,var(--stage-panel) 60%,transparent);font:400 var(--text-control)/1.4 var(--font-body)}
.scs .st-log-text{flex:1;color:var(--stage-soft)}
.scs .st-log-text i{font-style:normal;color:var(--stage-mute)}
.scs .st-delta{font:400 var(--text-control)/1.4 var(--font-mono)}
.scs .st-empty{padding:32px 0;text-align:center;color:var(--stage-line)}
.scs .st-empty p{margin:8px 0 0;font:400 var(--text-control)/1.4 var(--font-body);color:var(--stage-mute)}
`;

/** RoleCall's version of the sheet: the rules that differ, re-rooted under the rolecall chrome so no other theme takes them. */
const ROLECALL = `
.scs .trk{display:flex;flex-direction:column;min-height:0;font-family:var(--font-body)}
.scs .trk-badges{display:flex;align-items:center;gap:8px;min-width:0}
.scs .trk-actions{display:flex;align-items:center;gap:6px;min-width:0}
.scs .trk-tokens{padding:2px 8px;border:1px solid var(--rc-zinc-700);background:color-mix(in srgb,var(--stage-black) 60%,transparent);font:700 var(--rc-text-ctl)/1.43 var(--font-body);letter-spacing:.14em;text-transform:uppercase;color:var(--rc-zinc-300)}
.scs .trk-btn{display:grid;place-items:center;padding:6px;border:1px solid var(--rc-zinc-800);background:color-mix(in srgb,var(--stage-black) 40%,transparent);color:var(--rc-zinc-300);box-shadow:2px 2px 0 0 var(--stage-black);cursor:pointer;transition:color .15s,border-color .15s,background-color .15s}
.scs .trk-btn:hover{border-color:var(--w);color:var(--w)}
.scs .trk-btn.on{border-color:var(--w);background:color-mix(in srgb,var(--w) 15%,transparent);color:var(--rc-zinc-100)}
.scs .trk-btn:disabled{opacity:.5}
.scs .trk-settings{display:flex;flex-direction:column;gap:10px;padding:12px 16px;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);background:color-mix(in srgb,var(--rc-zinc-900) 60%,transparent)}
.scs .trk-row{display:flex;align-items:center;justify-content:space-between;gap:12px;font:400 var(--rc-text-sm)/1.43 var(--font-body);color:var(--rc-zinc-300)}
.scs .trk-row select{padding:2px 6px;border:1px solid var(--rc-zinc-700);border-radius:var(--rc-radius);background:var(--rc-zinc-800);color:var(--rc-zinc-100);font:400 var(--rc-text-wing)/1.5 var(--font-body);cursor:pointer}
.scs .trk-rule{border-top:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);margin:4px 0}
.scs .trk-clear{display:inline-flex;align-items:center;gap:6px;width:100%;padding:4px 0;border:0;background:none;color:var(--stage-danger-text);font:400 var(--rc-text-wing)/1.5 var(--font-body);cursor:pointer;text-align:left;transition:color .15s}
.scs .trk-clear:hover{color:color-mix(in srgb,var(--stage-danger-text) 80%,var(--stage-white))}
.scs .trk-confirm{padding:4px 0}
.scs .trk-confirm p{margin:0 0 6px;color:var(--stage-danger-text);font:400 var(--rc-text-wing)/1.5 var(--font-body)}
.scs .trk-yes,.scs .trk-no{padding:4px 10px;border:0;border-radius:var(--rc-radius);font:400 var(--rc-text-wing)/1.5 var(--font-body);cursor:pointer;transition:background-color .15s}
.scs .trk-yes{background:color-mix(in srgb,var(--stage-danger-text) 20%,transparent);color:var(--stage-danger-text)}
.scs .trk-yes:hover{background:color-mix(in srgb,var(--stage-danger-text) 30%,transparent)}
.scs .trk-no{background:var(--rc-zinc-800);color:var(--rc-zinc-300)}
.scs .trk-no:hover{background:var(--rc-zinc-700)}
.scs .trk-error{margin:0;padding:8px 16px;background:var(--stage-danger-bg);color:var(--stage-danger-text);font:400 var(--rc-text-wing)/1.5 var(--font-body)}
.scs .trk-undo{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 16px;background:var(--stage-panel);color:var(--rc-zinc-300);font:400 var(--rc-text-wing)/1.5 var(--font-body)}
.scs .trk-undo button{padding:2px 10px;border:1px solid var(--rc-zinc-700);background:var(--stage-black);color:var(--stage-card);font:700 var(--rc-text-ctl)/1.5 var(--font-body);letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
@keyframes trk-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.scs .st-tabs button{position:relative;flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 12px;border:0;border-bottom:2px solid transparent;background:none;color:var(--rc-zinc-400);font:500 var(--rc-text-sm)/1.43 var(--font-body);cursor:pointer;transition:all .15s}
.scs .st-tabs button:hover{color:var(--stage-white);background:color-mix(in srgb,var(--stage-card) 5%,transparent);transform:translateY(-2px) scale(1.02)}
.scs .st-tabs button:active{transform:scale(.95)}
.scs .st-tabs button.on{color:var(--stage-white);border-bottom-color:var(--stage-ok);background:color-mix(in srgb,var(--stage-ok) 5%,transparent)}
.scs .st-tabs button.on::before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(to bottom,color-mix(in srgb,var(--stage-ok) 10%,transparent),transparent);animation:trk-in .25s ease-out}
.scs .st-body>*{animation:trk-in .3s ease-out backwards}
.scs .st-body>*:nth-child(2){animation-delay:.06s}.scs .st-body>*:nth-child(3){animation-delay:.12s}.scs .st-body>*:nth-child(4){animation-delay:.18s}.scs .st-body>*:nth-child(5){animation-delay:.24s}
.scs .st-card{position:relative;overflow:hidden;display:flex;align-items:center;gap:12px;padding:12px;border:1px solid color-mix(in srgb,var(--c) 20%,transparent);border-radius:var(--rc-radius-sm);background:linear-gradient(135deg,color-mix(in srgb,var(--c) 10%,transparent) 0%,transparent 70%)}
.scs .st-card::before{content:"";position:absolute;top:0;right:0;width:96px;height:96px;border-radius:var(--rc-radius-full);background:var(--c);opacity:.05;filter:blur(40px);pointer-events:none}
.scs .st-card.st-shield{border-color:color-mix(in srgb,var(--c) 30%,transparent);background:linear-gradient(135deg,color-mix(in srgb,var(--c) 15%,transparent) 0%,color-mix(in srgb,var(--c) 5%,transparent) 100%)}
.scs .st-card>*{position:relative}
.scs .st-card .st-ic{padding:8px;border:1px solid color-mix(in srgb,var(--c) 30%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--c) 20%,transparent);color:var(--c);display:grid;place-items:center}
.scs .st-card b{font:700 var(--rc-text-sm)/1.43 var(--font-body);color:var(--stage-white)}
.scs .st-card.st-shield b{font-weight:500}
.scs .st-card small{display:block;font:400 var(--rc-text-xs)/1.33 var(--font-body);color:var(--rc-zinc-400)}
.scs .st-card strong{margin-left:auto;font:700 1.125rem/1.56 var(--font-body);color:var(--c)}
.scs .st-bar{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);border-radius:var(--rc-radius-sm);background:linear-gradient(to bottom right,color-mix(in srgb,var(--stage-card) 5%,transparent),transparent);transition:border-color .15s}
.scs .st-bar-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.scs .st-bar-head .st-ic{padding:6px;border:1px solid color-mix(in srgb,var(--c) 40%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--c) 20%,transparent);color:var(--c);display:grid;place-items:center}
.scs .st-bar-head b{flex:1;font:500 var(--rc-text-xs)/1.33 var(--font-body);color:var(--rc-zinc-300)}
.scs .st-val{font:700 var(--rc-text-sm)/1.43 var(--font-mono);color:var(--stage-white)}
.scs .st-step{display:grid;place-items:center;padding:6px;border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-800) 50%,transparent);color:var(--rc-zinc-500);cursor:pointer;transition:all .15s}
.scs .st-step:hover{color:var(--stage-danger-text);border-color:color-mix(in srgb,var(--stage-danger-text) 50%,transparent);background:color-mix(in srgb,var(--stage-danger-text) 10%,transparent);transform:scale(1.1)}
.scs .st-step:active{transform:scale(.9)}
.scs .st-bar-row .st-step:last-child:hover{color:var(--stage-ok);border-color:color-mix(in srgb,var(--stage-ok) 50%,transparent);background:color-mix(in srgb,var(--stage-ok) 10%,transparent)}
.scs .st-track{flex:1;height:12px;overflow:hidden;border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);border-radius:var(--rc-radius-full);background:var(--rc-zinc-900);box-shadow:inset 0 2px 4px 0 color-mix(in srgb,var(--stage-black) 5%,transparent)}
.scs .st-track.thin{height:8px;border-color:color-mix(in srgb,var(--stage-card) 5%,transparent);background:var(--rc-zinc-800);box-shadow:none}
.scs .st-track div{position:relative;height:100%;border-radius:var(--rc-radius-full);background:linear-gradient(90deg,var(--c) 0%,color-mix(in srgb,var(--c) 80%,transparent) 100%);box-shadow:0 0 10px color-mix(in srgb,var(--c) 31%,transparent),inset 0 1px 2px color-mix(in srgb,var(--stage-card) 30%,transparent);transition:width .35s cubic-bezier(.2,.9,.3,1.15)}
.scs .st-track div::after{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(to top,transparent,color-mix(in srgb,var(--stage-card) 20%,transparent),transparent)}
.scs .st-track.thin div{background:var(--c);box-shadow:none}
.scs .st-track.thin div::after{display:none}
.scs .st-needs-head{display:flex;align-items:center;gap:8px;margin:16px 0 12px;font:500 var(--rc-text-xs)/1.33 var(--font-body);letter-spacing:.05em;text-transform:uppercase;color:var(--rc-zinc-400)}
.scs .st-need{display:flex;align-items:center;gap:8px;padding:8px;border:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-900) 40%,transparent);transition:border-color .15s}
.scs .st-need:hover{border-color:color-mix(in srgb,var(--stage-card) 10%,transparent)}
.scs .st-need .st-ic{padding:4px;border-radius:var(--rc-radius);background:color-mix(in srgb,var(--c) 8%,transparent);color:var(--c);display:grid;place-items:center}
.scs .st-need-label{width:64px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:400 var(--rc-s-11px)/1.5 var(--font-body);color:var(--rc-zinc-400)}
.scs .st-need .st-step{padding:4px;border-color:color-mix(in srgb,var(--stage-card) 5%,transparent);border-radius:var(--rc-radius);color:var(--rc-zinc-600);opacity:0}
.scs .st-need-val{width:40px;flex:none;text-align:right;font:400 var(--rc-s-10px)/1.5 var(--font-mono);color:var(--rc-zinc-500)}
.scs .st-logwrap{display:flex;flex-direction:column;gap:8px}
.scs .st-loghead{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;font:400 var(--rc-text-sm)/1.43 var(--font-body);color:var(--rc-zinc-400)}
.scs .st-loghead button{border:0;background:none;color:var(--rc-zinc-500);font:400 var(--rc-text-xs)/1.33 var(--font-body);cursor:pointer;transition:color .15s}
.scs .st-loghead button:hover{color:var(--rc-zinc-300)}
.scs .st-log li{display:flex;align-items:center;gap:8px;padding:8px;border-radius:var(--rc-radius);background:color-mix(in srgb,var(--rc-zinc-800) 30%,transparent);font:400 var(--rc-text-sm)/1.43 var(--font-body)}
.scs .st-log-text{flex:1;color:var(--rc-zinc-300)}
.scs .st-log-text i{margin-left:4px;font-style:normal;color:var(--rc-zinc-500)}
.scs .st-delta{font:400 var(--rc-text-sm)/1.43 var(--font-mono)}
.scs .st-empty{padding:32px 0;text-align:center;color:var(--rc-zinc-600)}
.scs .st-empty p{margin:8px 0 0;font:400 var(--rc-text-sm)/1.43 var(--font-body);color:var(--rc-zinc-500)}
@media (prefers-reduced-motion:reduce){.scs .st-body>*,.scs .st-tabs button.on::before{animation:none}.scs .st-tabs button,.scs .st-step,.scs .st-track div{transition:none}.scs .st-tabs button:hover,.scs .st-step:hover{transform:none}}
`;

export const TRACKER_STYLE = SHARED + rcScope(ROLECALL);
