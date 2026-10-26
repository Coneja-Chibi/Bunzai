/**
 * The scene tools' styles, from RoleCall's own components (approved wireframes rc-port/scene-*.html,
 * built from design/wireframes/rc-port/rc-parts.css): EditableMessage's delete dropdown,
 * MessageActionOverflow's menu, BranchIndicator's Scene Takes, the ForkSceneModal sheet, the Library's
 * Update available badge, and ForkSceneModal's amber notice. The restore line has no RC original; it
 * borrows the notice's shape in the danger tone.
 */
export const TOOLS_STYLE = `
.scs .hold{position:relative;display:inline-flex}
.scs .acts.held{opacity:1}
/* Touch reach (RoleCall VVS-243, under 1024 px: touch-actions-core.ts): the bar sits under the text, a tap on the message opens it, no fade, 44 px targets. */
@container (max-width:1023.98px){
.scs .msg .acts{position:static;flex-wrap:wrap;margin-top:8px;opacity:0;pointer-events:none;transition:none;backdrop-filter:none}
.scs .msg:hover .acts{pointer-events:auto}
@media (hover:none){.scs .msg:hover .acts{opacity:0;pointer-events:none}}
.scs .msg.tap .acts,.scs .msg .acts.held,.scs .msg .acts:focus-within{opacity:1;pointer-events:auto}
.scs .msg .acts :is([data-control="button"],[data-control="icon"]){min-width:44px;min-height:44px}
.scs .msg .acts .menu [role=menuitem]{width:100%;height:auto;min-height:44px}
}
.scs .dd{position:absolute;bottom:calc(100% + 8px);right:-6px;z-index:60;min-width:180px;padding:4px 0;background:var(--stage-row);border:1px solid var(--stage-seam);border-radius:0;box-shadow:0 20px 25px -5px color-mix(in srgb,var(--stage-black) 50%,transparent)}
.scs .menu{position:absolute;bottom:calc(100% + 8px);right:-40px;z-index:60;min-width:13rem;padding:4px 0;background:var(--stage-panel);border:3px solid var(--stage-black);box-shadow:5px 5px 0 0 var(--stage-black)}
.scs .sh [data-part="scene.takes.toggle"]{cursor:pointer;font-family:var(--font-big)}
.scs .takes{position:absolute;top:calc(100% + 6px);left:0;z-index:60;width:260px;overflow:hidden;background:color-mix(in srgb,var(--stage-panel) 98%,transparent);backdrop-filter:blur(24px);border:1px solid color-mix(in srgb,var(--stage-seam) 80%,transparent);border-radius:0;box-shadow:0 25px 50px -12px color-mix(in srgb,var(--stage-black) 60%,transparent)}
.scs .takes .hd{padding:8px 12px;border-bottom:1px solid color-mix(in srgb,var(--stage-seam) 50%,transparent);background:color-mix(in srgb,var(--stage-row) 30%,transparent)}
.scs .takes .hd b{display:flex;align-items:center;gap:6px;font-size: var(--text-meta);font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--stage-card)}
.scs .takes .hd small{display:block;margin-top:2px;font-size: var(--text-body);color:var(--stage-mute)}
.scs .takes .pad{padding:6px}
.scs .takes .pad.list{padding-top:0;max-height:min(50vh,480px);overflow-y:auto}
.scs .takes .sep{display:flex;align-items:center;gap:6px;padding:4px 12px;font-size: var(--text-meta);font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--stage-mute)}
.scs .takes .sep::before,.scs .takes .sep::after{content:"";flex:1;height:1px;background:color-mix(in srgb,var(--stage-seam) 50%,transparent)}
.scs .take{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:1px solid transparent;border-radius:0;background:none;color:inherit;text-align:left;cursor:pointer}
.scs .take:hover{background:color-mix(in srgb,var(--stage-row) 70%,transparent)}
.scs .take .ic{width:28px;height:28px;flex:none;display:grid;place-items:center;border-radius:0;background:color-mix(in srgb,var(--stage-seam) 60%,transparent);color:var(--stage-text-dim)}
.scs .take .tx{flex:1;min-width:0;display:block;padding:0;border:0;background:none;color:inherit;text-align:left;font:inherit;cursor:pointer}
.scs .take .tx input{width:100%;padding:2px 6px;background:var(--stage-row);border:1px solid var(--stage-line);border-radius:0;color:var(--stage-card);font:16px var(--font-big)}
.scs .take .chip{font-size: var(--text-control);font-weight:700;padding:2px 4px;border-radius:0;background:color-mix(in srgb,var(--stage-seam) 80%,transparent);color:var(--stage-soft);text-transform:uppercase}
.scs .take .dot{width:6px;height:6px;flex:none;border-radius:50%;background:var(--accent)}
.scs .take.cur{background:color-mix(in srgb,var(--stage-warn) 12%,transparent);border-color:color-mix(in srgb,var(--stage-warn) 30%,transparent)}
.scs .take.cur .ic{color:var(--stage-warn)}
.scs .takes .foot{border-top:1px solid color-mix(in srgb,var(--stage-seam) 50%,transparent);background:color-mix(in srgb,var(--stage-row) 20%,transparent);font-size: var(--text-meta);color:var(--stage-mute)}
.scs .takes .foot .hint{display:flex;align-items:center;gap:4px;padding:8px 12px}
.scs .take.sub{margin-left:16px;width:calc(100% - 16px)}
.scs .takes .foot .hint svg{color:color-mix(in srgb,var(--stage-warn) 70%,transparent)}
.scs .cutline{display:flex;align-items:center;gap:12px;max-width:1020px;margin:0 0 24px;padding:8px 12px;border-left:4px solid var(--stage-danger-text);background:color-mix(in srgb,var(--stage-danger-text) 8%,transparent);font:var(--text-body)/1.5rem var(--font-big);color:var(--stage-soft)}
.scs .cutline svg{color:var(--stage-danger-text);flex:none}
.scs .cutline small{color:var(--stage-mute);font-size:12px}
.scs .cutline .grow,.scs .notice .grow{flex:1}
.scs .cutline>:last-child,.scs .notice>:last-child{flex:none}
.scs .upd{flex:none;display:inline-flex}
.scs .dcard .upd{position:absolute;top:8px;left:8px;z-index:20}
.scs .notice{margin:0;padding:8px 12px;border-left:4px solid var(--stage-warn);background:color-mix(in srgb,var(--stage-warn) 10%,transparent);font:var(--text-body)/1.5rem var(--font-big);color:var(--stage-card)}
.scs .notice.row{display:flex;align-items:center;gap:12px}
.scs .notice.gone{border-left-color:var(--stage-mute);background:color-mix(in srgb,var(--stage-mute) 10%,transparent)}
.scn-sheet{width:36rem;max-width:100%;background:var(--stage-panel);color:var(--stage-card);border:3px solid var(--stage-black);box-shadow:7px 7px 0 0 var(--stage-black);font-family:var(--font-big)}
.scn-sheet.accent{border-top-color:var(--accent)}
.scn-sheet.gilt{border-top-color:var(--stage-warn)}
.scn-sheet .hd{padding:16px 20px;border-bottom:2px solid var(--stage-black);background:color-mix(in srgb,var(--stage-card) 5%,var(--stage-panel))}
.scn-sheet .hd .eb{display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size: var(--text-meta);font-weight:900;letter-spacing:.2em;text-transform:uppercase;color:var(--stage-danger-text)}
.scn-sheet.accent .hd .eb{color:var(--bk-scene-accent-text,var(--bk-role-brand-text))}
.scn-sheet.gilt .hd .eb{color:var(--stage-warn)}
.scn-sheet h2{margin:0;font-family:var(--font-fancy);font-weight:900;font-size:1.5rem;letter-spacing:.04em;text-transform:uppercase;color:var(--stage-card)}
.scn-sheet .hd p{margin:6px 0 0;font-size: var(--text-body);line-height:1.5rem;color:var(--stage-soft)}
.scn-sheet .bd{padding:20px;display:flex;flex-direction:column;gap:20px;font-size:14px;line-height:1.5rem;color:var(--stage-soft)}
.scn-sheet .bd p{margin:0}
.scn-sheet label{display:block;font-size:var(--text-control);font-weight:900;letter-spacing:.15em;text-transform:uppercase;color:var(--stage-soft)}
.scn-sheet label input{display:block;width:100%;margin-top:8px;padding:12px;border:2px solid var(--stage-black);background:var(--stage-sunken);font:16px var(--font-big);color:var(--stage-card);letter-spacing:0;text-transform:none}
.scn-sheet .box{padding:16px;border:2px solid var(--stage-black);background:var(--stage-row)}
.scn-sheet .box .t{margin-bottom:12px;font-size:var(--text-control);font-weight:900;letter-spacing:.15em;text-transform:uppercase;color:var(--stage-soft)}
.scn-sheet .box ul{margin:0;padding:0}
.scn-sheet .box li{display:flex;gap:8px;list-style:none;margin-top:8px}
.scn-sheet .box li::before{content:"\\25A0";color:var(--bk-scene-accent-text,var(--bk-role-brand-text))}
.scn-sheet.gilt .box li::before{color:var(--stage-warn)}
.scn-sheet .ft{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:12px;padding:16px 20px;border-top:2px solid var(--stage-black);background:color-mix(in srgb,var(--stage-card) 5%,var(--stage-panel))}
`;
