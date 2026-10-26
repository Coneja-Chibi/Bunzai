/**
 * The Final Cut wing's Regex tab (RoleCall's RegexPanel, on the Prompting wing's look in prompting-style.ts) and the Stage wing's Wardrobe rows: the script list with its
 * drag handle, the open row's actions, and the empty state. Colors come from the theme tokens; corners are square.
 */
export const REGEX_STYLE = `
.scs .rx-list{display:flex;flex-direction:column;gap:6px;padding:0 20px 20px}
.scs .rx-item{border:2px solid var(--stage-line);background:var(--stage-row);position:relative}
.scs .rx-item:hover{border-color:var(--stage-mute)}
.scs .rx-item.on{border-color:var(--w);background:color-mix(in srgb,var(--w) 10%,transparent)}
.scs .rx-item.on::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--w)}
.scs .rx-item.drag{opacity:.5}
.scs .rx-head{display:flex;align-items:stretch}
.scs .rx-head [data-control="disclosure"]{flex:1;min-width:0;width:auto}
.scs .rx-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
.scs .rx-count{flex:none;min-width:3.5rem;display:flex;flex-direction:column;align-items:center;padding:4px 10px;border:2px solid var(--stage-line);background:var(--stage-black)}
.scs .rx-item.on .rx-count{border-color:var(--w)}
.scs .rx-count b{font:900 1.25rem/1 var(--font-fancy);color:var(--w)}
.scs .rx-count small{margin-top:2px;font:700 var(--text-meta) var(--font-big);letter-spacing:.16em;text-transform:uppercase;color:var(--stage-soft)}
.scs .rx-acts{display:flex;gap:6px;padding:10px 12px;border-top:2px solid var(--stage-line)}
.scs .rx-acts [data-control="chip"]{flex:1;justify-content:center}
.scs .rx-none{display:flex;flex-direction:column;align-items:center;gap:6px;padding:40px 16px;text-align:center}
.scs .rx-none .box{width:56px;height:56px;display:grid;place-items:center;margin-bottom:8px;border:2px solid var(--w);background:color-mix(in srgb,var(--w) 12%,transparent);color:var(--w)}
.scs .rx-none b{font:700 1.1rem var(--font-fancy);letter-spacing:.08em;text-transform:uppercase;color:var(--stage-card)}
.scs .rx-none small{font:var(--text-body) var(--font-big);color:var(--stage-text-dim)}
.scs .wd{padding:0 0 20px}
.scs .wd .pg-card:first-child{margin-top:20px}
.scs .wd-list{display:flex;flex-direction:column;gap:8px}
.scs .wd-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border:2px solid var(--stage-line);background:var(--stage-row)}
.scs .wd-row.on{border-color:var(--w);background:color-mix(in srgb,var(--w) 10%,transparent)}
.scs .wd-row.loose{opacity:.7}
.scs .wd-row b{flex:1;min-width:0;font:700 var(--text-control) var(--font-big);letter-spacing:.06em;text-transform:uppercase;color:var(--stage-card);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scs .wd-row small{font:var(--text-body) var(--font-big);color:var(--stage-soft)}
.scs .wd-name{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.scs .wd-sw{display:flex;flex:none;border:1px solid var(--stage-black)}
.scs .wd-sw i{display:block;width:10px;height:24px}
.scs .wd-foot{margin:0 20px;padding-top:12px;border-top:1px solid var(--stage-seam);font:var(--text-body)/1.6 var(--font-big);color:var(--stage-soft)}
.scs .wd-foot p{margin:0}
`;
