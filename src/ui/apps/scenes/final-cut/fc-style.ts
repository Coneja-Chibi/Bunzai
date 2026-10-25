/**
 * The Final Cut tab's look (RoleCall's PostProductionPanel.module.css and UserBanksCard.module.css, on the wing look in preset-style.ts and
 * prompting-style.ts): cards with a per-pass accent (`--p`, a theme token), the stats strip, the controls, the bank picker and its rows, the
 * saved lists, the contract and the activity dialog. Every theme gets the first sheet (square corners, one-pixel lines, theme tokens). RoleCall's chrome adds the second, which is
 * RoleCall's neobrut panel: 3px ink frames, 3px offset shadows (6px in the pass colour when a pass is on), a 2px rule under each card header, a framed hero, Cinzel titles and JetBrains
 * Mono labels at .55rem to .78rem (rc-chrome.ts: the sub-12px sizes are RoleCall's alone). It sits under html[data-chrome="rolecall"], so no other theme takes it.
 */
import { rcScope } from "../rc-chrome";

const SHARED = `
.scs .fc-wing{gap:0}
.scs .fc-wing>section,.scs .fc-wing>div:not(.hero){margin:0 20px 12px}
.scs .fc-card{border:1px solid var(--stage-line);background:color-mix(in srgb,var(--stage-panel) 70%,transparent);padding:14px;box-shadow:inset 3px 0 0 color-mix(in srgb,var(--p,var(--w)) 40%,transparent)}
.scs .fc-card.on{box-shadow:inset 3px 0 0 var(--p,var(--w))}
.scs .fc-card>header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}
.scs .fc-card .kick{font:700 var(--text-meta) var(--font-mono);letter-spacing:.18em;text-transform:uppercase;color:var(--p,var(--w))}
.scs .fc-card h3,.scs .fc-card h4{margin:2px 0 4px;font:800 1.1rem var(--font-fancy);letter-spacing:.04em;text-transform:uppercase;color:var(--stage-card)}
.scs .fc-card p,.scs .fc-hint{margin:0 0 8px;font:var(--text-body)/1.5 var(--font-ui);color:var(--stage-text-dim)}
.scs .fc-hint{font-size:var(--text-meta);color:var(--stage-mute)}
.scs .fc-meta{display:inline-block;padding:3px 8px;border:1px solid var(--stage-seam);font:700 var(--text-meta) var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--stage-soft)}
.scs .fc-live{flex:none;padding:6px 14px;border:2px solid var(--stage-line);background:none;color:var(--stage-text-dim);font:800 var(--text-control) var(--font-ui);letter-spacing:.12em;text-transform:uppercase;cursor:pointer}
.scs .fc-live.on{border-color:var(--p,var(--w));background:var(--p,var(--w));color:var(--stage-black)}
.scs .fc-master{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--stage-line);background:color-mix(in srgb,var(--stage-panel) 70%,transparent);padding:12px 14px}
.scs .fc-master b{font:800 1rem var(--font-fancy);letter-spacing:.06em;text-transform:uppercase;color:var(--stage-card)}
.scs .fc-master p{margin:2px 0 0;font:var(--text-body)/1.4 var(--font-ui);color:var(--stage-text-dim)}
.scs .fc-master.on{border-color:var(--w)}
.scs .fc-master .fc-live{--p:var(--w)}
.scs .fc-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
.scs .fc-stats div{border:1px solid var(--stage-line);background:color-mix(in srgb,var(--stage-panel) 70%,transparent);padding:10px 12px}
.scs .fc-stats small{display:block;font:700 var(--text-meta) var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--stage-mute)}
.scs .fc-stats b{display:block;margin-top:4px;font:800 1.2rem var(--font-mono);color:var(--w)}
.scs .fc-error{padding:8px 12px;border:1px solid var(--stage-danger-edge);background:var(--stage-danger-bg);color:var(--stage-danger-text);font:var(--text-control) var(--font-ui)}
.scs .fc-note{padding:10px 12px;border:1px dashed var(--stage-seam);font:var(--text-body) var(--font-ui);color:var(--stage-text-dim)}
.scs .fc-off{padding:10px 12px;border:1px dashed var(--stage-seam);font:var(--text-meta)/1.5 var(--font-mono);color:var(--stage-mute)}
.scs .fc-controls{display:flex;flex-direction:column;gap:12px}
.scs .fc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;align-items:start}
.scs .fc-grid-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;align-items:start}
.scs .fc-wing>.fc-grid-cards,.scs .fc-wing>.fc-full{margin:0 20px 12px}
.scs .fc-label{display:flex;flex-direction:column;gap:6px;font:700 var(--text-meta) var(--font-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--stage-soft)}
.scs .fc-label small{font:var(--text-meta) var(--font-mono);letter-spacing:0;text-transform:none;color:var(--stage-mute)}
.scs .fc-select,.scs .fc-field,.scs .fc-area{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--stage-line);background:color-mix(in srgb,var(--stage-black) 60%,transparent);color:var(--stage-card);font:var(--text-control) var(--font-ui)}
.scs .fc-area{min-height:84px;resize:vertical;font-family:var(--font-ui)}
.scs .fc-select:focus,.scs .fc-field:focus,.scs .fc-area:focus{outline:0;border-color:var(--p,var(--w))}
.scs .fc-field.mono{font-family:var(--font-mono)}
.scs .fc-select.attach{margin-top:8px}
.scs .fc-switches{display:flex;flex-direction:column;gap:6px}
.scs .fc-check,.scs .fc-entry,.scs .fc-switch{display:flex;align-items:flex-start;gap:8px;cursor:pointer;font:var(--text-control) var(--font-ui);color:var(--stage-text-dim)}
.scs .fc-check input,.scs .fc-entry input,.scs .fc-switch input{position:absolute;opacity:0;width:0;height:0}
.scs .fc-box{flex:none;width:16px;height:16px;margin-top:1px;border:2px solid var(--stage-mute);background:none}
.scs .fc-check input:checked+.fc-box,.scs .fc-entry input:checked+.fc-box,.scs .fc-switch input:checked+.fc-box{border-color:var(--p,var(--w));background:var(--p,var(--w))}
.scs .fc-check input:focus-visible+.fc-box,.scs .fc-entry input:focus-visible+.fc-box,.scs .fc-switch input:focus-visible+.fc-box{outline:2px solid var(--w);outline-offset:2px}
.scs .fc-entry b{display:block;color:var(--stage-card)}
.scs .fc-entry em{display:block;font:var(--text-meta) var(--font-mono);font-style:normal;color:var(--stage-mute)}
.scs .fc-range{padding:10px 12px;background:color-mix(in srgb,var(--stage-black) 40%,transparent)}
.scs .fc-range .head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font:var(--text-control) var(--font-ui);color:var(--stage-text-dim)}
.scs .fc-range .head b{color:var(--p,var(--w));font-family:var(--font-mono)}
.scs .fc-range small{display:block;margin-top:6px;font:var(--text-meta) var(--font-mono);color:var(--stage-mute)}
.scs .fc-sub{display:flex;flex-direction:column;gap:2px;margin-bottom:6px}
.scs .fc-sub b{font:700 var(--text-meta) var(--font-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--stage-soft)}
.scs .fc-sub small{font:var(--text-meta)/1.4 var(--font-ui);color:var(--stage-mute)}
.scs .fc-link{margin-top:6px;padding:0;border:0;background:none;color:var(--w);font:var(--text-control) var(--font-ui);text-decoration:underline;cursor:pointer}
.scs .fc-btn{display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border:1px solid var(--stage-line);background:none;color:var(--stage-text-dim);font:700 var(--text-meta) var(--font-ui);letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
.scs .fc-btn:hover{border-color:var(--stage-mute);color:var(--stage-card)}
.scs .fc-btn.go{border-color:var(--p,var(--w));background:color-mix(in srgb,var(--p,var(--w)) 18%,transparent);color:var(--stage-card)}
.scs .fc-btn.red:hover{border-color:var(--stage-danger-edge);background:var(--stage-danger-bg);color:var(--stage-danger-text)}
.scs .fc-btn.hot{border-color:var(--stage-danger-edge);background:var(--stage-danger-bg);color:var(--stage-danger-text)}
.scs .fc-btn:disabled{opacity:.5;cursor:default}
.scs .fc-chip,.scs .fc-tag{padding:2px 6px;border:1px solid var(--stage-seam);font:700 var(--text-meta) var(--font-mono);letter-spacing:.04em;text-transform:uppercase;color:var(--stage-soft)}
.scs .fc-tag.warn{border-color:var(--stage-warn);color:var(--stage-warn);display:inline-flex;align-items:center;gap:3px}
.scs .fc-fold{border:1px solid var(--stage-seam);background:color-mix(in srgb,var(--stage-black) 30%,transparent)}
.scs .fc-fold>summary{display:flex;justify-content:space-between;gap:8px;padding:8px 12px;cursor:pointer;font:700 var(--text-meta) var(--font-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--stage-soft)}
.scs .fc-fold>summary small{font:var(--text-meta) var(--font-mono);letter-spacing:0;text-transform:none;color:var(--stage-mute)}
.scs .fc-fold-body{display:flex;flex-direction:column;gap:12px;padding:0 12px 12px}
.scs .fc-explain{padding:10px 12px;border-left:3px solid var(--p,var(--w));background:color-mix(in srgb,var(--stage-black) 40%,transparent)}
.scs .fc-explain b{font:800 var(--text-control) var(--font-ui);letter-spacing:.1em;text-transform:uppercase;color:var(--stage-card)}
.scs .fc-explain p{margin:4px 0 0;font:var(--text-body)/1.45 var(--font-ui);color:var(--stage-text-dim)}
.scs .fc-explain code{display:block;margin-top:6px;font:var(--text-meta) var(--font-mono);color:var(--stage-soft)}
.scs .fc-mode .pg-opt small code{font-family:var(--font-mono)}
.scs .fc-sec{display:flex;flex-direction:column;gap:2px}
.scs .fc-sec h4{margin:0}
.scs .fc-sec span{font:var(--text-meta) var(--font-ui);color:var(--stage-mute)}
.scs .fc-sets{display:flex;flex-direction:column;gap:10px}
.scs .fc-search{display:flex;flex-direction:column;gap:6px;font:700 var(--text-meta) var(--font-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--stage-soft)}
.scs .fc-search .box{display:flex;gap:6px}
.scs .fc-search input{flex:1;min-width:0;padding:8px 10px;border:1px solid var(--stage-line);background:color-mix(in srgb,var(--stage-black) 60%,transparent);color:var(--stage-card);font:var(--text-control) var(--font-ui);text-transform:none;letter-spacing:0}
.scs .fc-search button{padding:6px 10px;border:1px solid var(--stage-line);background:none;color:var(--stage-text-dim);cursor:pointer}
.scs .fc-setlist,.scs .fc-results,.scs .fc-rules,.scs .fc-floor{display:flex;flex-direction:column;gap:8px}
.scs .fc-set{border:1px solid var(--stage-seam);background:color-mix(in srgb,var(--stage-black) 30%,transparent)}
.scs .fc-set.open{border-color:var(--p,var(--w))}
.scs .fc-set .head{display:flex;align-items:center;gap:8px;width:100%;padding:10px 12px;border:0;background:none;text-align:left;color:var(--stage-text-dim);cursor:pointer}
.scs .fc-set .id{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.scs .fc-set .id b{font:800 var(--text-control) var(--font-ui);letter-spacing:.08em;text-transform:uppercase;color:var(--stage-card)}
.scs .fc-set .id small{font:var(--text-meta)/1.4 var(--font-ui);color:var(--stage-mute);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.scs .fc-set .count{flex:none;padding:2px 8px;border:1px solid var(--stage-seam);font:700 var(--text-meta) var(--font-mono);color:var(--stage-soft)}
.scs .fc-set .count.full{border-color:var(--stage-ok);color:var(--stage-ok)}
.scs .fc-set .count.zero{color:var(--stage-mute)}
.scs .fc-set .acts{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 10px}
.scs .fc-set .banks{display:flex;flex-direction:column;gap:6px;padding:0 12px 12px}
.scs .fc-bank{border:1px solid var(--stage-seam);background:none;text-align:left}
.scs .fc-bank.on{border-color:var(--p,var(--w));background:color-mix(in srgb,var(--p,var(--w)) 8%,transparent)}
button.fc-bank{display:flex;width:100%;padding:8px 10px;color:inherit;cursor:pointer}
.scs .fc-bank .head{display:flex;align-items:stretch}
.scs .fc-bank .main{flex:1;min-width:0;display:flex;gap:10px;padding:8px 10px;border:0;background:none;text-align:left;color:inherit;cursor:pointer}
.scs .fc-bank .more{flex:none;width:32px;border:0;border-left:1px solid var(--stage-seam);background:none;color:var(--stage-soft);cursor:pointer;font:700 var(--text-control) var(--font-mono)}
.scs .fc-tick{flex:none;width:18px;height:18px;margin-top:1px;display:grid;place-items:center;border:2px solid var(--stage-mute);color:var(--stage-black)}
.scs .fc-bank.on .fc-tick{border-color:var(--p,var(--w));background:var(--p,var(--w))}
.scs .fc-bank-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.scs .fc-bank-body .row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.scs .fc-bank-body .row b{font:800 var(--text-control) var(--font-ui);letter-spacing:.06em;text-transform:uppercase;color:var(--stage-card)}
.scs .fc-bank-body .row small{font:var(--text-meta) var(--font-mono);color:var(--stage-mute);text-transform:uppercase}
.scs .fc-bank-body .why{font:var(--text-meta)/1.45 var(--font-ui);color:var(--stage-text-dim)}
.scs .fc-bank .bans{display:flex;flex-wrap:wrap;align-items:center;gap:4px}
.scs .fc-bank .bans i{font:700 var(--text-meta) var(--font-mono);font-style:normal;text-transform:uppercase;color:var(--stage-mute)}
.scs .fc-bank .bans em{padding:1px 6px;border:1px solid var(--stage-seam);font:var(--text-meta) var(--font-mono);font-style:normal;color:var(--stage-soft)}
.scs .fc-bank .bans small{font:var(--text-meta) var(--font-mono);color:var(--stage-mute)}
.scs .fc-bank .detail{display:flex;flex-direction:column;gap:10px;padding:10px 12px;border-top:1px solid var(--stage-seam)}
.scs .fc-depth .opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px;margin:6px 0}
.scs .fc-depth .opts button{display:flex;flex-direction:column;gap:2px;padding:6px 8px;border:1px solid var(--stage-seam);background:none;text-align:left;color:var(--stage-text-dim);cursor:pointer}
.scs .fc-depth .opts button.on{border-color:var(--p,var(--w));background:color-mix(in srgb,var(--p,var(--w)) 12%,transparent);color:var(--stage-card)}
.scs .fc-depth .opts span,.scs .fc-depth small{font:var(--text-meta) var(--font-mono);color:var(--stage-mute)}
.scs .fc-bank .block .bh{display:flex;justify-content:space-between;gap:8px;margin-bottom:4px;font:700 var(--text-meta) var(--font-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--stage-soft)}
.scs .fc-bank .block.skipped{opacity:.6}
.scs .fc-bank .block ul{margin:0;padding-left:18px;font:var(--text-meta)/1.5 var(--font-ui);color:var(--stage-text-dim)}
.scs .fc-bank .block li.out,.scs .fc-bank .words .out{opacity:.45}
.scs .fc-bank .words{display:flex;flex-wrap:wrap;gap:4px}
.scs .fc-bank .words span{padding:1px 6px;border:1px solid var(--stage-seam);font:var(--text-meta) var(--font-mono);color:var(--stage-soft)}
.scs .fc-bank .block p{margin:0;font:var(--text-body)/1.5 var(--font-ui);color:var(--stage-text-dim)}
.scs .fc-kind{padding:1px 6px;border:1px solid var(--stage-seam);font:700 var(--text-meta) var(--font-mono);text-transform:uppercase;color:var(--stage-soft)}
.scs .fc-results .sum{font:700 var(--text-meta) var(--font-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--stage-mute)}
.scs .fc-results article{padding:10px 12px;border:1px solid var(--stage-seam)}
.scs .fc-results article.on{border-color:var(--p,var(--w))}
.scs .fc-results .head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
.scs .fc-results .head b{display:block;font:800 var(--text-control) var(--font-ui);color:var(--stage-card)}
.scs .fc-results .head small{font:var(--text-meta) var(--font-mono);color:var(--stage-mute)}
.scs .fc-results .hits{display:flex;flex-direction:column;gap:4px;margin-bottom:6px}
.scs .fc-results .hits div{display:flex;justify-content:space-between;gap:8px;align-items:center}
.scs .fc-results .hits span{font:var(--text-meta) var(--font-mono);color:var(--stage-soft)}
.scs .fc-saved header,.scs .fc-banks header{margin-bottom:8px}
.scs .fc-save-row{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
.scs .fc-save-row .line,.scs .fc-example{display:flex;gap:6px}
.scs .fc-save-row small{font:var(--text-meta) var(--font-ui);color:var(--stage-mute)}
.scs .fc-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}
.scs .fc-list>li{border:1px solid var(--stage-seam)}
.scs .fc-list>li.on{border-color:var(--p,var(--w))}
.scs .fc-list .line,.scs .fc-list>li>.body{display:flex;gap:10px;align-items:flex-start;padding:8px 10px}
.scs .fc-list .body{flex:1;min-width:0}
.scs .fc-list .row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.scs .fc-list .row b{font:800 var(--text-control) var(--font-ui);color:var(--stage-card)}
.scs .fc-list .row small{font:var(--text-meta) var(--font-mono);color:var(--stage-mute)}
.scs .fc-list p{margin:2px 0 0;font:var(--text-meta)/1.45 var(--font-ui);color:var(--stage-text-dim)}
.scs .fc-list .acts{display:flex;gap:6px;flex:none;padding:8px 10px}
.scs .fc-list .line .acts{padding:0}
.scs .fc-list .view{padding:0 10px 10px 36px;font:var(--text-meta)/1.5 var(--font-ui);color:var(--stage-text-dim)}
.scs .fc-create{display:flex;flex-direction:column;gap:10px;padding:10px;border:1px solid var(--stage-seam);margin-bottom:8px}
.scs .fc-create .acts{display:flex;gap:6px}
.scs .fc-bankform{display:flex;flex-direction:column;gap:10px}
.scs .fc-preset{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border:1px solid var(--stage-seam)}
.scs .fc-preset>b{font:700 var(--text-meta) var(--font-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--stage-soft)}
.scs .fc-safety{display:grid;grid-template-columns:minmax(220px,.95fr) minmax(160px,.65fr) minmax(220px,1fr);gap:14px;align-items:start}
.scs .fc-safety-controls{display:flex;flex-direction:column;gap:10px}
.scs .fc-checks{padding:10px 12px;border:1px solid var(--stage-seam);background:color-mix(in srgb,var(--stage-black) 50%,transparent);display:flex;flex-direction:column;gap:6px;font:var(--text-meta)/1.45 var(--font-mono);color:var(--stage-soft)}
.scs .fc-contract header{margin-bottom:8px}
.scs .fc-tokens{text-align:right}
.scs .fc-tokens b{display:block;font:800 1.4rem var(--font-mono);color:var(--p,var(--w))}
.scs .fc-tokens small{font:var(--text-meta) var(--font-mono);text-transform:uppercase;color:var(--stage-mute)}
.scs .fc-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.scs .fc-copy{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.scs .fc-copy small{font:var(--text-meta) var(--font-mono);color:var(--stage-mute)}
.scs .fc-xml{margin:0;padding:10px 12px;max-height:360px;overflow:auto;white-space:pre-wrap;word-break:break-word;font:var(--text-meta)/1.5 var(--font-mono);color:var(--stage-soft)}
.scs .fc-foot{display:flex;align-items:flex-start;gap:6px;padding-top:12px;border-top:1px solid var(--stage-seam);font:var(--text-meta)/1.5 var(--font-mono);color:var(--stage-mute)}
.scs .fc-body>p{margin:0 0 10px}
.scs .fc-pass{display:flex;flex-direction:column}
.scs .fc-pass .fc-body{display:flex;flex-direction:column;gap:12px}
@container (max-width:640px){.scs .fc-safety{grid-template-columns:1fr}}
`;

