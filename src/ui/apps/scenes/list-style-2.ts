/**
 * The Scenes list's styles, part 2 (list-style.ts has the header comment and part 1: shell, rail,
 * panel, plaque, hero). The card grid and its take strip, the character and folder headers, the
 * empty state, and the shared dialogs (rename/cut/folder name/delete/move-to-folder, on the
 * existing Cutting Room skin), plus the phone drawer at the plan's 700px container breakpoint.
 */
export const LIST_STYLE_2 = `
.scn .grid-scroll{max-height:42rem;overflow-y:auto;min-height:0}
.scn .grid-space{position:relative}
.scn .grid{margin-top:0;display:grid;grid-template-columns:repeat(auto-fill,180px);grid-auto-rows:270px;gap:16px;justify-content:start;position:absolute;top:0;left:0;right:0}
.scn [data-part="scenes.card.open"]{position:relative;width:180px;height:270px;padding:0;background:var(--face);box-shadow:0 0 0 1px var(--edge),var(--stamp-x) var(--stamp-y) 0 0 var(--stamp-shadow);border-top:4px solid var(--a);cursor:pointer;overflow:hidden;transition:transform .15s;text-align:left;font:inherit}
.scn [data-part="scenes.card.open"]:hover{transform:translateY(-2px)}
.scn [data-part="scenes.card.open"] .art,.scn [data-part="scenes.hero.open"] .art{position:absolute;inset:0;background:linear-gradient(170deg,color-mix(in srgb,var(--a) 50%,var(--face)),var(--face) 88%)}
.scn [data-part="scenes.card.open"] .art img,.scn [data-part="scenes.hero.open"] .art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.scn [data-part="scenes.card.open"] .ini,.scn [data-part="scenes.hero.open"] .ini{position:absolute;top:36%;left:50%;transform:translate(-50%,-50%);font:italic 600 32px var(--font-fancy);color:color-mix(in srgb,var(--stage-card) 32%,transparent)}
.scn [data-part="scenes.hero.open"] .ini{font-size:76px}
.scn [data-part="scenes.card.open"] .badge,.scn [data-part="scenes.hero.open"] .badge{position:absolute;top:8px;left:8px;display:flex;align-items:center;gap:5px;padding:3px 8px;background:var(--stage-ok-bg);color:var(--stage-ok);font: 600 var(--text-meta) var(--font-mono);text-transform:uppercase;letter-spacing:.06em;z-index:2}
.scn [data-part="scenes.card.open"] .badge .dot,.scn [data-part="scenes.hero.open"] .badge .dot{width:5px;height:5px;border-radius:50%;background:currentColor}
.scn [data-part="scenes.card.open"] .cont{position:absolute;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--stage-black) 55%,transparent);opacity:0;transition:opacity .15s}
.scn [data-part="scenes.card.open"]:hover .cont{opacity:1}
.scn [data-part="scenes.card.open"] .cont span{padding:7px 16px;background:var(--stamp-bg);color:var(--stamp-fg);font:700 var(--text-control) var(--font-body)}
.scn [data-part="scenes.card.open"] .ov{position:absolute;left:0;right:0;bottom:0;padding:10px 12px;background:linear-gradient(transparent,color-mix(in srgb,var(--stage-black) 82%,transparent) 45%);z-index:1;transition:bottom .15s}
.scn [data-part="scenes.card.open"][data-hastakes] .ov{bottom:30px}
.scn [data-part="scenes.card.open"] .who{font:500 var(--text-control) var(--font-body);color:var(--text-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.scn [data-part="scenes.card.open"] h3{margin-top:3px;font:600 var(--text-control)/1.25 var(--font-big);font-variation-settings:var(--soft-axes);color:var(--text);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.scn [data-part="scenes.card.open"] .sumline{margin:4px 0 0;font:400 var(--text-meta)/1.4 var(--font-body);color:var(--text-soft);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.scn .sumfail{margin:8px 0 0;font:500 var(--text-meta) var(--font-body);color:var(--text-dim)}
.scn [data-part="scenes.card.open"] .meta{margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;font: 500 var(--text-meta) var(--font-mono);color:var(--text-dim)}
.scn [data-part="scenes.card.open"] .meta b{font-weight:500;color:var(--text-soft)}
.scn [data-part="scenes.card.open"] .tick{position:absolute;top:8px;right:8px;z-index:3;width:20px;height:20px;box-shadow:inset 0 0 0 2px var(--stage-card);background:color-mix(in srgb,var(--stage-black) 50%,transparent)}
.scn [data-part="scenes.card.open"][data-selected] .tick{background:var(--accent);box-shadow:inset 0 0 0 2px var(--accent)}
.scn [data-part="scenes.card.open"][data-selected]{outline:2px solid var(--accent);outline-offset:2px}
.scn [data-part="scenes.hero.open"][data-selected]{outline:2px solid var(--accent);outline-offset:2px}
.scn .takestrip{position:absolute;left:0;right:0;bottom:0;height:30px;padding:0 10px;display:flex;align-items:center;z-index:2;background:color-mix(in srgb,var(--stage-black) 88%,var(--face));box-shadow:inset 0 1px 0 var(--seam)}
.scn .takestrip .compact{display:flex;align-items:center;gap:6px;min-width:0;width:100%}
.scn .takestrip .pips{display:flex;gap:3px;flex:none}
.scn .takestrip .pips span{width:6px;height:6px;background:var(--stage-line)}
.scn .takestrip .pips span.on{background:var(--a)}
.scn .takestrip .over{flex:none;font: 500 var(--text-meta) var(--font-mono);color:var(--text-dim)}
.scn .takestrip .active{flex:1;min-width:0;font:600 var(--text-meta) var(--font-mono);color:var(--text-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right}
.scn [data-part="scenes.card.new"]{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;box-shadow:inset 0 0 0 2px var(--edge);background:none;border-top:0}
.scn [data-part="scenes.card.new"] .plus{width:48px;height:48px;display:grid;place-items:center;box-shadow:inset 0 0 0 2px var(--t);color:var(--t)}
.scn [data-part="scenes.card.new"] b{font:600 .8rem var(--font-body);text-transform:uppercase;letter-spacing:.08em;color:var(--text-soft)}
.scn [data-part="scenes.card.new"] span.with{font:400 12px var(--font-body);color:var(--text-dim)}

.scn .backlink{display:inline-flex;align-items:center;gap:6px;background:none;border:0;color:var(--text-dim);font:500 var(--text-control) var(--font-body);cursor:pointer;margin-bottom:16px;padding:0}
.scn .backlink:hover{color:var(--text)}
.scn .charhead{display:flex;align-items:center;gap:16px;margin-bottom:22px;flex-wrap:wrap}
.scn .ch-avatar{width:56px;height:56px;flex:none;display:grid;place-items:center;font:italic 600 24px var(--font-fancy);color:var(--stage-ink);background:var(--t);box-shadow:0 0 0 1px var(--edge)}
.scn .charhead h1{margin-top:4px;font:700 1.5rem var(--font-fancy)}
.scn .charhead p{margin-top:4px;color:var(--text-soft);font-size:.88rem}
.scn .sortpills{display:flex;align-items:center;gap:4px;margin-left:auto}
.scn .sortpills span{color:var(--text-dim);font-size: var(--text-control);margin-right:6px}
.scn .folderhead{display:flex;align-items:center;gap:14px;margin-bottom:22px}
.scn .folderhead .ch-dot.big{width:18px;height:18px;flex:none}
.scn .folderhead h1{margin-top:2px;font:700 1.5rem var(--font-fancy)}
.scn .folderhead p{margin-top:4px;color:var(--text-soft);font-size:.88rem}

.scn .emptyroot{padding:70px 20px;text-align:center}
.scn .emptyroot .mark{width:64px;height:64px;margin:0 auto 16px;display:grid;place-items:center;background:var(--shell-panel);box-shadow:inset 0 0 0 1px var(--seam);color:var(--text-dim)}
.scn .emptyroot b{display:block;font:600 18px var(--font-big);font-variation-settings:var(--soft-axes);color:var(--text)}
.scn .emptyroot p{margin:10px auto 18px;max-width:28rem;color:var(--text-dim);font-size:.88rem}
.scn .empty{margin-top:60px;text-align:center;color:var(--stage-soft)}
.scn .empty b{display:block;font-weight:900;font-size:20px;text-transform:uppercase;letter-spacing:.06em;color:var(--stage-card)}
.scn .empty p{margin-top:10px;font-size:14px}

.scn-cut{width:26rem;max-width:100%;padding:22px;background:var(--face);box-shadow:0 0 0 1px var(--edge),var(--stamp-x) var(--stamp-y) 0 0 var(--stamp-shadow);border-top:4px solid var(--stage-danger-text);font-family:var(--font-body)}
.scn-cut .eb{font-size: var(--text-meta);font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--stage-danger-text)}
.scn-cut h3{margin:8px 0 0;font:700 1.25rem var(--font-fancy);letter-spacing:.02em;color:var(--text)}
.scn-cut p{margin:10px 0 0;font-size: var(--text-body);line-height:1.5;color:var(--text-soft)}
.scn-cut input{width:100%;margin-top:14px;padding:9px 12px;background:var(--stage-row);color:var(--text);border:0;box-shadow:inset 0 0 0 1px var(--seam);font:15px var(--font-body)}
.scn-cut .row{margin-top:20px;display:flex;justify-content:flex-end;gap:10px}
.scn-cut .row .no,.scn-cut .row .yes{padding:9px 16px;border:0;box-shadow:inset 0 0 0 1px var(--edge);font: 700 var(--text-control) var(--font-body);cursor:pointer}
.scn-cut .row .no{background:none;color:var(--text)}
.scn-cut .row .yes{background:var(--stage-danger-bg);color:var(--stage-danger-text);box-shadow:inset 0 0 0 1px var(--stage-danger-edge)}
.scn-cut.folder-pick .pick-list{margin-top:14px;display:flex;flex-direction:column;gap:2px;max-height:16rem;overflow-y:auto}
.scn-cut.folder-pick .pick-list .ch-dot{width:8px;height:8px;flex:none}

@container (max-width:700px){
.scn .scn-side{position:fixed;top:0;left:0;height:100%;width:82vw;max-width:320px;z-index:20;transform:translateX(-102%);transition:transform .2s;box-shadow:inset -1px 0 0 var(--seam),8px 0 24px var(--shadow-ink)}
.scn .scn-side.open{transform:translateX(0)}
.scn .drawer-toggle{display:inline-flex}
.scn .main{padding:16px 16px 40px}
.scn .plaque{flex-direction:column;align-items:flex-start}
.scn .plaque-actions{width:100%;flex-wrap:wrap;gap:8px}
.scn .search{width:100%}
.scn .stagerow{flex-direction:column}
.scn [data-part="scenes.hero.open"]{width:100%;max-width:260px;height:380px}
.scn [data-part="scenes.hero.preview"]{width:100%;height:220px}
.scn .grid{grid-template-columns:repeat(auto-fill,150px);grid-auto-rows:225px;gap:12px}
.scn [data-part="scenes.card.open"],.scn [data-part="scenes.card.new"]{width:150px;height:225px}
.scn .charhead{gap:12px}
.scn .sortpills{margin-left:0;width:100%}
}
`;
