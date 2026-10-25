/**
 * The Prompting wing's Guides, Scene Note, Templates and Writing Tools tabs, copied from RoleCall (values converted from
 * Tailwind and inline styles; sources: packages/guides-editor GuideListRail.tsx, GuideEntryPanel.tsx, primitives.tsx and
 * GuidesEditorContent.tsx for Guides; AuthorNotePanel.tsx and wing-shell/WingShell.tsx WingCard, WingSectionLabel, WingChip for
 * Scene Note; PresetPanel.tsx:1728 and :3416 for Templates; WritingToolsPanel.tsx for Writing Tools). Their hard black borders
 * and offset shadows read --stage-black, their surfaces the nearest stage and zinc tokens, and the placement and category hues
 * the nearest deck tokens (see the report: RoleCall's own hues have no token yet). Colors come from tokens; corners are square
 * because RoleCall's neobrut panels are. The switches (.sw) and the depth slider are the shared controls' and are not set here.
 */
export const PROMPTING_STYLE = `
.scs .pn-note .pp-top{padding:24px 24px 0}
.scs .pg-status{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:var(--rc-text-p7rem, .7rem);font-weight:700;letter-spacing:.16em;text-transform:uppercase}
.scs .pg-status>span{display:inline-flex;align-items:center;gap:6px;color:var(--rc-zinc-400)}
.scs .pg-status .warn{padding:2px 8px;border:1px solid var(--w);background:var(--w-soft);color:var(--w)}
.scs .pg-body{display:flex;flex-direction:column;gap:20px;padding:20px 24px}
.scs .pg-guides .pg-body{display:block;padding:16px 18px 20px}
.scs .pg-body>.note{margin:0 0 12px;padding:8px 12px;border:2px solid var(--stage-black);border-left-width:2px;box-shadow:3px 3px 0 0 var(--stage-black);background:var(--stage-danger-bg);font-size:var(--rc-text-sm);line-height:1.25rem;color:var(--stage-danger-text)}
.scs .pg-card{padding:16px;border:1px solid color-mix(in srgb,var(--rc-zinc-800) 80%,transparent);background:color-mix(in srgb,var(--rc-zinc-950) 55%,transparent);box-shadow:3px 3px 0 0 var(--stage-black)}
.scs .pg-label{display:flex;align-items:center;gap:8px;font-size:var(--rc-text-ctl);font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--w)}
.scs .pg-label svg{opacity:.9}
.scs .pg-label small{margin-left:auto;font-size:var(--rc-text-p7rem, .7rem);font-weight:600;letter-spacing:.14em;color:var(--rc-zinc-400)}
.scs .pg-card textarea{display:block;box-sizing:border-box;width:100%;min-height:96px;max-height:60vh;margin-top:12px;padding:10px 12px;resize:vertical;border:2px solid var(--rc-zinc-700);background:color-mix(in srgb,var(--stage-black) 60%,transparent);box-shadow:inset 2px 2px 0 0 color-mix(in srgb,var(--stage-black) 40%,transparent);font:var(--rc-text-p92rem, .92rem)/1.5 var(--font-ui);color:var(--rc-zinc-100);outline:none;transition:border-color .15s}
.scs .pg-card textarea::placeholder{color:var(--rc-zinc-500)}
.scs .pg-card textarea:focus{border-color:var(--w);box-shadow:0 0 0 2px var(--w-soft),inset 2px 2px 0 0 color-mix(in srgb,var(--stage-black) 40%,transparent)}
.scs .pg-help{margin:8px 0 0;font-size:var(--rc-text-wing);color:var(--rc-zinc-400)}
.scs .pg-help code{font-family:inherit;color:var(--rc-zinc-300)}
.scs .pg-help.pg-hint{margin-top:10px;font-size:var(--rc-text-p85rem, .85rem);color:var(--rc-zinc-300)}
.scs .pg-opts{display:flex;flex-direction:column;gap:8px;margin-top:12px}
.scs .pg-opt{display:flex;width:100%;align-items:flex-start;gap:12px;padding:12px 14px;text-align:left;border:2px solid var(--rc-zinc-700);background:color-mix(in srgb,var(--rc-zinc-900) 50%,transparent);box-shadow:2px 2px 0 0 var(--stage-black);color:var(--rc-zinc-400);cursor:pointer;font-family:var(--font-ui);transition:border-color .15s,background .15s}
.scs .pg-opt:hover{border-color:var(--rc-zinc-500)}
.scs .pg-opt.on{border-color:var(--w);background:var(--w-soft);color:var(--w)}
.scs .pg-opt>svg{flex:none;margin-top:2px}
.scs .pg-opt b{display:block;font-size:var(--rc-text-p86rem, .86rem);font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--rc-zinc-100)}
.scs .pg-opt.on b{color:var(--rc-zinc-50)}
.scs .pg-opt small{display:block;margin-top:4px;font-size:var(--rc-text-p85rem, .85rem);color:var(--rc-zinc-300)}
.scs .pg-depth{display:flex;align-items:center;gap:12px;margin-top:12px}
.scs .pg-depth input{flex:1;accent-color:var(--w)}
.scs .pg-depth b{min-width:2.75rem;box-sizing:border-box;padding:4px 10px;text-align:center;border:2px solid var(--w);background:var(--w-soft);color:var(--w);font-size:1rem;font-weight:900}
.scs .pg-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.scs .pg-chip{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border:2px solid var(--rc-zinc-600);background:none;font:700 var(--rc-text-ctl) var(--font-ui);letter-spacing:.1em;text-transform:uppercase;color:var(--rc-zinc-300);cursor:pointer;transition:border-color .15s,color .15s}
.scs .pg-chip:hover{border-color:var(--rc-zinc-400);color:var(--rc-zinc-100)}
.scs .pg-chip.on{border-color:var(--w);background:var(--w-soft);box-shadow:2px 2px 0 0 var(--w-soft);color:var(--rc-zinc-50)}
.scs .pg-fold{display:flex;width:100%;align-items:center;gap:9px;padding:12px 15px;border:0;background:none;font:700 var(--rc-text-xs) var(--font-ui);letter-spacing:.08em;text-transform:uppercase;color:var(--rc-zinc-400);cursor:pointer}
.scs .pg-fold.on{color:var(--stage-card)}
.scs .pg-fold svg:first-child{color:var(--w)}
.scs .pg-fold svg:last-child{margin-left:auto;color:var(--rc-zinc-500)}
.scs .pg-fold.pg-tipsbtn{display:inline-flex;width:auto;gap:8px;padding:8px 14px;border:2px solid var(--rc-zinc-700);background:color-mix(in srgb,var(--stage-black) 50%,transparent);box-shadow:2px 2px 0 0 var(--stage-black);font-size:var(--rc-text-p74rem, .74rem);letter-spacing:.16em;color:var(--rc-zinc-200);transition:color .15s,border-color .15s}
.scs .pg-fold.pg-tipsbtn:hover{border-color:var(--rc-zinc-500);color:var(--rc-zinc-50)}
.scs .pg-fold.pg-tipsbtn svg:first-child,.scs .pg-fold.pg-tipsbtn svg:last-child{margin-left:0;color:inherit}
.scs .pg-tips{display:flex;flex-direction:column;gap:12px;margin-top:12px}
.scs .pg-tips b{display:block;font-size:var(--rc-text-p68rem, .68rem);font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--rc-zinc-300)}
.scs .pg-tips code{display:block;margin-top:6px;padding:8px 10px;border:2px solid var(--rc-zinc-700);background:color-mix(in srgb,var(--stage-black) 60%,transparent);font:var(--rc-text-wing) var(--font-ui);color:var(--rc-zinc-200)}
.scs .pg-rail{display:flex;flex-direction:column;min-width:0}
.scs .pg-new{display:flex;width:100%;align-items:center;justify-content:center;gap:8px;margin-bottom:14px;padding:10px;border:2px solid var(--stage-black);background:var(--w);box-shadow:3px 3px 0 0 var(--stage-black);color:var(--rc-zinc-950);font:800 var(--rc-text-xs) var(--font-ui);letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
.scs .pg-search{display:flex;width:100%;box-sizing:border-box;align-items:center;gap:8px;margin-bottom:6px;padding:8px 11px;border:2px solid var(--stage-black);background:var(--stage-row);box-shadow:2px 2px 0 0 var(--stage-black)}
.scs .pg-search svg{flex:none;color:var(--rc-zinc-500)}
.scs .pg-search input{min-width:0;flex:1;padding:0;border:0;background:none;font:var(--rc-text-xs) var(--font-ui);color:var(--rc-zinc-200);outline:none}
.scs .pg-search input::placeholder{color:var(--rc-zinc-600)}
.scs .pg-cat{display:flex;align-items:center;gap:8px;margin:14px 0 9px;padding:9px 11px;border:2px solid var(--stage-black);background:var(--rc-zinc-800);box-shadow:3px 3px 0 0 var(--stage-black);color:var(--stage-card)}
.scs .pg-cat svg{flex:none;color:var(--c)}
.scs .pg-cat b{font-size:var(--rc-text-11, 11px);font-weight:700;letter-spacing:.1em;text-transform:uppercase}
.scs .pg-cat small{margin-left:auto;padding:0 5px;border:1px solid var(--rc-zinc-700);font-size:var(--rc-text-10, 10px);color:var(--rc-zinc-500)}
.scs .c-situational{--c:var(--deck-lorebook)}.scs .c-thinking{--c:var(--deck-preset)}.scs .c-clothes{--c:var(--stage-ok)}.scs .c-state{--c:var(--stage-warn)}.scs .c-rules{--c:var(--stage-danger-text)}.scs .c-custom{--c:var(--rc-zinc-500)}
.scs .pg-row{display:flex;align-items:center;gap:9px;margin-bottom:8px;padding:9px 10px;border:2px solid var(--stage-black);background:var(--rc-zinc-900);box-shadow:2px 2px 0 0 var(--stage-black)}
.scs .pg-row.sel{border-color:var(--w);background:color-mix(in srgb,var(--w) 8%,var(--rc-zinc-900));box-shadow:3px 3px 0 0 var(--w)}
.scs .pg-title{flex:1;min-width:0;padding:0;border:0;background:none;text-align:left;font:600 var(--rc-text-xs) var(--font-ui);color:var(--rc-zinc-200);cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scs .pg-pill,.scs .pg-mode{border:1px solid var(--m,var(--rc-zinc-500));color:var(--m,var(--rc-zinc-500));font-weight:800;letter-spacing:.06em;text-transform:uppercase;background:none}
.scs .pg-pill{flex:none;padding:1px 5px;font-size:var(--rc-text-8p5, 8.5px)}
.scs .m-standard{--m:var(--rc-zinc-400)}.scs .m-depth{--m:var(--deck-preset)}.scs .m-append{--m:var(--stage-warn)}.scs .m-macro{--m:var(--deck-lorebook)}.scs .m-chat_start{--m:var(--stage-ok)}
.scs .pg-editor{display:flex;flex-direction:column;margin:16px -18px 0;padding:16px 18px 0;border-top:2px solid var(--stage-black)}
.scs .pg-ehead{display:flex;align-items:center;gap:11px;margin-bottom:14px;padding-bottom:13px;border-bottom:2px solid var(--stage-black)}
.scs .pg-ic{width:30px;height:30px;box-sizing:border-box;flex:none;display:grid;place-items:center;border:2px solid var(--stage-black);background:var(--stage-row);color:var(--c)}
.scs .pg-name{min-width:0;flex:1;padding:2px 0;border:0;background:none;font:700 var(--rc-text-15, 15px) var(--font-fancy);letter-spacing:.04em;text-transform:uppercase;color:var(--rc-zinc-50);outline:none}
.scs .pg-name::placeholder{text-transform:none;color:var(--rc-zinc-600)}
.scs .pp .pg-ehead .tbtn{width:34px;height:32px;border:2px solid var(--stage-black);border-radius:0;background:var(--rc-zinc-900);box-shadow:3px 3px 0 0 var(--stage-black);color:var(--rc-zinc-400)}
.scs .pp .pg-ehead .tbtn:hover{background:var(--rc-zinc-900);color:var(--rc-zinc-100)}
.scs .pp .pg-ehead .tbtn.red:hover{background:var(--rc-zinc-900);color:var(--stage-danger-text)}
.scs .pg-ask{display:flex;gap:8px;margin-top:8px}
.scs .pg-controls{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.scs .pg-controls.pg-top{gap:9px;margin-bottom:16px}
.scs .pg-controls select,.scs .pg-num{padding:6px 9px;border:2px solid var(--stage-black);background:var(--stage-row);box-shadow:3px 3px 0 0 var(--stage-black);font:600 var(--rc-text-xs) var(--font-ui);color:var(--rc-zinc-200);cursor:pointer;outline:none}
.scs .pg-num{width:76px;box-sizing:border-box;box-shadow:2px 2px 0 0 var(--stage-black);font:400 var(--rc-text-sm) var(--font-ui);color:var(--rc-zinc-100);cursor:text}
.scs .pg-editor .pg-label{margin-top:16px;margin-bottom:9px;gap:7px;font-size:var(--rc-text-10p5, 10.5px);letter-spacing:.13em;color:var(--rc-zinc-400)}
.scs .pg-editor .pg-top+.pg-label{margin-top:0}
.scs .pg-editor .pg-label svg{opacity:1}
.scs .pg-content{display:block;box-sizing:border-box;width:100%;min-height:62px;max-height:60vh;resize:vertical;padding:14px 16px;border:2px solid var(--stage-black);background:var(--stage-row);box-shadow:3px 3px 0 0 var(--stage-black);font:var(--rc-text-13, 13px)/1.6 var(--font-ui);color:var(--rc-zinc-200);outline:none}
.scs .pg-content::placeholder{color:var(--rc-zinc-600)}
.scs .pg-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:8px;font:var(--rc-text-11p5, 11.5px) var(--font-mono);color:var(--rc-zinc-500)}
.scs .pg-foot>span:first-child{display:flex;align-items:center;gap:6px}
.scs .pg-mac{margin:0;padding:3px 8px;border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);background:var(--stage-row);font:var(--rc-text-11, 11px) var(--font-mono);color:var(--rc-zinc-400);cursor:pointer}
.scs .pg-mac:last-of-type{margin-right:4px}
.scs .pg-mac:hover{color:var(--rc-zinc-100)}
.scs .pg-modes{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:12px}
.scs .pg-mode{display:inline-flex;align-items:center;gap:7px;padding:6px 9px;border-width:2px;background:var(--stage-black);box-shadow:3px 3px 0 0 var(--stage-black);font-size:var(--rc-text-10, 10px);letter-spacing:.08em;cursor:pointer}
.scs .pg-mode.on{background:color-mix(in srgb,var(--m) 18%,var(--stage-black));box-shadow:3px 3px 0 0 var(--m)}
.scs .pg-acc{margin-top:16px;border:2px solid var(--stage-black);background:var(--rc-zinc-900);box-shadow:3px 3px 0 0 var(--stage-black)}
.scs .pg-acc-body{display:flex;flex-direction:column;gap:12px;padding:0 15px 16px}
.scs .pg-adv{display:flex;align-items:center;justify-content:space-between;gap:12px}
.scs .pg-adv b{display:block;font-size:var(--rc-text-sm);line-height:1.25rem;font-weight:500;color:var(--rc-zinc-200)}
.scs .pg-adv small{display:block;font-size:var(--rc-text-xs);line-height:1rem;color:var(--rc-zinc-500)}
.scs .pg-adv select{padding:6px 9px;border:2px solid var(--stage-black);background:var(--stage-row);box-shadow:3px 3px 0 0 var(--stage-black);font:600 var(--rc-text-xs) var(--font-ui);color:var(--rc-zinc-200);outline:none}
.scs .pg-editor .note{margin:12px 0 0;padding:8px 12px;border:2px solid var(--stage-black);box-shadow:3px 3px 0 0 var(--stage-black);background:var(--stage-danger-bg);font-size:var(--rc-text-sm);line-height:1.25rem;color:var(--stage-danger-text)}
.scs .pg-actions{display:flex;gap:10px;margin-top:16px}
.scs .pg-btn{display:flex;flex:1;align-items:center;justify-content:center;gap:8px;padding:6px 10px;border:2px solid var(--rc-zinc-700);background:transparent;font:700 var(--rc-text-11, 11px) var(--font-ui);letter-spacing:.06em;text-transform:uppercase;color:var(--rc-zinc-200);cursor:pointer}
.scs .pg-btn:hover{color:var(--rc-zinc-50)}
.scs .pg-btn.go{border-color:var(--stage-black);background:var(--w);box-shadow:3px 3px 0 0 var(--stage-black);color:var(--rc-zinc-950)}
.scs .pg-btn.go:disabled{opacity:.5;cursor:default}
.scs .pg-btn.red{border-color:var(--stage-danger-edge);color:var(--stage-danger-text)}
.scs .tpl{flex:none;border-bottom:1px solid color-mix(in srgb,var(--w) 40%,transparent)}
.scs .tpl-hd{display:flex;width:100%;align-items:center;gap:6px;padding:8px;border:0;background:none;font:var(--rc-text-wing) var(--font-ui);color:var(--w);cursor:pointer;text-align:left;transition:background .15s}
.scs .tpl-hd:hover{background:var(--w-soft)}
.scs .tpl-hd .tpl-t{font-weight:500}
.scs .tpl-hd .tpl-count,.scs .tpl-hd .cv{color:var(--rc-zinc-300)}
.scs .tpl-hd .tpl-count{margin-left:auto}
.scs .tpl .cv{display:grid;flex:none}.scs .tpl .cv.r{transform:rotate(-90deg)}
.scs .tpl-list{padding-bottom:4px}
.scs .tpl-none{margin:0;padding:8px 12px;font-size:var(--rc-text-ctl);color:var(--rc-zinc-300)}
.scs .tpl-item{border-left:2px solid transparent;transition:background .15s}
.scs .tpl-item:hover{background:color-mix(in srgb,var(--rc-zinc-800) 30%,transparent)}
.scs .tpl-item.set{border-left-color:color-mix(in srgb,var(--w) 30%,transparent)}
.scs .tpl-item.set:hover{background:color-mix(in srgb,var(--w) 5%,transparent)}
.scs .tpl-row{display:flex;width:100%;align-items:center;gap:8px;padding:6px 12px;border:0;background:none;font:var(--rc-text-wing) var(--font-ui);color:var(--rc-zinc-300);cursor:pointer;text-align:left}
.scs .tpl-row .cv{display:grid;flex:none;color:var(--rc-zinc-300)}.scs .tpl-row .cv.r{transform:rotate(-90deg)}
.scs .tpl-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scs .tpl-meta{flex:none;font-size:var(--rc-text-p72rem, .72rem);color:var(--rc-zinc-400)}
.scs .tpl-item.set .tpl-meta{font-size:var(--rc-text-ctl);color:color-mix(in srgb,var(--w) 80%,transparent)}
.scs .tpl-item textarea{display:block;box-sizing:border-box;width:calc(100% - 24px);min-height:80px;max-height:12rem;margin:0 12px 8px;padding:8px;resize:none;border:1px solid color-mix(in srgb,var(--rc-zinc-700) 50%,transparent);border-radius:var(--rc-radius);background:color-mix(in srgb,var(--rc-zinc-800) 50%,transparent);font:var(--rc-text-wing)/1.5 var(--font-ui);color:var(--rc-zinc-300);outline:none}
.scs .tpl-item textarea::placeholder{color:var(--rc-zinc-400)}
.scs .tpl-item textarea:focus{border-color:var(--w)}
.scs .wt-body{display:grid;gap:12px;padding:24px}
.scs .wt-group{border:1px solid var(--rc-zinc-800)}
.scs .wt-hd{display:flex;width:100%;align-items:center;gap:12px;padding:12px 16px;border:0;background:color-mix(in srgb,var(--rc-zinc-900) 60%,transparent);font:var(--rc-text-sm)/1.25rem var(--font-ui);font-weight:500;color:var(--rc-zinc-100);cursor:pointer;text-align:left;transition:background .15s}
.scs .wt-hd:hover{background:color-mix(in srgb,var(--rc-zinc-800) 60%,transparent)}
.scs .wt-hd>svg{flex:none;color:var(--w)}
.scs .wt-hd small{font-size:var(--rc-text-xs);font-weight:400;color:var(--rc-zinc-500)}
.scs .wt-hd .cv{margin-left:auto;display:grid;color:var(--rc-zinc-500)}
.scs .wt-tools{margin:0;padding:0;list-style:none}
.scs .wt-tool{padding:12px 16px;border-top:1px solid color-mix(in srgb,var(--rc-zinc-800) 80%,transparent)}
.scs .wt-tool:first-child{border-top:0}
.scs .wt-line{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px}
.scs .wt-name{font-size:var(--rc-text-sm);line-height:1.25rem;font-weight:600;color:var(--rc-zinc-100)}
.scs .wt-chip{padding:2px 6px;border:1px solid var(--rc-zinc-700);font-size:var(--rc-text-11, 11px);font-weight:500;color:var(--rc-zinc-400)}
.scs .wt-desc{margin:4px 0 0;font-size:var(--rc-text-sm);line-height:1.25rem;color:var(--rc-zinc-400)}
.scs .wt-prompt{margin-top:8px}
.scs .wt-uses{margin-bottom:4px;font-size:var(--rc-text-xs);line-height:1rem;color:var(--rc-zinc-400)}
.scs .wt-uses b{font-weight:400;color:var(--rc-zinc-200)}
.scs .wt-prompt .tpl-item,.scs .wt-prompt .wt-none{border:0;border-left:2px solid transparent}
.scs .wt-prompt .tpl-item.set{border-left-color:color-mix(in srgb,var(--w) 30%,transparent)}
.scs .wt-none{margin:0;font-size:var(--rc-text-xs);color:var(--rc-zinc-500)}
.scs .wt-sends{display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:2px 0;border:0;background:none;font:600 var(--rc-text-micro) var(--font-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--rc-zinc-400);cursor:pointer}
.scs .wt-sends:hover{color:var(--rc-zinc-100)}
.scs .wt-sends-text{margin:6px 0 0;padding:8px 10px;border-left:2px solid var(--rc-zinc-700);font-size:var(--rc-text-xs);line-height:1.5;color:var(--rc-zinc-300)}
.scs .wt-foot{margin:0;font-size:var(--rc-text-xs);line-height:1rem;color:var(--rc-zinc-500)}
`;