/** RoleCall's neobrut rules, written for .scs and re-rooted under the rolecall chrome so no other theme takes them. */
const ROLECALL = `
.scs .fc-wing>.hero{display:block;position:relative;padding:28px 32px;border:3px solid var(--stage-black);border-radius:0;box-shadow:6px 6px 0 0 color-mix(in srgb,var(--bk-role-action) 45%,transparent);background:radial-gradient(ellipse at top left,color-mix(in srgb,var(--bk-role-action) 16%,transparent),transparent 55%),linear-gradient(135deg,var(--stage-deck),var(--stage-panel))}
.scs .fc-wing>.hero .hi{display:none}
.scs .fc-wing>.hero .eb{color:var(--bk-role-action-text);font:900 var(--rc-s-p68rem)/1.5 var(--font-mono);letter-spacing:.26em;text-transform:uppercase}
.scs .fc-wing>.hero h2{margin:8px 0;color:var(--stage-card);font:900 clamp(2rem,4.5cqw,4.3rem)/.95 var(--font-fancy);letter-spacing:.04em;text-shadow:4px 4px 0 var(--stage-black);text-transform:uppercase}
.scs .fc-wing>.hero h2 em{color:var(--bk-role-action-text);font-style:normal}
.scs .fc-wing>.hero p{max-width:820px;margin:0;color:var(--rc-zinc-400);font:italic 400 1.04rem/1.5 var(--font-ui)}
.scs .fc-card{overflow:hidden;border:3px solid var(--stage-black);border-radius:0;background:var(--stage-panel);padding:16px;box-shadow:3px 3px 0 0 var(--stage-black)}
.scs .fc-card.on{box-shadow:6px 6px 0 0 var(--p,var(--w))}
.scs .fc-card>header{display:grid;grid-template-columns:1fr auto;align-items:start;gap:14px;margin:-16px -16px 14px;padding:16px;border-bottom:2px solid var(--stage-black)}
.scs .fc-card .kick{font:900 var(--rc-s-p62rem)/1.5 var(--font-mono);letter-spacing:.22em;text-transform:uppercase;color:var(--p,var(--w))}
.scs .fc-card h3,.scs .fc-card h4{margin:4px 0 0;font:900 clamp(1.35rem,2cqw,1.8rem)/1 var(--font-fancy);text-transform:uppercase;color:var(--stage-card)}
.scs .fc-card p,.scs .fc-hint{margin:0 0 14px;font:var(--rc-text-ctl)/1.55 var(--font-ui);color:var(--rc-zinc-400)}
.scs .fc-hint{font-size:var(--rc-s-p72rem);color:var(--rc-zinc-500)}
.scs .fc-meta{display:inline-block;padding:3px 8px;border:2px solid var(--bk-role-brand);background:color-mix(in srgb,var(--bk-role-brand) 14%,var(--stage-black));font:800 var(--rc-text-micro)/1.5 var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--bk-role-brand-text)}
.scs .fc-live{flex:none;align-self:start;min-width:72px;padding:9px 10px;border:2px solid var(--stage-black);border-radius:0;box-shadow:3px 3px 0 0 var(--stage-black);background:var(--stage-black);color:var(--stage-card);font:900 var(--rc-s-p68rem)/1.5 var(--font-mono);letter-spacing:.12em;text-transform:uppercase;cursor:pointer}
.scs .fc-live.on{border-color:var(--stage-black);background:var(--p,var(--w));color:var(--stage-black)}
.scs .fc-master{display:flex;align-items:center;justify-content:space-between;gap:12px;border:3px solid var(--stage-black);border-radius:0;box-shadow:3px 3px 0 0 var(--stage-black);background:var(--stage-panel);padding:14px 16px}
.scs .fc-master b{font:900 1rem/1.3 var(--font-fancy);letter-spacing:.06em;text-transform:uppercase;color:var(--stage-card)}
.scs .fc-master p{margin:2px 0 0;font:var(--rc-text-ctl)/1.55 var(--font-ui);color:var(--rc-zinc-400)}
.scs .fc-master.on{box-shadow:6px 6px 0 0 var(--w)}
.scs .fc-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px}
.scs .fc-stats div{border:3px solid var(--stage-black);border-radius:0;box-shadow:3px 3px 0 0 var(--stage-black);background:var(--stage-panel);padding:14px 16px}
.scs .fc-stats small{display:block;font:900 var(--rc-s-p62rem)/1.5 var(--font-mono);letter-spacing:.18em;text-transform:uppercase;color:var(--rc-zinc-500)}
.scs .fc-stats b{display:block;margin-top:6px;font:900 1.4rem/1.5 var(--font-mono);color:var(--bk-role-action-text)}
.scs .fc-error{padding:8px 12px;border:2px solid var(--stage-danger-edge);background:var(--stage-danger-bg);color:var(--stage-danger-text);font:var(--rc-text-ctl)/1.5 var(--font-ui)}
.scs .fc-note{padding:12px;border:2px dashed var(--rc-zinc-500);background:color-mix(in srgb,var(--stage-black) 30%,transparent);font:.86rem/1.5 var(--font-ui);color:var(--rc-zinc-400)}
.scs .fc-off{padding:12px;border:2px dashed var(--rc-zinc-500);background:color-mix(in srgb,var(--stage-black) 30%,transparent);font:var(--rc-text-ctl)/1.5 var(--font-ui);color:var(--rc-zinc-400)}
.scs .fc-label{display:grid;gap:5px;font:900 var(--rc-s-p62rem)/1.5 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--rc-zinc-500)}
.scs .fc-label small{font:400 var(--rc-s-p62rem)/1.5 var(--font-mono);letter-spacing:0;text-transform:none;color:var(--rc-zinc-500)}
.scs .fc-select,.scs .fc-field,.scs .fc-area{width:100%;box-sizing:border-box;padding:10px 11px;border:2px solid var(--stage-black);border-radius:0;background:var(--stage-black);color:var(--stage-card);font:var(--rc-text-xs)/1.45 var(--font-mono);outline:none}
.scs .fc-area{min-height:84px;resize:vertical;line-height:1.45}
.scs .fc-check,.scs .fc-entry,.scs .fc-switch{position:relative;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:10px;padding:10px 12px;border:2px solid var(--stage-black);background:var(--stage-black);cursor:pointer;font:900 var(--rc-s-p7rem)/1.5 var(--font-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--rc-zinc-200)}
.scs .fc-box{position:relative;display:inline-block;flex:none;width:34px;height:18px;border:2px solid var(--stage-black);box-shadow:3px 3px 0 0 var(--stage-black);background:var(--stage-sunken)}
.scs .fc-box::after{content:"";position:absolute;left:3px;top:3px;width:10px;height:10px;background:var(--rc-zinc-500);transition:transform 120ms ease,background 120ms ease}
.scs .fc-check input:checked+.fc-box::after,.scs .fc-entry input:checked+.fc-box::after,.scs .fc-switch input:checked+.fc-box::after{background:var(--p,var(--w));transform:translateX(16px)}
.scs .fc-check:has(input:checked),.scs .fc-entry:has(input:checked),.scs .fc-switch:has(input:checked){border-color:var(--p,var(--w));color:var(--stage-card)}
.scs .fc-check:has(input:focus-visible),.scs .fc-entry:has(input:focus-visible),.scs .fc-switch:has(input:focus-visible){outline:2px solid var(--p,var(--w));outline-offset:2px}
.scs .fc-entry em{display:block;margin-top:4px;font:400 var(--rc-s-p72rem)/1.35 var(--font-ui);font-style:normal;text-transform:none;letter-spacing:0;color:var(--rc-zinc-500)}
.scs .fc-btn{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border:2px solid var(--rc-zinc-600);border-radius:0;background:var(--stage-black);color:var(--rc-zinc-500);font:800 var(--rc-s-p62rem)/1.5 var(--font-mono);letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
.scs .fc-btn:hover{border-color:var(--bk-role-brand);color:var(--bk-role-brand-text)}
.scs .fc-chip,.scs .fc-tag{padding:2px 6px;border:2px solid var(--stage-black);background:var(--stage-black);font:900 var(--rc-s-p55rem)/1.5 var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--rc-zinc-300)}
.scs .fc-set{border:2px solid var(--rc-zinc-600);background:var(--stage-sunken);box-shadow:4px 4px 0 0 var(--stage-black)}
.scs .fc-set.open{border-color:var(--bk-role-brand);box-shadow:4px 4px 0 0 var(--bk-role-brand)}
.scs .fc-set .id b{font:900 var(--rc-text-ctl)/1.5 var(--font-mono);letter-spacing:.04em;text-transform:uppercase;color:var(--stage-card)}
.scs .fc-set .id small{font:.84rem/1.4 var(--font-ui);color:var(--rc-zinc-200);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.scs .fc-set .count{flex:none;padding:4px 8px;border:2px solid var(--bk-role-brand);background:color-mix(in srgb,var(--bk-role-brand) 14%,var(--stage-black));font:900 var(--rc-text-micro)/1.5 var(--font-mono);letter-spacing:.08em;color:var(--bk-role-brand)}
.scs .fc-set .count.full{border-color:var(--stage-ok);background:color-mix(in srgb,var(--stage-ok) 16%,var(--stage-black));color:var(--stage-ok)}
.scs .fc-set .count.zero{border-color:var(--rc-zinc-600);background:var(--stage-black);color:var(--rc-zinc-600)}
.scs .fc-tick{flex:none;width:18px;height:18px;margin-top:2px;display:grid;place-items:center;border:2px solid var(--rc-zinc-600);background:var(--stage-black);color:var(--bk-role-brand)}
.scs .fc-bank.on .fc-tick{border-color:var(--bk-role-brand);background:color-mix(in srgb,var(--bk-role-brand) 18%,var(--stage-black))}
.scs .fc-bank-body .row b{font:900 var(--rc-s-p7rem)/1.5 var(--font-mono);letter-spacing:.04em;text-transform:uppercase;color:var(--rc-zinc-200)}
.scs .fc-bank-body .why{font:var(--rc-text-wing)/1.45 var(--font-ui);color:var(--rc-zinc-200)}
.scs .fc-kind{padding:2px 6px;border:2px solid currentColor;font:900 var(--rc-s-p55rem)/1.5 var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--rc-zinc-300)}
.scs .fc-contract header{margin-bottom:14px}
.scs .fc-xml{margin:0;padding:16px;max-height:360px;overflow:auto;white-space:pre-wrap;word-break:break-word;border:2px solid var(--stage-black);background:var(--stage-black);font:.76rem/1.6 var(--font-mono);color:var(--stage-card)}
.scs .fc-foot{display:flex;align-items:flex-start;gap:6px;padding-top:12px;border-top:2px solid var(--stage-black);font:var(--rc-s-p72rem)/1.5 var(--font-mono);color:var(--rc-zinc-500)}
`;

export const FINAL_CUT_STYLE = SHARED + rcScope(ROLECALL);
