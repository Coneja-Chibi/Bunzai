/** The Combat panel, to RoleCall's classes (BattleWingPanel.tsx:590-935, immersion/battle/EnemyCard.tsx, TurnOrderDisplay.tsx, CombatLog.tsx, DiceRoller.tsx): the pulsing
 * IN COMBAT pill, the red round bar with its glow, the dashed add button, the enemy card (violet when it is the current turn, with its marker bar), the turn list, the
 * log and the dice. RoleCall's violet is the select role and its red the danger role; 10px and 11px text is RoleCall's own. * The first sheet is every theme's (flat fills, square ends); the second is RoleCall's, under html[data-chrome="rolecall"] (rc-chrome.ts), so no other theme takes the glows, gradients or motion.
 */
import { rcScope } from "../../../rc-chrome";

const SHARED = `
.scs .bt-live{padding:2px 8px;background:var(--stage-danger-bg);color:var(--stage-danger-text);font:700 var(--text-meta)/1.4 var(--font-body);letter-spacing:.08em}
.scs .bt-round{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border-bottom:1px solid var(--stage-danger-edge);background:linear-gradient(180deg,color-mix(in srgb,var(--stage-danger-text) 10%,transparent),transparent)}
.scs .bt-roundtag{padding:4px 10px;border:1px solid var(--stage-danger-edge);background:var(--stage-danger-bg);color:var(--stage-danger-text);font:700 var(--text-meta)/1.4 var(--font-body)}
.scs .bt-pips{display:flex;gap:4px;align-items:center}
.scs .bt-pips i{width:8px;height:8px;background:var(--stage-line)}
.scs .bt-pips i.now{width:16px;background:var(--stage-var)}
.scs .bt-enemy{position:relative;display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);background:color-mix(in srgb,var(--stage-panel) 60%,transparent)}
.scs .bt-enemy:hover{border-color:color-mix(in srgb,var(--stage-card) 15%,transparent)}
.scs .bt-enemy.now{border-color:var(--stage-var);background:color-mix(in srgb,var(--stage-var) 10%,transparent)}
.scs .bt-enemy.down{opacity:.5}
.scs .bt-enemy header{display:flex;align-items:flex-start;gap:8px}
.scs .bt-threat{display:grid;place-items:center;width:32px;height:32px;flex:none;background:color-mix(in srgb,currentColor 12%,transparent)}
.scs .bt-name{flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.scs .bt-name b{font:500 var(--text-control)/1.4 var(--font-body);color:var(--stage-card)}
.scs .bt-hp{flex-basis:100%;font:400 var(--text-meta)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .bt-tag{padding:1px 6px;background:color-mix(in srgb,var(--stage-card) 6%,transparent);color:var(--stage-soft);font:400 var(--text-meta)/1.4 var(--font-body)}
.scs .bt-tag.boss{background:color-mix(in srgb,var(--stage-warn) 20%,transparent);color:var(--stage-warn);font-weight:700}
.scs .bt-tags{display:flex;flex-wrap:wrap;gap:4px}
.scs .bt-bar{height:8px;background:color-mix(in srgb,var(--stage-line) 50%,transparent)}
.scs .bt-bar div{height:100%;transition:width .2s}
.scs .bt-dmg{display:flex;gap:8px;padding:8px;border:1px solid var(--stage-line);background:var(--stage-black)}
.scs .bt-dmg input,.scs .bt-add input,.scs .bt-add select,.scs .bt-dice-custom input{flex:1;min-width:0;padding:6px 10px;border:1px solid var(--stage-line);background:var(--stage-panel);color:var(--stage-card);font:400 var(--text-control)/1.4 var(--font-body)}
.scs .bt-dmg input:focus,.scs .bt-add input:focus,.scs .bt-dice-custom input:focus{outline:none;border-color:var(--stage-var)}
.scs .bt-add{display:flex;flex-direction:column;gap:12px;padding:16px;border:1px solid var(--stage-line);background:var(--stage-panel)}
.scs .bt-add h3{margin:0;font:600 1.125rem/1.4 var(--font-body);color:var(--stage-card)}
.scs .bt-add label{display:flex;flex-direction:column;gap:4px;font:400 var(--text-meta)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .bt-add .bt-check{flex-direction:row;align-items:center;gap:8px;font-size:var(--text-control);color:var(--stage-soft)}
.scs .bt-add .bt-check input{flex:none}
.scs .bt-two{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.scs .bt-turns-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font:500 var(--text-control)/1.4 var(--font-body);color:var(--stage-card)}
.scs .bt-turns-head span{display:inline-flex;align-items:center;gap:8px}
.scs .bt-turn{display:flex;align-items:center;gap:8px;margin-bottom:4px;padding:6px 8px;border:1px solid transparent;background:color-mix(in srgb,var(--stage-panel) 40%,transparent);font:400 var(--text-control)/1.4 var(--font-body);color:var(--stage-soft)}
.scs .bt-turn i{width:20px;height:20px;background:var(--stage-line)}
.scs .bt-turn.now{border-color:var(--stage-var);background:color-mix(in srgb,var(--stage-var) 20%,transparent);color:var(--stage-card)}
.scs .bt-turn.now i{background:var(--stage-var)}
.scs .bt-turn.down{opacity:.4}
.scs .bt-empty{margin:0;padding:32px 0;text-align:center;font:400 var(--text-control)/1.5 var(--font-body);color:var(--stage-mute)}
.scs .bt-empty small{display:block;color:var(--stage-line)}
.scs .bt-empty p{margin:8px 0 4px;color:var(--stage-mute)}
.scs .bt-log-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font:400 var(--text-control)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .bt-log ul,.scs .bt-hist ul{display:flex;flex-direction:column;gap:4px;margin:0;padding:0;list-style:none;max-height:400px;overflow:auto}
.scs .bt-log li,.scs .bt-hist li{display:flex;justify-content:space-between;gap:8px;padding:6px 8px;background:color-mix(in srgb,var(--stage-panel) 60%,transparent);font:400 var(--text-meta)/1.5 var(--font-mono);color:var(--stage-soft)}
.scs .bt-dice{display:flex;flex-direction:column;gap:12px}
.scs .bt-dice-title{display:flex;align-items:center;gap:8px;font:500 var(--text-control)/1.4 var(--font-body);color:var(--stage-card)}
.scs .bt-dice-row{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
.scs .bt-dice-custom{display:flex;gap:8px}
.scs .bt-roll{display:flex;flex-direction:column;align-items:center;gap:4px;padding:16px;border:1px solid var(--stage-line);background:var(--stage-panel)}
.scs .bt-roll small{font:400 var(--text-meta)/1.4 var(--font-mono);color:var(--stage-mute)}
.scs .bt-roll b{font:700 2.25rem/1.1 var(--font-body);color:var(--c)}
.scs .bt-roll span{font:400 var(--text-meta)/1.4 var(--font-mono);color:var(--stage-mute)}
`;

