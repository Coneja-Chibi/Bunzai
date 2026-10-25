/**
 * The Scenes list's styles, part 1: the approved gamified wireframe
 * (design/wireframes/soft/scenes-game.html), adapted from its markup into the app's real classes and
 * scoped under `.scn` (every style string in this app concatenates into one global `<style>`, so an
 * unscoped `.s-btn` or `.s-act` here would leak into every other wing). Shell layout, the cast rail,
 * the stage panel (Fan Favorites, recent rows, cut list, folders), the plaque, and the hero + preview.
 * Part 2 (list-style-2.ts) has the card grid, character/folder headers, the empty state, and dialogs.
 */
import { LIST_STYLE_2 } from "./list-style-2";

const LIST_STYLE_1 = `
.scn :not(.dot){border-radius:0}
.scn{container-type:inline-size;display:flex;height:100%;min-height:0;background:var(--stage-well);color:var(--stage-soft);font-family:var(--font-body)}
.scn h1,.scn h2,.scn h3{font-variation-settings:var(--soft-axes)}
.scn .s-act{font:500 12px/1 var(--font-mono);letter-spacing:.14em;text-transform:uppercase;color:var(--text-dim);display:flex;gap:8px;align-items:center}
.scn .s-act b{color:var(--bk-role-brand-text);font-weight:500}
.scn .s-title{font:700 clamp(1.6rem,2vw,2.2rem)/1.1 var(--font-fancy);letter-spacing:.02em;margin:6px 0 0}
.scn .s-h2{font:700 1.2rem/1.2 var(--font-fancy);letter-spacing:.02em;margin:6px 0 0}
.scn .s-lede{color:var(--text-soft);font-size:.92rem;margin:4px 0 0}
.scn .s-btn{display:inline-flex;align-items:center;gap:8px;padding:9px 14px;background:var(--stamp-bg);color:var(--stamp-fg);border:0;font:700 var(--text-control) var(--font-body);cursor:pointer}
.scn .s-btn.ghost{background:none;color:var(--text);box-shadow:inset 0 0 0 1px var(--edge)}
.scn .s-btn.ghost.on{background:var(--shell-panel-2);box-shadow:inset 0 0 0 1px var(--accent)}
.scn .s-btn:hover{box-shadow:inset 0 0 0 1px var(--accent)}
.scn .drawer-toggle{display:none;align-items:center;gap:6px;margin:0 0 10px;padding:8px 12px;background:none;box-shadow:inset 0 0 0 1px var(--edge);color:var(--text);font:500 var(--text-control) var(--font-body);cursor:pointer}

.scn .scn-side{display:flex;flex:none;height:100%}
.scn .char-rail{width:64px;flex:none;height:100%;overflow-y:auto;background:var(--chrome);box-shadow:inset -1px 0 0 var(--seam);display:flex;flex-direction:column;align-items:center;padding:14px 0 10px;gap:8px}
.scn .cr-mark{width:34px;height:34px;flex:none;display:grid;place-items:center;background:none;border:0;cursor:pointer;padding:0;color:var(--bk-role-brand-text)}
.scn .cr-div{width:28px;height:1px;flex:none;background:var(--seam)}
.scn .cr-all{width:40px;height:40px;flex:none;display:grid;place-items:center;background:var(--shell-panel);box-shadow:inset 0 0 0 1px var(--seam);border:0;color:var(--text-dim);cursor:pointer}
.scn .cr-all.on{background:var(--shell-panel-2);color:var(--bk-role-brand-text);box-shadow:inset 0 0 0 1px var(--seam),inset 0 0 0 2px var(--accent)}
.scn .cr-list{flex:1;min-height:0;overflow-y:auto;padding:2px 0}
.scn .cr-space,.scn .recent-space,.scn .folder-space{position:relative}
.scn .cr-row,.scn .recent-row,.scn .folder-row{position:absolute;top:0;left:0;right:0}
.scn .cr-row{height:40px;display:flex;justify-content:center}
.scn .cr-tile{position:relative;width:40px;height:40px;flex:none;display:block;background:none;border:0;cursor:pointer;padding:0}
.scn .cr-art{width:40px;height:40px;display:grid;place-items:center;overflow:hidden;font:italic 600 15px var(--font-fancy);color:var(--stage-ink);background:var(--a-deep,var(--accent-deep));box-shadow:inset 0 0 0 0 var(--a-deep,var(--accent-deep));transition:box-shadow .15s}
.scn .cr-art img{width:100%;height:100%;object-fit:cover}
.scn .cr-tile.on .cr-art{box-shadow:inset 0 0 0 2px var(--stage-card),0 0 0 2px var(--chrome),0 0 0 4px var(--a,var(--accent))}
.scn .cr-playing{position:absolute;bottom:-3px;right:-3px;width:14px;height:14px;display:grid;place-items:center;background:var(--stage-ok);color:var(--stage-ink);box-shadow:0 0 0 2px var(--chrome);z-index:2}
.scn .cr-tip{position:absolute;left:48px;top:50%;transform:translateY(-50%);z-index:40;display:none;white-space:nowrap;background:var(--face);box-shadow:0 0 0 1px var(--edge),4px 4px 0 0 var(--stage-black);padding:6px 10px}
.scn .cr-tip b{display:block;font:600 var(--text-control) var(--font-big);font-variation-settings:var(--soft-axes);color:var(--text)}
.scn .cr-tip span{display:block;margin-top:1px;font:500 12px var(--font-mono);color:var(--text-dim)}
.scn .cr-tile:hover .cr-tip{display:block}

.scn .stage-panel{width:270px;flex:none;height:100%;overflow-y:auto;background:var(--chrome);box-shadow:inset -1px 0 0 var(--seam);display:flex;flex-direction:column}
.scn .sp-top{padding:16px 16px 8px;flex:none}
.scn .sp-scroll{flex:1;min-height:0;padding:0 14px 24px}
.scn .recent-window{max-height:22rem;overflow-y:auto;position:relative}
.scn .folder-list{max-height:22rem;overflow-y:auto;position:relative}
.scn .fav-carousel{position:relative;overflow:hidden}
.scn .fav-card{display:block;width:100%;text-align:left;background:none;border:0;padding:0;cursor:pointer;color:var(--text)}
.scn .fav-art{position:relative;height:118px;overflow:hidden;background:linear-gradient(165deg,color-mix(in srgb,var(--a) 50%,var(--face)),var(--face) 88%);box-shadow:0 0 0 1px var(--edge)}
.scn .fav-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.scn .fav-art .ini{position:absolute;top:38%;left:50%;transform:translate(-50%,-50%);font:italic 600 28px var(--font-fancy);color:color-mix(in srgb,var(--text) 40%,transparent)}
.scn .fav-ov{position:absolute;left:0;right:0;bottom:0;padding:9px 10px;background:linear-gradient(transparent,color-mix(in srgb,var(--stage-black) 82%,transparent) 55%)}
.scn .fav-who{display:flex;align-items:center;gap:6px;font:500 var(--text-control) var(--font-body)}
.scn .fav-av{width:20px;height:20px;flex:none;display:grid;place-items:center;font: 600 var(--text-meta) var(--font-fancy);color:var(--stage-ink);background:var(--a-deep)}
.scn .fav-who b{color:var(--text);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.scn .fav-who i{margin-left:auto;font-style:normal;font-size:var(--text-meta);color:var(--text-dim);white-space:nowrap}
.scn .fav-title{margin-top:4px;font:600 14px var(--font-big);font-variation-settings:var(--soft-axes);color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.scn .fav-stat{margin-top:8px;font:500 12px var(--font-mono);color:var(--text-dim)}
.scn .fav-continue{display:block;width:100%;margin-top:6px;padding:8px 0;text-align:center;font:600 var(--text-control) var(--font-body);color:var(--bk-role-brand-text);background:none;border:0;cursor:pointer}
.scn .fav-nav{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:8px}
.scn .fav-arrow{flex:none;width:24px;height:24px;display:grid;place-items:center;background:none;box-shadow:inset 0 0 0 1px var(--edge);color:var(--text);border:0;cursor:pointer;font-size:15px;line-height:1}
.scn .fav-arrow:hover{background:var(--shell-panel)}
.scn .fav-dots{width:140px;height:12px;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin}
.scn .fav-dot-space{position:relative;height:12px}
.scn .fav-dot{position:absolute;top:3px;left:0;width:6px;height:6px;padding:0;background:var(--stage-line);border:0;cursor:pointer}
.scn .fav-dot.on{background:var(--accent)}
.scn .fav-empty-card{display:flex;align-items:center;justify-content:center;height:118px;padding:0 18px;box-shadow:inset 0 0 0 2px var(--edge);color:var(--text-dim);font-size:var(--text-body);text-align:center}

.scn .sp-sec{margin-top:16px;padding-top:12px;box-shadow:inset 0 1px 0 var(--seam)}
.scn .sp-sec.fav-sec{margin-top:4px;padding-top:0;box-shadow:none}
.scn .lab{display:flex;align-items:center;gap:8px;padding:0 6px 8px;font:500 var(--text-control) var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--text-dim)}
.scn .lab:not(:first-child){margin-top:14px}
.scn .lab .sq{width:6px;height:6px;background:var(--accent)}
.scn .lab.gonelab{color:var(--stage-danger-text)}
.scn .lab.gonelab .sq{background:var(--stage-danger-text)}
.scn .rec{display:flex;align-items:center;gap:8px;width:100%;padding:7px 6px;background:none;border:0;text-align:left;cursor:pointer}
.scn .rec:hover{background:var(--shell-panel)}
.scn .rec.gone{cursor:default;opacity:.85}
.scn .rec .rec-art{width:26px;height:26px;flex:none;display:grid;place-items:center;overflow:hidden;font:600 12px var(--font-fancy);color:var(--stage-ink);background:var(--a-deep)}
.scn .rec .rec-art img{width:100%;height:100%;object-fit:cover}
.scn .rec .rec-av{width:26px;height:26px;flex:none;display:grid;place-items:center;font:600 12px var(--font-fancy);color:var(--stage-ink);background:var(--accent)}
.scn .rec .rec-tx{flex:1;min-width:0}
.scn .rec .rec-tx b{display:block;font:500 var(--text-control) var(--font-big);font-variation-settings:var(--soft-axes);color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.scn .rec .rec-tx small{display:block;margin-top:1px;font: 400 var(--text-body) var(--font-body);color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.scn .rec .rec-pip{flex:none;width:6px;height:6px;background:var(--a);opacity:.75}
.scn .rec time{flex:none;font:500 12px var(--font-mono);color:var(--text-faint)}
.scn .rec.gone time{color:var(--stage-danger-text)}
.scn .rec .rs{flex:none;padding:4px 10px;font: 600 var(--text-meta) var(--font-big);background:transparent;box-shadow:inset 0 0 0 1px var(--accent);border:0;color:var(--bk-role-brand-text);cursor:pointer}
.scn .chapter{display:flex;align-items:center;gap:8px;width:100%;padding:7px 8px;background:none;border:0;color:var(--text-soft);font:400 var(--text-control) var(--font-body);cursor:pointer;text-align:left}
.scn .chapter:hover{color:var(--text);background:var(--shell-panel)}
.scn .chapter.on{color:var(--text);background:var(--shell-panel-2)}
.scn .chapter .ch-dot{width:8px;height:8px;flex:none;background:var(--c,var(--accent))}
.scn .chapter .ch-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scn .chapter .ch-count{flex:none;font:500 12px var(--font-mono);color:var(--text-dim)}
.scn .chapter.smart svg{color:var(--stage-warn);flex:none}
.scn .newchapter{display:flex;align-items:center;gap:8px;width:100%;margin-top:4px;padding:7px 8px;background:none;border:0;color:var(--text-dim);font:400 var(--text-control) var(--font-body);cursor:pointer}
.scn .newchapter:hover{color:var(--text-soft)}

.scn .main{flex:1;min-width:0;height:100%;overflow-y:auto;padding:24px 32px 40px;position:relative;container-type:inline-size}
.scn .plaque{position:relative;padding:18px 22px;background:var(--face);box-shadow:0 0 0 1px var(--edge);border-top:4px solid var(--accent);margin-bottom:16px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px}
.scn .plaque-actions{display:flex;align-items:center;gap:10px}
.scn .search{display:flex;align-items:center;gap:8px;padding:8px 12px;width:200px;box-shadow:inset 0 0 0 1px var(--edge)}
.scn .search input{flex:1;min-width:0;background:none;border:0;color:var(--text);font:400 16px var(--font-body)}
.scn .search input::placeholder{color:var(--text-faint)}
.scn .selbar{margin-bottom:16px;display:flex;align-items:center;gap:10px;padding:8px 12px;box-shadow:inset 0 0 0 1px var(--accent);background:color-mix(in srgb,var(--accent) 10%,transparent);font-size:var(--text-control);color:var(--text)}
.scn .selbar .del{margin-left:auto;padding:6px 12px;background:var(--stage-danger-bg);box-shadow:inset 0 0 0 1px var(--stage-danger-edge);color:var(--stage-danger-text);border:0;cursor:pointer}
.scn .filters{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:22px}
.scn .segs{display:flex;gap:2px;padding:3px;box-shadow:inset 0 0 0 1px var(--edge)}
.scn .segs button{padding:6px 12px;font: 500 var(--text-control) var(--font-body);color:var(--text-dim);background:none;border:0;cursor:pointer}
.scn .segs button.on{background:var(--shell-panel-2);color:var(--text);font-weight:600}

.scn .stagerow{display:flex;align-items:flex-start;gap:18px;margin-bottom:26px}
.scn .hero{position:relative;flex:none;width:280px;height:420px;background:var(--face);box-shadow:0 0 0 1px var(--edge),var(--stamp-x) var(--stamp-y) 0 0 var(--stamp-shadow);border-top:4px solid var(--a);text-decoration:none;color:var(--text);overflow:hidden;display:block;cursor:pointer;padding:0}
.scn .hero-ov{position:absolute;left:0;right:0;bottom:0;padding:18px 20px;background:linear-gradient(transparent,color-mix(in srgb,var(--stage-black) 88%,transparent) 40%);z-index:1;text-align:left}
.scn .hero-ov h2{margin-top:6px;font:700 1.3rem var(--font-fancy);font-variation-settings:var(--soft-axes)}
.scn .hero-ov .sub{margin-top:4px;color:var(--text-soft);font-size:.88rem}
.scn .hero-stats{margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;font:500 12px var(--font-mono);color:var(--text-dim)}
.scn .hero-stats b{color:var(--a);font-weight:500}
.scn .hero-pips{display:flex;gap:4px;margin-top:10px}
.scn .hero-pips span{width:16px;height:6px;background:var(--stage-line)}
.scn .hero-pips span.on{background:var(--a)}
.scn .hero-pips .over{font: 500 var(--text-meta) var(--font-mono);color:var(--text-dim);margin-left:2px}
.scn .hero-ov .s-btn{margin-top:12px}
.scn .preview{position:relative;flex:1;min-width:0;height:420px;background:var(--face);box-shadow:0 0 0 1px var(--edge),var(--stamp-x) var(--stamp-y) 0 0 var(--stamp-shadow);border-top:4px solid var(--a);overflow:hidden;display:block;text-decoration:none;color:var(--text);cursor:pointer;padding:0}
.scn .preview .art{position:absolute;inset:0;background:linear-gradient(175deg,color-mix(in srgb,var(--a) 42%,var(--face)),var(--face) 90%)}
.scn .pv-slide{position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;justify-content:flex-end;padding:26px 30px;background:linear-gradient(transparent,color-mix(in srgb,var(--stage-black) 85%,transparent) 52%)}
.scn .pv-msg{display:flex;align-items:flex-end;gap:12px;text-align:left}
.scn .pv-msg+.pv-msg{margin-top:12px}
.scn .pv-msg .av{width:38px;height:38px;flex:none;display:grid;place-items:center;font:italic 600 16px var(--font-fancy);color:var(--stage-ink);background:var(--a-deep)}
.scn .pv-msg .av.you{background:var(--text-dim)}
.scn .pv-msg-tx{min-width:0;max-width:100%}
.scn .pv-msg-tx b{display:block;font:600 12px var(--font-mono);text-transform:uppercase;letter-spacing:.06em;color:var(--a);margin-bottom:4px}
.scn .pv-msg-clamp{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;overflow:hidden;mask-image:linear-gradient(to bottom,black 65%,transparent 100%);-webkit-mask-image:linear-gradient(to bottom,black 65%,transparent 100%)}
.scn .pv-msg-clamp .prose{font:500 1.05rem/1.4 var(--font-big);font-variation-settings:var(--soft-axes);color:var(--text)}
.scn .pv-msg-clamp .prose p{margin:0}
.scn .pv-msg-clamp .prose p+p{margin-top:.4em}
.scn .pv-msg-clamp .prose q{color:var(--a);font-style:normal}
html[data-surface-scenes-list="table-of-contents"] .scn .hero-stats b,html[data-surface-scenes-list="table-of-contents"] .scn .pv-msg-tx b,html[data-surface-scenes-list="table-of-contents"] .scn .pv-msg-clamp .prose q,html[data-surface-scenes-list="table-of-contents"] .scn .s-act b,html[data-surface-scenes-list="table-of-contents"] .scn .fav-continue{color:var(--text)}
`;

export const LIST_STYLE = LIST_STYLE_1 + LIST_STYLE_2;
