/**
 * The Preset tab's Choices row, its first-time offer and the guided walkthrough (RoleCall's ChoiceGroupsSection and ChoiceWalkthroughModal),
 * on the Prompting wing's look. Colors come from the theme tokens; corners are square.
 */
export const CHOICES_STYLE = `
.scs .ch-row-bar{display:flex;align-items:center;gap:10px;margin:0 20px 12px;padding:8px 12px;border:1px solid var(--w);background:color-mix(in srgb,var(--w) 8%,transparent);color:var(--w);flex-wrap:wrap}
.scs .ch-row-bar>div{min-width:0;display:flex;flex-direction:column}
.scs .ch-row-bar b{font:600 var(--text-control) var(--font-big)}
.scs .ch-row-bar small{font:var(--text-body) var(--font-big);color:var(--stage-text-dim)}
.scs .ch-row-bar .pg-fold{margin:0 0 0 auto}
.scs .ch-fail{flex-basis:100%;font:var(--text-body) var(--font-big);color:var(--stage-danger-text)}
.ch-modal,.ch-offer{width:36rem;max-width:100%;max-height:85vh;display:flex;flex-direction:column;background:var(--face);box-shadow:0 0 0 1px var(--edge),var(--stamp-x) var(--stamp-y) 0 0 var(--stamp-shadow);border-top:4px solid var(--accent);font-family:var(--font-body)}
.ch-offer{width:24rem;padding:22px}
.ch-offer .eb,.ch-body .eb{font-size:var(--text-meta);font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--accent)}
.ch-offer h3,.ch-body h3{margin:6px 0 0;font:900 1.4rem/1 var(--font-fancy);letter-spacing:.04em;text-transform:uppercase;overflow-wrap:anywhere}
.ch-offer p{margin:10px 0 0;font-size:var(--text-body);line-height:1.5}
.ch-offer .row{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}
.ch-offer .no,.ch-offer .yes{padding:8px 14px;border:2px solid var(--accent);font:700 var(--text-control) var(--font-big);letter-spacing:.06em;text-transform:uppercase;cursor:pointer;background:none;color:var(--accent)}
.ch-offer .yes{background:var(--accent);color:var(--face)}
.ch-head,.ch-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 18px;flex:none}
.ch-head{border-bottom:1px solid var(--edge)}
.ch-foot{border-top:1px solid var(--edge)}
.ch-dots{display:flex;gap:8px}
.ch-dots span{width:12px;height:12px;background:var(--edge)}
.ch-dots .seen{background:color-mix(in srgb,var(--accent) 50%,transparent)}
.ch-dots .now{background:var(--accent)}
.ch-body{flex:1;overflow-y:auto;padding:18px}
.ch-desc,.ch-prose{margin:10px 0 0;font-size:var(--text-body);line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
.ch-step{margin-top:18px}
.ch-more{margin-top:8px}
.ch-more button{padding:0;border:0;background:none;font:700 var(--text-meta) var(--font-big);letter-spacing:.14em;text-transform:uppercase;color:var(--accent);cursor:pointer}
.ch-more p{margin:8px 0 0;padding:8px 12px;max-height:12rem;overflow-y:auto;border:2px solid var(--edge);font-size:var(--text-body);line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
.ch-opts{display:grid;gap:8px}
.ch-opts.two{grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))}
.ch-optwrap{position:relative}
.ch-opt{display:block;width:100%;padding:12px 14px;text-align:left;border:2px solid var(--edge);background:none;color:inherit;cursor:pointer;font-family:inherit}
.ch-opt.eye{padding-right:44px}
.ch-opt:hover{border-color:var(--accent)}
.ch-opt.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent)}
.ch-optrow{display:flex;align-items:center;gap:8px}
.ch-optrow b{font-size:var(--text-control);font-weight:600}
.ch-opt small{display:block;margin:4px 0 0 24px;font-size:var(--text-body);color:var(--stage-text-dim)}
.ch-box{width:16px;height:16px;flex:none;display:grid;place-items:center;border:2px solid var(--edge)}
.ch-box.round{border-radius:50%}
.ch-box.on{border-color:var(--accent);background:var(--accent);color:var(--face)}
.ch-eye{width:28px;height:28px;display:grid;place-items:center;border:2px solid var(--edge);background:none;color:var(--stage-text-dim);cursor:pointer}
.ch-eye.on,.ch-eye:hover{border-color:var(--accent);color:var(--accent)}
.ch-eye.corner{position:absolute;top:8px;right:8px}
.ch-peeks{margin-top:8px;display:flex;flex-direction:column;gap:8px}
.ch-peek{border:2px solid var(--edge)}
.ch-peek b{display:block;padding:8px 12px 0;font:700 var(--text-meta) var(--font-big);letter-spacing:.14em;text-transform:uppercase;color:var(--stage-text-dim)}
.ch-peek pre{margin:0;padding:8px 12px;max-height:10rem;overflow-y:auto;font:var(--text-control)/1.5 var(--font-mono);white-space:pre-wrap;overflow-wrap:anywhere}
.ch-peekrow{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:var(--text-body);color:var(--stage-text-dim)}
.ch-toggle{display:flex;align-items:center;justify-content:space-between;width:100%;padding:14px;border:2px solid var(--edge);background:none;color:inherit;cursor:pointer;font:700 var(--text-control) var(--font-big);letter-spacing:.1em;text-transform:uppercase}
.ch-toggle[aria-checked=true]{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent)}
.ch-input{width:100%;box-sizing:border-box;padding:12px 14px;border:2px solid var(--edge);background:var(--stage-black);color:inherit;font:var(--text-control) var(--font-body);outline:none}
.ch-input:focus{border-color:var(--accent)}
.ch-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.ch-hint{margin:8px 0 0;font-size:var(--text-body);color:var(--stage-mute)}
.ch-sum{margin-top:16px;display:flex;flex-direction:column;gap:8px}
.ch-row{display:flex;justify-content:space-between;gap:12px;padding:12px 14px;border:2px solid var(--edge)}
.ch-row b{display:block;font:700 var(--text-meta) var(--font-big);letter-spacing:.14em;text-transform:uppercase;color:var(--stage-text-dim)}
.ch-row span{display:block;margin-top:2px;font-size:var(--text-control)}
.ch-row small{color:var(--stage-mute)}
.ch-row button{flex:none;align-self:flex-start;border:0;background:none;font:700 var(--text-meta) var(--font-big);letter-spacing:.14em;text-transform:uppercase;color:var(--accent);cursor:pointer}
.ch-left,.ch-right{display:flex;align-items:center;gap:12px}
.ch-skip{border:0;background:none;font:600 var(--text-meta) var(--font-big);letter-spacing:.08em;text-transform:uppercase;color:var(--stage-mute);cursor:pointer}
.ch-need{font:700 var(--text-meta) var(--font-big);letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
.ch-btn{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border:2px solid var(--accent);background:none;color:var(--accent);font:700 var(--text-control) var(--font-big);letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
.ch-btn.solid{background:var(--accent);color:var(--face)}
.ch-chip{padding:5px 10px;border:1px solid var(--edge);background:none;font:var(--text-control) var(--font-big);color:inherit;cursor:pointer}
.ch-chip.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent)}
.ch-x{width:28px;height:28px;display:grid;place-items:center;border:0;background:none;color:inherit;cursor:pointer}
.ch-btn:disabled{opacity:.5;cursor:default}
`;