/** RoleCall's version of the sheet: the rules that differ, re-rooted under the rolecall chrome so no other theme takes them. */
const ROLECALL = `
.scs .bt-live{padding:2px 8px;border-radius:var(--rc-radius-full);background:color-mix(in srgb,var(--stage-danger-text) 20%,transparent);color:var(--stage-danger-text);font:500 var(--rc-s-10px)/1.5 var(--font-body);animation:bt-pulse 2s cubic-bezier(.4,0,.6,1) infinite}
@keyframes bt-pulse{50%{opacity:.5}}
@media (prefers-reduced-motion:reduce){.scs .bt-live,.scs .bt-roundtag::before{animation:none}}
.scs .bt-round{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border-bottom:1px solid color-mix(in srgb,var(--stage-danger-text) 20%,transparent);background:linear-gradient(to bottom,color-mix(in srgb,var(--stage-danger-text) 10%,transparent),transparent)}
.scs .bt-roundtag{position:relative;isolation:isolate;padding:4px 10px;border:1px solid color-mix(in srgb,var(--stage-danger-text) 30%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--stage-danger-text) 20%,transparent);color:var(--stage-danger-text);font:700 var(--rc-text-xs)/1.33 var(--font-body)}
.scs .bt-roundtag::before{content:"";position:absolute;inset:0;z-index:-1;border-radius:var(--rc-radius-full);background:var(--stage-danger-text);opacity:.2;filter:blur(8px);animation:bt-pulse 2s cubic-bezier(.4,0,.6,1) infinite}
.scs .bt-pips{display:flex;gap:2px;align-items:center}
.scs .bt-pips i{width:8px;height:8px;border-radius:var(--rc-radius-full);background:var(--rc-zinc-700);transition:all .15s}
.scs .bt-pips i.now{width:16px;background:var(--bk-role-select)}
.scs .bt-enemy{position:relative;display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-800) 60%,transparent);transition:border-color .15s}
.scs .bt-enemy.now{border-color:color-mix(in srgb,var(--bk-role-select) 40%,transparent);background:color-mix(in srgb,var(--bk-role-select) 10%,transparent);box-shadow:0 10px 15px -3px color-mix(in srgb,var(--bk-role-select) 10%,transparent),0 4px 6px -4px color-mix(in srgb,var(--bk-role-select) 10%,transparent)}
.scs .bt-enemy.now::before{content:"";position:absolute;left:-4px;top:50%;width:4px;height:32px;transform:translateY(-50%);border-radius:var(--rc-radius-full);background:var(--bk-role-select)}
.scs .bt-threat{display:grid;place-items:center;width:32px;height:32px;flex:none;border-radius:var(--rc-radius-sm);background:color-mix(in srgb,currentColor 12%,transparent)}
.scs .bt-name{flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.scs .bt-name b{font:500 1rem/1.5 var(--font-body);color:var(--stage-white);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scs .bt-hp{flex-basis:100%;margin-top:-4px;font:400 var(--rc-text-xs)/1.33 var(--font-body);color:var(--rc-zinc-400)}
.scs .bt-tag{padding:2px 6px;border-radius:var(--rc-radius);background:color-mix(in srgb,var(--stage-card) 5%,transparent);color:var(--rc-zinc-400);font:400 var(--rc-s-10px)/1.5 var(--font-body)}
.scs .bt-tags .bt-tag{color:var(--rc-zinc-300)}
.scs .bt-tag.boss{background:color-mix(in srgb,var(--stage-warn) 20%,transparent);color:var(--stage-warn);font-weight:500}
.scs .bt-bar{height:8px;overflow:hidden;border-radius:var(--rc-radius-full);background:color-mix(in srgb,var(--rc-zinc-700) 50%,transparent)}
.scs .bt-bar div{height:100%;border-radius:var(--rc-radius-full);transition:width .3s cubic-bezier(.2,.9,.3,1.1)}
.scs .bt-dmg{display:flex;gap:8px;padding:8px;border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-900) 95%,transparent);backdrop-filter:blur(12px);box-shadow:0 20px 25px -5px color-mix(in srgb,var(--stage-black) 10%,transparent),0 8px 10px -6px color-mix(in srgb,var(--stage-black) 10%,transparent)}
.scs .bt-dmg input,.scs .bt-add input,.scs .bt-add select,.scs .bt-dice-custom input{flex:1;min-width:0;padding:8px 12px;border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);border-radius:var(--rc-radius);background:color-mix(in srgb,var(--rc-zinc-800) 50%,transparent);color:var(--stage-card);font:400 var(--rc-text-sm)/1.43 var(--font-body)}
.scs .bt-dmg input{padding:6px 8px}
.scs .bt-dice-custom input{background:color-mix(in srgb,var(--rc-zinc-800) 40%,transparent);border-color:color-mix(in srgb,var(--stage-card) 5%,transparent)}
.scs .bt-dmg input:focus,.scs .bt-add input:focus,.scs .bt-dice-custom input:focus{outline:none;border-color:color-mix(in srgb,var(--bk-role-select) 50%,transparent)}
.scs .bt-add{display:flex;flex-direction:column;gap:12px;padding:16px;border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-900) 95%,transparent);backdrop-filter:blur(12px)}
.scs .bt-add h3{margin:0 0 4px;font:600 1.125rem/1.56 var(--font-body);color:var(--stage-white)}
.scs .bt-add label{display:flex;flex-direction:column;gap:4px;font:400 var(--rc-text-xs)/1.33 var(--font-body);color:var(--rc-zinc-400)}
.scs .bt-add .bt-check{flex-direction:row;align-items:center;gap:8px;font:400 var(--rc-text-sm)/1.43 var(--font-body);color:var(--rc-zinc-300)}
.scs .bt-turns-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font:500 var(--rc-text-sm)/1.43 var(--font-body);color:var(--stage-white)}
.scs .bt-turns-head svg{color:var(--bk-role-select-text)}
.scs .bt-turn{display:flex;align-items:center;gap:8px;margin-bottom:4px;padding:6px 8px;border:1px solid transparent;border-radius:var(--rc-radius);background:color-mix(in srgb,var(--rc-zinc-800) 40%,transparent);font:400 var(--rc-text-sm)/1.43 var(--font-body);color:var(--rc-zinc-300);transition:border-color .15s}
.scs .bt-turn:hover{border-color:color-mix(in srgb,var(--stage-card) 10%,transparent)}
.scs .bt-turn i{width:20px;height:20px;border-radius:var(--rc-radius);background:var(--rc-zinc-700)}
.scs .bt-turn.now{border-color:color-mix(in srgb,var(--bk-role-select) 40%,transparent);background:color-mix(in srgb,var(--bk-role-select) 20%,transparent);color:var(--stage-white);font-weight:500}
.scs .bt-turn.now i{background:var(--bk-role-select)}
.scs .bt-empty{margin:0;padding:48px 0;text-align:center;font:400 var(--rc-text-xs)/1.33 var(--font-body);color:var(--rc-zinc-600)}
.scs .bt-empty small{display:block;color:var(--rc-zinc-600)}
.scs .bt-empty p{margin:8px 0 4px;font:500 var(--rc-text-sm)/1.43 var(--font-body);color:var(--rc-zinc-400)}
.scs .bt-log,.scs .bt-hist{display:flex;flex-direction:column;overflow:hidden;border:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-800) 40%,transparent)}
.scs .bt-log-head{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);font:500 var(--rc-text-sm)/1.43 var(--font-body);color:var(--stage-white)}
.scs .bt-log ul,.scs .bt-hist ul{display:flex;flex-direction:column;gap:4px;margin:0;padding:8px;list-style:none;max-height:400px;overflow:auto}
.scs .bt-log li,.scs .bt-hist li{display:flex;justify-content:space-between;gap:8px;padding:4px 8px;border-radius:var(--rc-radius);font:400 var(--rc-text-xs)/1.625 var(--font-body);color:var(--rc-zinc-300)}
.scs .bt-log li:hover,.scs .bt-hist li:hover{background:color-mix(in srgb,var(--stage-card) 5%,transparent)}
.scs .bt-dice-title{display:flex;align-items:center;gap:8px;font:500 var(--rc-text-sm)/1.43 var(--font-body);color:var(--stage-white)}
.scs .bt-dice-title svg{color:var(--bk-role-select-text)}
.scs .bt-dice-row{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
.scs .bt-roll{display:flex;flex-direction:column;align-items:center;gap:4px;padding:16px;border:1px solid color-mix(in srgb,var(--bk-role-select) 20%,transparent);border-radius:var(--rc-radius-sm);background:linear-gradient(to bottom right,color-mix(in srgb,var(--bk-role-select) 10%,transparent),color-mix(in srgb,var(--bk-role-select) 10%,transparent))}
.scs .bt-roll small{font:400 var(--rc-text-xs)/1.33 var(--font-body);color:var(--rc-zinc-400)}
.scs .bt-roll b{font:700 2.25rem/1.11 var(--font-body);color:var(--stage-white)}
.scs .bt-roll span{font:400 var(--rc-text-xs)/1.33 var(--font-body);color:var(--rc-zinc-300)}
`;

export const BATTLE_STYLE = SHARED + rcScope(ROLECALL);
