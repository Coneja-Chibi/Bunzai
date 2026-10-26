/**
 * The Story Director's styles, to RoleCall's classes (StoryDirectorWingPanel.tsx, FloatingDMActivity.tsx, DMPersonalitySelector.tsx, StagecraftExtensions.tsx:1126-1196): the toolbar and its
 * 32px buttons, the tab strip of bordered segments with the glyph over the name, the 16px panes with 20px between sections, the `bg-white/5` cards, the 10px badges, the arc cards, the activity
 * rows, the "Stage Is Dark" empty state, the floating button and its popover, and the settings block. RoleCall's grey scale is the stage roles (zinc-300 is soft, 400 is text-dim,
 * 500 and 600 are mute); its 9px to 11px text and its rounded corners are kept (rc-radius-*), and the pane and an opened arc fade in as RoleCall's motion does. Every colour is a theme token, set per element through --c, --b or --pc.
 */
export const DIRECTOR_STYLE = `
.scs .dr{display:flex;flex-direction:column;gap:0;min-height:0}
.scs .dr>.hero{margin:0}
.scs .dr-bar{display:flex;align-items:center;gap:8px;margin-top:12px;padding-bottom:12px;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent)}
.scs .dr-hist{display:flex;align-items:center;border:1px solid var(--stage-line);background:color-mix(in srgb,var(--stage-black) 40%,transparent)}
.scs .dr-hist>span{min-width:6ch;padding:0 8px;border-inline:1px solid var(--stage-line);text-align:center;font:var(--text-meta) var(--font-mono);color:var(--stage-soft)}
.scs .dr-bar-r{margin-left:auto;display:flex;align-items:center;gap:6px}
.scs .dr-confirm{margin-top:12px;padding:12px;border:1px solid var(--stage-warn);background:var(--stage-warn-ink);color:var(--stage-card);font:var(--text-control)/1.5 var(--font-body);border-radius:var(--rc-radius-sm)}
.scs .dr-confirm p{margin:0 0 10px}
.scs .dr-confirm div{display:flex;gap:8px;justify-content:flex-end}
.scs .dr-note-line{display:flex;align-items:center;gap:8px;margin:12px 0 0;padding:8px 12px;border:1px solid var(--stage-seam);background:color-mix(in srgb,var(--stage-panel) 60%,transparent);color:var(--stage-soft);font:var(--text-meta)/1.5 var(--font-body);border-radius:var(--rc-radius-sm)}
.scs .dr-note-line.bad{border-color:var(--stage-danger-edge);background:var(--stage-danger-bg);color:var(--stage-danger-text)}
.scs .dr-note-x{margin-left:auto}
.scs .dr-note-line.live svg{color:var(--w);animation:dr-spin 1s linear infinite}
@keyframes dr-spin{to{transform:rotate(360deg)}}
.scs .dr-tabs{margin-top:16px}
.scs .dr-pane{padding:16px;display:flex;flex-direction:column;gap:20px}
.scs .dr-sec-h{display:flex;align-items:center;gap:6px;margin-bottom:8px;font:600 var(--text-meta)/1.4 var(--font-body);letter-spacing:.1em;text-transform:uppercase;color:var(--stage-text-dim)}
.scs .dr-sec-h svg{color:var(--w)}
.scs .dr-stack{display:flex;flex-direction:column;gap:8px}
.scs .dr-stack.tight{gap:6px}
.scs .dr-card{padding:16px;border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);background:color-mix(in srgb,var(--stage-card) 5%,transparent);border-radius:var(--rc-radius-sm)}
.scs .dr-card.sm{padding:10px;border-color:color-mix(in srgb,var(--stage-card) 5%,transparent);background:color-mix(in srgb,var(--stage-card) 3%,transparent)}
.scs .dr-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px}
.scs .dr-row.end{justify-content:flex-end;margin:0}
.scs .dr-row b{font:600 var(--text-control)/1.4 var(--font-body);color:var(--stage-card)}
.scs .dr-card.sm .dr-row b{font-weight:500;color:var(--stage-soft)}
.scs .dr-soft{margin:4px 0 0;font:var(--text-meta)/1.6 var(--font-body);color:var(--stage-text-dim)}
.scs .dr-dim{margin:2px 0 0;font:var(--rc-s-10px)/1.6 var(--font-body);color:var(--stage-mute)}
.scs .dr-dim.big{font-size:var(--text-control);color:var(--stage-text-dim)}
.scs .dr-goals{margin-top:8px;display:flex;flex-direction:column;gap:4px;font:var(--text-meta)/1.5 var(--font-body);color:var(--stage-soft)}
.scs .dr-goals.dim{color:var(--stage-mute)}
.scs .dr-goals div{display:flex;align-items:flex-start;gap:6px}
.scs .dr-goals svg{margin-top:2px;flex:none;color:var(--stage-mute)}
.scs .dr-chips{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-top:8px}
.scs .dr-meta{display:flex;flex-wrap:wrap;align-items:center;gap:2px 12px;margin-top:6px;font:var(--rc-s-10px)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .dr-badge{display:inline-block;padding:2px 6px;background:color-mix(in srgb,var(--b) 15%,transparent);color:var(--b);font:var(--rc-s-10px)/1.3 var(--font-body);border-radius:var(--rc-radius)}
.scs .dr-badge.ok{--b:var(--stage-ok)}.scs .dr-badge.info{--b:var(--bk-role-info-text)}.scs .dr-badge.warn{--b:var(--stage-warn)}.scs .dr-badge.danger{--b:var(--stage-danger-text)}.scs .dr-badge.select{--b:var(--bk-role-select-text)}.scs .dr-badge.mute{--b:var(--stage-mute)}
.scs .dr-hz{display:inline-grid;color:var(--c);flex:none}
.scs .dr-mood-row{display:flex;align-items:center;gap:8px;font:var(--text-control)/1.4 var(--font-body);color:var(--stage-soft);text-transform:capitalize}
.scs .dr-mood{width:10px;height:10px;flex:none;background:var(--c);animation:dr-pulse 2s ease-in-out infinite}
@keyframes dr-pulse{50%{opacity:.4}}
.scs .dr-action{display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);background:color-mix(in srgb,var(--stage-card) 5%,transparent);font:var(--text-control)/1.4 var(--font-body);color:var(--stage-soft);border-radius:var(--rc-radius-sm)}
.scs .dr-action svg{margin-top:3px;flex:none;color:var(--stage-mute)}
.scs .dr-list{margin:0;padding-left:18px;font:var(--text-control)/1.6 var(--font-body);color:var(--stage-text-dim)}
.scs .dr-quiet{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:12rem;color:var(--stage-mute)}
.scs .dr-quiet.short{min-height:6rem}
.scs .dr-quiet svg{opacity:.3}
.scs .dr-quiet p{margin:0;font:var(--text-control)/1.4 var(--font-body)}
.scs .dr-quiet small{font:var(--rc-s-10px)/1.4 var(--font-body);color:var(--stage-line)}
.scs .dr-empty{display:flex;flex-direction:column;align-items:center;gap:16px;padding:64px 24px;text-align:center}
.scs .dr-empty-ic{display:grid;place-items:center;width:72px;height:72px;border:3px solid var(--stage-black);background:var(--stage-panel);box-shadow:6px 6px 0 0 var(--stage-black);color:var(--w)}
.scs .dr-empty h3{margin:0;font:700 1.125rem/1.3 var(--font-fancy);letter-spacing:.06em;text-transform:uppercase;color:var(--stage-card)}
.scs .dr-empty p{margin:0;max-width:32ch;font:italic 1.05rem/1.4 var(--font-fancy);color:var(--stage-soft)}
.scs .dr-grp-h{display:flex;align-items:center;gap:6px;padding:0 4px;font:600 var(--rc-s-10px)/1.4 var(--font-body);letter-spacing:.08em;text-transform:uppercase;color:var(--stage-text-dim)}
.scs .dr-grp-h.branch svg{color:var(--bk-role-brand-text)}.scs .dr-grp-h.checkcircle svg{color:var(--stage-ok)}.scs .dr-grp-h.xcircle{color:var(--stage-mute)}
.scs .dr-chap{display:flex;align-items:center;gap:6px;padding:4px 4px 0;font:500 var(--rc-s-10px)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .dr-arc{border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);background:color-mix(in srgb,var(--stage-card) 5%,transparent);border-radius:var(--rc-radius-sm)}
.scs .dr-arc.dim{border-color:color-mix(in srgb,var(--stage-card) 5%,transparent);background:color-mix(in srgb,var(--stage-card) 2%,transparent);opacity:.6}
.scs .dr-arc-h{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border:0;background:none;color:var(--stage-card);text-align:left;cursor:pointer}
.scs .dr-arc-h:hover{background:color-mix(in srgb,var(--stage-card) 5%,transparent)}
.scs .dr-arc-t,.scs .dr-arc-s{display:flex;align-items:center;gap:8px;min-width:0}
.scs .dr-arc-s{flex:none}
.scs .dr-arc-t b{font:500 var(--text-control)/1.4 var(--font-body);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scs .dr-arc.dim .dr-arc-t b{color:var(--stage-mute)}
.scs .dr-arc-b{display:flex;flex-direction:column;gap:8px;padding:8px 12px 12px;border-top:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent)}
.scs .dr-arc-b .dr-chips,.scs .dr-arc-b .dr-meta{margin-top:0}
.scs .dr-chev{display:inline-grid;color:var(--stage-mute);transition:transform .2s}
.scs .dr-chev.open{transform:rotate(180deg)}
.scs .dr-beat{display:flex;flex-direction:column;gap:2px;padding:8px 10px;border:1px solid var(--w);background:color-mix(in srgb,var(--w) 9%,transparent);border-radius:var(--rc-radius-sm)}
.scs .dr-beat-l{display:flex;align-items:center;gap:6px;font:700 var(--text-meta)/1.4 var(--font-body);letter-spacing:.12em;text-transform:uppercase;color:var(--w)}
.scs .dr-beat p{margin:0;font:var(--text-control)/1.5 var(--font-body);color:var(--stage-card)}
.scs .dr-beat small{font:var(--text-meta) var(--font-mono);color:var(--stage-mute)}
.scs .dr-sub{display:flex;align-items:center;gap:6px;margin-bottom:6px;font:500 var(--rc-s-10px)/1.4 var(--font-body);color:var(--stage-text-dim)}
.scs .dr-sub.up{font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--stage-mute)}
.scs .dr-stages{position:relative;display:flex;flex-direction:column;gap:6px;margin-left:4px;padding-left:12px;border-left:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent)}
.scs .dr-stages>div{position:relative;padding-left:4px}
.scs .dr-stages b{font:500 var(--text-meta)/1.4 var(--font-body);color:var(--stage-soft)}
.scs .dr-stages p{margin:0;font:var(--rc-s-10px)/1.5 var(--font-body);color:var(--stage-mute)}
.scs .dr-stages small{font:var(--rc-s-9px) var(--font-body);color:var(--stage-mute)}
.scs .dr-stage-dot{position:absolute;left:-17px;top:6px;width:8px;height:8px;background:var(--stage-line);border:1px solid color-mix(in srgb,var(--stage-card) 20%,transparent)}
.scs .dr-stages .now .dr-stage-dot{background:var(--w)}
.scs .dr-seeds{display:flex;flex-direction:column;gap:4px;padding-left:4px}
.scs .dr-seeds div{display:flex;align-items:flex-start;gap:6px;font:var(--rc-s-11px)/1.5 var(--font-body);color:var(--stage-text-dim)}
.scs .dr-seeds div svg{margin-top:2px;flex:none;color:var(--stage-ok)}
.scs .dr-seeds div.done{color:var(--stage-mute);text-decoration:line-through}
.scs .dr-seeds small{color:var(--stage-mute)}
.scs .dr-resolve{align-self:flex-start;margin-top:4px}
.scs .dr-kv{display:flex;flex-direction:column;gap:12px}
.scs .dr-kv h4{margin:0 0 4px;font:600 var(--text-meta)/1.4 var(--font-body);text-transform:capitalize;color:var(--stage-soft)}
.scs .dr-kv p{margin:0;font:var(--text-control)/1.6 var(--font-body);color:var(--stage-text-dim)}
.scs .dr-kv ul{margin:0;padding-left:18px;font:var(--text-control)/1.6 var(--font-body);color:var(--stage-text-dim)}
.scs .dr-filters{display:flex;align-items:center;gap:4px;padding:8px 12px;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent)}
.scs .dr-filters-r{margin-left:auto;display:flex;align-items:center;gap:8px;font:var(--rc-s-10px) var(--font-body);color:var(--stage-mute)}
.scs .dr-feed{display:flex;flex-direction:column}
.scs .dr-act{padding:8px 12px;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent)}
.scs .dr-act.more{cursor:pointer}
.scs .dr-act.more:hover{background:color-mix(in srgb,var(--stage-card) 5%,transparent)}
.scs .dr-act-h{display:flex;align-items:center;justify-content:space-between;gap:8px}
.scs .dr-act-l{display:flex;align-items:center;gap:6px;min-width:0}
.scs .dr-act-l b{font:500 var(--text-meta)/1.4 var(--font-body)}
.scs .dr-act small{font:var(--rc-s-10px) var(--font-body);color:var(--stage-mute)}
.scs .dr-act svg{color:var(--stage-mute)}
.scs .dr-dot{width:6px;height:6px;flex:none;background:var(--c)}
.scs .dr-act p{margin:2px 0 0;padding-left:12px;font:var(--text-meta)/1.5 var(--font-body);color:var(--stage-text-dim);white-space:pre-wrap;overflow-wrap:anywhere}
.scs .dr-act p.clamp{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.scs .dr-act pre{margin:8px 0 0 12px;padding:8px;border:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);background:color-mix(in srgb,var(--stage-black) 30%,transparent);font:var(--rc-s-10px)/1.5 var(--font-mono);color:var(--stage-mute);white-space:pre-wrap;overflow-wrap:anywhere;border-radius:var(--rc-radius-sm)}
.scs .dr-act-m{margin:6px 0 0 12px;font:var(--rc-s-9px) var(--font-mono);color:var(--stage-mute)}
.scs .dr-warn{display:flex;align-items:flex-start;gap:8px;padding:10px;border:1px solid color-mix(in srgb,var(--stage-warn) 20%,transparent);background:color-mix(in srgb,var(--stage-warn) 10%,transparent);color:var(--stage-warn);font:var(--text-control)/1.4 var(--font-body);border-radius:var(--rc-radius-sm)}
.scs .dr-warn svg{flex:none;margin-top:2px}
.scs .dr-fold{border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);background:color-mix(in srgb,var(--stage-card) 3%,transparent);border-radius:var(--rc-radius-sm)}
.scs .dr-fold-b{padding:8px 12px 12px;border-top:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);max-height:calc(100vh - 16rem);overflow-y:auto}
.scs .dr-raw{margin:0;padding:8px;background:color-mix(in srgb,var(--stage-black) 40%,transparent);font:var(--text-meta)/1.5 var(--font-mono);color:var(--stage-text-dim);white-space:pre-wrap;overflow-wrap:anywhere;border-radius:var(--rc-radius-sm)}
.scs .dr-seed{display:flex;align-items:flex-start;gap:8px;padding:8px;border:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);background:color-mix(in srgb,var(--stage-card) 3%,transparent);border-radius:var(--rc-radius-sm)}
.scs .dr-seed>svg{margin-top:2px;flex:none;color:var(--stage-ok)}
.scs .dr-seed>div{flex:1;min-width:0}
.scs .dr-seed .dr-chips{margin-top:0}
.scs .dr-seed b{font:500 var(--text-control)/1.4 var(--font-body);color:var(--stage-soft)}
.scs .dr-ok-text,.scs .dr-warn-text{margin:2px 0 0;font:var(--rc-s-10px)/1.5 var(--font-body)}
.scs .dr-ok-text{color:var(--stage-ok)}.scs .dr-warn-text{color:var(--stage-warn)}
.scs .dr-ok-text span,.scs .dr-warn-text span{opacity:.7}
.scs .dr-form{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid color-mix(in srgb,var(--bk-role-select) 20%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--stage-card) 5%,transparent)}
.scs .dr-form label{display:flex;flex-direction:column;gap:4px;font:600 var(--rc-s-10px)/1.5 var(--font-body);letter-spacing:.05em;text-transform:uppercase;color:var(--rc-zinc-500)}
.scs .dr-form input,.scs .dr-form textarea,.scs .dr-form select{width:100%;padding:6px 8px;border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--rc-zinc-900) 60%,transparent);color:var(--rc-zinc-200);font:400 var(--rc-text-xs)/1.33 var(--font-body);text-transform:none;letter-spacing:0;transition:border-color .15s}
.scs .dr-form input::placeholder,.scs .dr-form textarea::placeholder{color:var(--rc-zinc-600)}
.scs .dr-form input:focus,.scs .dr-form textarea:focus,.scs .dr-form select:focus{outline:0;border-color:color-mix(in srgb,var(--bk-role-select) 50%,transparent)}
.scs .dr-formhead{display:inline-flex;align-items:center;gap:6px;color:var(--bk-role-select-text)}
.scs .dr-form .dr-row b{font:600 var(--rc-text-xs)/1.33 var(--font-body);color:var(--rc-zinc-300)}
.scs .dr-form .dr-row.end{gap:8px;padding-top:4px}
.scs .dr-form textarea{resize:vertical}
.scs .dr-err{margin:0;padding:4px 8px;border:1px solid color-mix(in srgb,var(--stage-danger-text) 20%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--stage-danger-text) 10%,transparent);font:400 var(--rc-s-11px)/1.4 var(--font-body);color:var(--stage-danger-text)}
.scs .dr-done-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);background:color-mix(in srgb,var(--stage-card) 2%,transparent);opacity:.6;font:var(--rc-s-10px) var(--font-body);color:var(--stage-mute);border-radius:var(--rc-radius-sm)}
.scs .dr-note{display:flex;align-items:flex-start;gap:8px;padding:6px 8px;border:1px solid color-mix(in srgb,var(--stage-card) 5%,transparent);background:color-mix(in srgb,var(--stage-card) 3%,transparent);border-radius:var(--rc-radius-sm)}
.scs .dr-note>svg{margin-top:3px;flex:none;color:var(--stage-warn)}
.scs .dr-note p{flex:1;margin:0;font:var(--rc-s-10px)/1.5 var(--font-body);color:var(--stage-text-dim)}
.scs .dr-store{display:flex;flex-direction:column;gap:6px}
.scs .dr-store .dr-row{margin:0;font:var(--rc-s-10px) var(--font-body);color:var(--stage-mute)}
.scs .dr-store .dr-row b{font:600 var(--rc-s-10px) var(--font-mono);color:var(--stage-soft)}
.scs .dr-store .dr-row b.warn{color:var(--stage-warn)}
.scs .dr-tour{display:flex;align-items:flex-start;gap:10px;margin-bottom:12px;padding:10px 12px;border:1px solid var(--w);background:color-mix(in srgb,var(--w) 9%,var(--stage-panel));color:var(--stage-card);font:var(--rc-s-10px)/1.5 var(--font-body);border-radius:var(--rc-radius-sm)}
.scs .dr-tour>svg{margin-top:2px;flex:none;color:var(--w)}
.scs .dr-tour>div{flex:1;min-width:0}
.scs .dr-tour p{margin:4px 0 0;color:var(--stage-soft)}
.scs .dr-tour ul{margin:6px 0 0;padding-left:16px;color:var(--stage-soft)}
.scs .dr-fab{--w:var(--deck-persona);position:absolute;z-index:44}
.scs .dr-fab [data-part="scene.director.fab.button"]{touch-action:none}
.scs .dr-fab [data-part="scene.director.fab.button"][aria-expanded="true"]{border-color:var(--w);color:var(--w)}
.scs .dr-fab [data-pulse]{color:var(--c);animation:dr-fab-pulse 6s ease-out 1 both}
@keyframes dr-fab-pulse{0%,60%{border-color:var(--c);box-shadow:0 0 0 3px color-mix(in srgb,var(--c) 40%,transparent),3px 3px 0 0 var(--stage-black)}100%{border-color:var(--stage-line);box-shadow:3px 3px 0 0 var(--stage-black)}}
.scs .dr-fab-badge{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 4px;display:grid;place-items:center;background:var(--w);color:var(--stage-black);font:700 var(--rc-s-10px)/1 var(--font-body);pointer-events:none;border-radius:var(--rc-radius)}
.scs .dr-fab-pop{position:absolute;bottom:52px;width:320px;max-width:calc(100vw - 32px);max-height:420px;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--stage-line);background:var(--stage-panel);box-shadow:6px 6px 0 0 var(--stage-black);right:0;border-radius:var(--rc-radius-sm)}
.scs .dr-fab-pop.below{bottom:auto;top:52px}
.scs .dr-fab-pop.right{right:auto;left:0}
.scs .dr-fab-hd{display:flex;align-items:center;gap:6px;padding:8px 12px;border-bottom:1px solid var(--stage-seam);font:500 var(--rc-s-10px)/1.4 var(--font-body);letter-spacing:.08em;text-transform:uppercase;color:var(--stage-text-dim)}
.scs .dr-fab-hd svg{color:var(--w)}
.scs .dr-fab-list{overflow-y:auto;max-height:340px}
.scs .ds{--w:var(--deck-persona);display:flex;flex-direction:column;gap:12px}
.scs .ds-block{display:flex;flex-direction:column;gap:6px}
.scs .ds-h{font:700 var(--rc-s-10px)/1.4 var(--font-body);letter-spacing:.14em;text-transform:uppercase;color:var(--stage-text-dim)}
.scs .ds-help{margin:0;font:var(--rc-s-10px)/1.5 var(--font-body);color:var(--stage-soft)}
.scs .ds-amber{margin:0;font:var(--rc-s-10px)/1.5 var(--font-body);color:var(--stage-warn)}
.scs .ds-err{margin:0;font:var(--rc-s-10px)/1.5 var(--font-body);color:var(--stage-danger-text)}
.scs .ds-quiet{align-self:flex-start}
.scs .ds-box{display:flex;flex-direction:column;gap:6px;padding:12px;border:2px solid var(--stage-black);background:var(--stage-well);box-shadow:2px 2px 0 0 var(--stage-black);border-radius:var(--rc-radius-sm)}
.scs .ds-box .ds-h{color:var(--stage-card);letter-spacing:.14em}
.scs .ds-modes{display:grid;grid-template-columns:1fr 1fr;gap:6px}
@container (max-width:30rem){.scs .ds-modes{grid-template-columns:1fr}}
.scs .ds-cap{display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid color-mix(in srgb,var(--c) 25%,transparent);background:color-mix(in srgb,var(--c) 6%,transparent);color:var(--c);font:var(--rc-s-10px)/1.4 var(--font-body);border-radius:var(--rc-radius-sm)}
.scs .ds-cap.ok{--c:var(--stage-ok)}.scs .ds-cap.warn{--c:var(--stage-warn)}.scs .ds-cap.info{--c:var(--bk-role-info-text)}
.scs .ds-runtime{display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid var(--stage-seam);background:color-mix(in srgb,var(--stage-black) 40%,transparent);border-radius:var(--rc-radius-sm)}
.scs .ds-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 8px;border:1px solid color-mix(in srgb,var(--stage-card) 6%,transparent);background:color-mix(in srgb,var(--stage-panel) 60%,transparent);font:var(--rc-s-10px)/1.4 var(--font-body);color:var(--stage-text-dim);border-radius:var(--rc-radius-sm)}
.scs .ds-row>span:first-child{display:inline-flex;align-items:center;gap:6px;min-width:0}
.scs .ds-row svg{color:var(--stage-soft)}
.scs .ds-row input{width:4.5rem;padding:4px 6px;border:1px solid var(--stage-line);background:var(--stage-row);color:var(--stage-soft);text-align:center;font:var(--rc-s-10px) var(--font-body);border-radius:var(--rc-radius)}
.scs .ds-row input:focus{outline:none;border-color:var(--w)}
.scs .ds-instr{padding:6px 8px;border:1px solid color-mix(in srgb,var(--stage-card) 6%,transparent);background:color-mix(in srgb,var(--stage-panel) 60%,transparent);border-radius:var(--rc-radius-sm)}
.scs .ds-instr label{display:flex;align-items:center;gap:6px;margin-bottom:4px;font:var(--rc-s-10px)/1.4 var(--font-body);color:var(--stage-text-dim)}
.scs .ds-instr textarea{width:100%;padding:6px 8px;border:1px solid var(--stage-line);background:var(--stage-black);color:var(--stage-card);font:var(--rc-s-11px)/1.6 var(--font-body);resize:vertical;border-radius:var(--rc-radius)}
.scs .ds-instr textarea:focus{outline:none;border-color:var(--w)}
.scs .ds-instr p{display:flex;justify-content:space-between;margin:4px 0 0;font:var(--rc-s-9px)/1.4 var(--font-body);color:var(--stage-mute)}
.scs .dp-av{display:grid;place-items:center;overflow:hidden;flex:none;width:56px;height:56px;border:2px solid color-mix(in srgb,var(--pc) 30%,transparent);border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--pc) 20%,transparent);color:var(--pc);font:600 1.5rem/1 var(--font-body);letter-spacing:.025em}
.scs .dp-av img{width:100%;height:100%;object-fit:cover}
.scs .dp-av.xl{width:72px;height:72px;border-color:color-mix(in srgb,var(--pc) 60%,transparent);font-size:1.875rem}
.scs .dp-list [aria-selected="true"] .dp-av{border-color:color-mix(in srgb,var(--pc) 60%,transparent)}
.scs .dp-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.scs .dp-name{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px}
.scs .dp-name b{font:600 1.125rem/1.56 var(--font-body);color:var(--stage-white)}
.scs .dp-list .dp-name{margin-bottom:0}
.scs .dp-list .dp-name b{font-size:1rem;line-height:1.5}
.scs .dp-name i{padding:2px 10px;border-radius:var(--rc-radius-sm);background:color-mix(in srgb,var(--pc) 25%,transparent);color:var(--pc);font:500 var(--rc-text-xs)/1.33 var(--font-body);font-style:normal}
.scs .dp-list .dp-name i{padding:2px 8px;background:color-mix(in srgb,var(--pc) 20%,transparent)}
.scs .dp-tx em{font:italic var(--rc-text-sm)/1.43 var(--font-body);color:var(--rc-zinc-300)}
.scs .dp-list .dp-tx em{margin-top:2px}
.scs .dp-sub{display:flex;flex-direction:column;gap:2px}
.scs .dp-sub em{font:italic var(--rc-text-sm)/1.43 var(--font-body);color:var(--rc-zinc-300)}
.scs .dp-sub .dp-desc{margin-top:8px;font:var(--rc-text-sm)/1.625 var(--font-body);color:var(--rc-zinc-400)}
.scs .dp-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.scs .dp-chips span{padding:2px 8px;border-radius:var(--rc-radius-sm);background:var(--rc-zinc-800);color:var(--rc-zinc-300);font:var(--rc-text-xs)/1.33 var(--font-body);text-transform:capitalize}
.scs .dp-chips.arcs span{padding:4px 10px;background:color-mix(in srgb,var(--pc) 12%,transparent);color:var(--pc)}
.scs .dp-more .dp-chips span{background:color-mix(in srgb,var(--rc-zinc-800) 80%,transparent);color:var(--rc-zinc-200)}
.scs .dp-more .dp-chips:not(.arcs):last-child span{color:var(--rc-zinc-400)}
.scs .dp-list{display:flex;flex-direction:column;gap:12px;padding-top:8px;animation:dp-open .3s ease}
@keyframes dp-open{from{opacity:0}to{opacity:1}}
@keyframes dp-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.scs .dp-head{display:flex;align-items:center;gap:12px;margin-bottom:0}
.scs .dp-check{display:grid;place-items:center;width:28px;height:28px;flex:none;border-radius:var(--rc-radius-full);background:var(--pc);color:var(--stage-white)}
.scs .dp-list [data-control="menuitem"]{animation:dp-in .25s ease backwards;animation-delay:calc(var(--i,0)*30ms)}
.scs .dp-list [aria-selected="true"]{background:color-mix(in srgb,var(--pc) 8%,transparent)}
.scs .dp-body{display:flex;flex-direction:column;gap:8px;white-space:normal}
.scs .dp-body>small{margin-bottom:0;font:var(--rc-text-sm)/1.625 var(--font-body);color:var(--rc-zinc-400)}
.scs .dp-more{display:flex;flex-direction:column;gap:10px;padding-top:8px;border-top:1px solid color-mix(in srgb,var(--rc-zinc-800) 80%,transparent)}
.scs .dp-more ul{margin:0;padding:0;list-style:none;font:var(--rc-text-sm)/1.43 var(--font-body);color:var(--rc-zinc-300)}
.scs .dp-more li{display:flex;align-items:flex-start;gap:8px;margin-bottom:2px}
.scs .dp-more li::before{content:"\\2022";flex:none;margin-top:2px;color:var(--rc-zinc-600)}
.scs .dp-h{margin-bottom:-4px;font:500 var(--rc-text-xs)/1.33 var(--font-body);letter-spacing:.05em;text-transform:uppercase;color:var(--rc-zinc-500)}
.scs .dp-more .dp-chips{margin-top:0;gap:8px}
.scs .dp-more .dp-chips:not(.arcs){gap:6px}
@media (prefers-reduced-motion:reduce){.scs .dp-list,.scs .dp-list [data-control="menuitem"]{animation:none}}
.scs .ds-aware{display:flex;flex-direction:column;gap:2px}
.scs .ds-aware>.ds-row{margin:0}
.scs .ds-pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.scs .ds-pair>div{display:flex;flex-direction:column;gap:2px;min-width:0}
@container (max-width:30rem){.scs .ds-pair{grid-template-columns:1fr}}
.scs .ds-hint{margin:0;padding:0 8px 4px;font:var(--rc-s-10px)/1.45 var(--font-body);color:var(--stage-soft)}
.scs .ds-hint.warn{color:var(--stage-warn)}
.scs .ds-row .unit{margin-left:6px;font:var(--rc-s-10px) var(--font-body);color:var(--stage-soft)}
.scs .ds-row.def{background:color-mix(in srgb,var(--w) 8%,transparent);border-color:color-mix(in srgb,var(--w) 30%,transparent)}
.scs .stp{display:inline-flex;align-items:center;gap:4px}
.scs .stp input{width:2.6rem}
.scs .ds-list{display:flex;flex-direction:column;gap:4px}
.scs .ds-trow{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid color-mix(in srgb,var(--stage-card) 6%,transparent);background:color-mix(in srgb,var(--stage-panel) 60%,transparent);font:var(--rc-s-10px)/1.4 var(--font-body);color:var(--stage-text-dim);border-radius:var(--rc-radius-sm)}
.scs .ds-trow b{flex:1;min-width:0;display:inline-flex;align-items:center;gap:6px;font-weight:500;color:var(--stage-soft)}
.scs .ds-trow .ev{display:inline-flex;align-items:center;gap:6px}
.scs .ds-trow.off .ev{opacity:.35}
.scs .ds-trow.off b{color:var(--stage-mute)}
.scs .ds-trow input{width:2.6rem;padding:3px 4px;border:1px solid var(--stage-line);background:var(--stage-row);color:var(--stage-soft);text-align:center;font:var(--rc-s-10px) var(--font-body);border-radius:var(--rc-radius)}
.scs .ds-list-h{margin:4px 0 0;font:700 var(--rc-s-10px)/1.4 var(--font-body);letter-spacing:.14em;text-transform:uppercase;color:var(--stage-text-dim)}
.scs .trk-ro{display:flex;flex-direction:column;gap:2px;font:var(--text-control)/1.4 var(--font-body);color:var(--stage-soft)}
.scs .trk-ro>span{display:inline-flex;align-items:center;gap:6px}
.scs .trk-ro.dim>span{color:var(--stage-mute)}
.scs .trk-ro-link{align-self:flex-start;margin-left:20px}
.scs .trk-undo-x{margin-left:12px}
.scs .dp-ctx{display:contents}
.scs .dr-fab-foot{border-top:1px solid var(--stage-seam)}
.scs .dr-form .dr-row.end>[type=submit]{flex:1}
@keyframes dr-pane-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.scs .dr-tabpanel{animation:dr-pane-in .15s ease-out}
.scs .dr-arc-b{animation:dr-pane-in .2s ease-out}
.scs .dr-arc-h{transition:color .15s,background-color .15s,border-color .15s}
@media (prefers-reduced-motion:reduce){.scs .dr-tabpanel,.scs .dr-arc-b{animation:none}.scs .dr-arc-h,.scs .dr-chev{transition:none}}
`;
