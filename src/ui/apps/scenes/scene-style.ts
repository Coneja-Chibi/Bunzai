/** The scene page's styles: RoleCall's StandardLayout, from the approved wireframe (rc-port/chat.html). The default theme's wing shell (push-aside, rail, panel surface, hero, tabs) is scene-wing-style.ts. */
import { seeThrough } from "./bubble-opacity";
import { narrowRail } from "./narrow-rail";

export const SCENE_STYLE = `
.scs{--accent:var(--bk-scene-accent,var(--bk-accent));--accent-deep:var(--bk-scene-accent-deep,var(--bk-accent-deep));container-type:inline-size;position:relative;height:100%;min-height:0;overflow:hidden;background:var(--stage-well);color:var(--stage-soft);font-family:var(--font-big)}
.scs .bgm{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,color-mix(in srgb,var(--accent) 7%,transparent),transparent 60%),var(--stage-well)}
.scs .bgm::after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 50%,color-mix(in srgb,var(--stage-black) 65%,transparent))}
.scs .play{position:absolute;inset:0;transition:filter .3s}
.scs.paused .play{filter:blur(6px) brightness(.55);pointer-events:none}
.scs .chat{position:absolute;inset:0}
.scs .wslot{display:contents}
.scs :is(.wedge,.wback,.tipd,.wp-edge,.wp-depth,.wp-sheen){display:none}
.scs .sh{position:absolute;top:0;left:0;right:0;height:44px;z-index:35;display:flex;align-items:center;gap:10px;padding:0 18px;background:linear-gradient(var(--stage-black) 0%,color-mix(in srgb,var(--stage-black) 95%,transparent) 80%,color-mix(in srgb,var(--stage-black) 70%,transparent) 90%,transparent 100%)}
.scs .sh .back{width:26px;height:26px;display:grid;place-items:center;color:var(--stage-text-dim);border-radius:0;flex:none;background:none;border:0;cursor:pointer}
.scs .sh .nm{font-family:var(--font-fancy);font-weight:500;font-size:var(--text-control);letter-spacing:3px;text-transform:uppercase;color:var(--stage-soft);white-space:nowrap;flex:none}
.scs .sh .tag{font-style:italic;font-size: var(--text-meta);color:var(--stage-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;max-width:640px}
.scs .sh .branch .cnt{padding:0 4px;font-size:var(--text-meta);font-weight:600;line-height:14px;background:color-mix(in srgb,var(--accent) 25%,transparent)}
.scs .sh .branch{flex:none;display:flex;align-items:center;gap:6px;padding:4px 8px;font-size:var(--text-control);font-weight:500;color:var(--bk-scene-accent-text,var(--bk-role-brand-text));background:color-mix(in srgb,var(--accent) 15%,transparent);border:1px solid color-mix(in srgb,var(--accent) 20%,transparent)}
.scs .rail{position:absolute;top:80px;bottom:0;width:80px;z-index:50;display:flex;flex-direction:column;align-items:center;gap:32px;padding:32px 0 16px;opacity:.8;transition:width .5s,opacity .2s}
.scs .rail:hover{opacity:1}
.scs .rail.l{left:0}.scs .rail.r{right:0}
.scs .rail::before{content:"";position:absolute;inset:0;z-index:-1;background:color-mix(in srgb,var(--stage-black) 20%,transparent);backdrop-filter:blur(24px);-webkit-mask-image:linear-gradient(to bottom,transparent,var(--stage-black) 8%,var(--stage-black) 92%,transparent);mask-image:linear-gradient(to bottom,transparent,var(--stage-black) 8%,var(--stage-black) 92%,transparent)}
.scs .rail::after{content:"";position:absolute;top:0;bottom:0;width:1px;background:linear-gradient(to bottom,transparent,color-mix(in srgb,var(--accent) 40%,transparent),transparent);box-shadow:0 0 15px color-mix(in srgb,var(--accent) 30%,transparent)}
.scs .rail.l::after{right:0}.scs .rail.r::after{left:0}
.scs.open-l .rail.l,.scs.open-r .rail.r{width:50px}
.scs .wi{position:relative;width:40px;height:40px;display:grid;place-items:center;color:var(--stage-card);cursor:pointer;background:none;border:0;padding:0}
.scs .wi .lbl{display:none}
.scs .wi svg{position:relative;z-index:1;transition:transform .3s}
.scs .wi::before{content:"";position:absolute;inset:-20px;border-radius:0;background:radial-gradient(circle,color-mix(in srgb,var(--w) 25%,transparent) 0%,transparent 70%);opacity:0;transform:scale(.5);transition:all .5s}
.scs .wi:hover{color:var(--w)}.scs .wi:hover svg{transform:scale(1.1);filter:drop-shadow(0 0 8px var(--w))}.scs .wi:hover::before{opacity:.3;transform:scale(.75)}
.scs .wi.on{color:var(--stage-card)}.scs .wi.on svg{transform:scale(1.1);filter:drop-shadow(0 0 15px var(--w))}.scs .wi.on::before{opacity:1;transform:none}
.scs .tip{position:absolute;top:50%;width:260px;padding:12px 16px;background:var(--stage-panel);border:3px solid var(--stage-black);box-shadow:6px 6px 0 0 var(--w);opacity:0;transform:translateY(-60%);transition:opacity .2s,transform .2s;pointer-events:none;z-index:20;text-align:left}
.scs .rail.l .tip{left:60px}.scs .rail.r .tip{right:60px}
.scs .wi:hover .tip{opacity:1;transform:translateY(-50%)}
.scs .tip b{display:block;font-family:var(--font-fancy);font-weight:900;font-size:.95rem;letter-spacing:.04em;text-transform:uppercase;color:var(--w);text-shadow:3px 3px 0 var(--stage-black);line-height:1.05}
.scs .tip span{display:block;margin-top:6px;font-size:.76rem;font-weight:600;color:var(--stage-card);line-height:1.35}
.scs .scroll{position:absolute;top:0;bottom:0;left:80px;right:80px;overflow-y:auto;padding:96px 48px 150px 64px}
.scs .older{display:block;margin:0 auto 24px;padding:8px 14px;border:1px solid var(--stage-line);background:var(--stage-row);color:var(--stage-soft);font:600 var(--text-control) var(--font-big);cursor:pointer}
.scs .older:disabled{color:var(--stage-dim);cursor:default}
.scs .greet{max-width:768px;margin:0 auto 24px;padding:16px;border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);background:color-mix(in srgb,var(--stage-black) 20%,transparent);backdrop-filter:blur(8px);border-radius:0}
.scs .greet .hd{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:500;color:var(--stage-soft);margin-bottom:12px}
.scs .greet .hd svg{color:var(--stage-warn)}
.scs .greet .hd small{font-size: var(--text-body);font-weight:400;color:var(--stage-mute)}
.scs .dots{display:flex;gap:8px;margin-bottom:12px}
.scs .dots button{width:12px;height:12px;border-radius:0;background:var(--stage-line);border:0;padding:0;cursor:pointer}
.scs .dots button.on{background:var(--stage-warn);box-shadow:0 0 0 2px var(--stage-black),0 0 0 4px var(--stage-warn)}
.scs .greet .help{margin-top:8px;font-size: var(--text-body);color:var(--stage-mute)}
.scs .msg{display:flex;position:relative;margin-bottom:calc(40px*var(--bk-density,1))}
.scs .msg,.scs .cutline{content-visibility:auto;contain-intrinsic-size:auto 420px}
.scs .msg.user{flex-direction:row-reverse}
.scs .por{flex:none;width:260px;height:380px;position:sticky;top:60px;overflow:hidden;border-radius:0;box-shadow:0 0 20px color-mix(in srgb,var(--tone) 8%,transparent);background:linear-gradient(160deg,color-mix(in srgb,var(--tone) 55%,var(--stage-panel)),var(--stage-panel) 85%);display:grid;place-items:center}
.scs .por img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.scs .msg.user .por{border-radius:0;background:linear-gradient(170deg,color-mix(in srgb,var(--tone) 70%,var(--stage-panel)) 0%,color-mix(in srgb,var(--tone) 30%,var(--stage-panel)) 70%,var(--stage-panel))}
.scs .por .ini{position:relative;font-family:var(--font-fancy);font-size:34px;color:color-mix(in srgb,var(--stage-card) 55%,transparent)}
.scs .body{flex:1;min-width:0;padding-left:12px}
.scs .msg.user .body{padding-left:0;padding-right:12px}
.scs .badge{display:inline-flex;align-items:center;border:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent);background:color-mix(in srgb,var(--stage-black) 45%,transparent);padding:2px 6px;font-family:var(--font-mono);font-size: var(--text-meta);line-height:1;color:var(--stage-soft);box-shadow:2px 2px 0 var(--stage-black);border-radius:0}
.scs .msg.user .badge{float:right}
.scs .spk{clear:both;font-family:var(--font-fancy);font-weight:600;font-size:19px;letter-spacing:3px;text-transform:uppercase;color:var(--tone);line-height:1.5;margin:4px 0 6px}
.scs .msg.user .spk{text-align:right}
.scs .bub{position:relative;background:${seeThrough("var(--stage-black)", 55)};border:1px solid ${seeThrough("var(--stage-card)", 8)};border-radius:0;padding:14px 18px}
.scs .msg.user .bub{padding:12px 16px}
.scs .prose{font:400 16px/1.6 var(--font-body);color:color-mix(in srgb,var(--stage-card) 95%,transparent);white-space:normal}
.scs .prose{position:relative;isolation:isolate;contain:paint;overflow-wrap:anywhere}
.scs .prose .blk+.blk{margin-top:20px}.scs .prose p{margin:0}.scs .prose p+p{margin-top:20px}
.scs .prose q{quotes:'"' '"';color:var(--tone)}
.scs .prose h1,.scs .prose h2,.scs .prose h3{margin:0;font-family:var(--font-fancy);font-weight:600;line-height:1.3}
.scs .prose h1{font-size:1.35em}.scs .prose h2{font-size:1.2em}.scs .prose h3{font-size:1.05em}
.scs .prose ul,.scs .prose ol{margin:0;padding-left:1.4em}.scs .prose li+li{margin-top:4px}
.scs .prose blockquote{margin:0;padding:2px 0 2px 14px;border-left:3px solid var(--stage-line);font-style:italic}
.scs .prose code{font-family:var(--font-mono,monospace);font-size:.9em;padding:1px 5px;background:var(--stage-well);border:1px solid var(--stage-line)}
.scs .prose pre{margin:0;padding:10px 12px;overflow-x:auto;background:var(--stage-well);border:1px solid var(--stage-line);white-space:pre}
.scs .prose pre code{padding:0;border:0;background:none;font-size:.88em}
.scs .prose hr{border:0;border-top:1px solid var(--stage-line);margin:0}
.scs .prose a{color:var(--tone);text-decoration:underline}.scs .prose a:hover{text-decoration:none}
.scs .prose .custom-deadlink{text-decoration:underline dotted}.scs .prose .custom-blockedmedia{font-size:.85em;opacity:.7;border:1px dashed var(--stage-line);padding:1px 6px}
.scs .prose img{max-width:100%;height:auto}
.scs .prose table{border-collapse:collapse;max-width:100%;display:block;overflow-x:auto}.scs .prose :is(td,th){padding:4px 8px;border:1px solid var(--stage-line)}
.scs .prose details{border:1px solid var(--stage-line);padding:6px 10px}.scs .prose summary{cursor:pointer}
.scs .bub textarea{width:100%;min-height:120px;resize:vertical;background:var(--stage-well);color:var(--stage-card);border:1px solid var(--stage-line);padding:8px 10px;font:16px/1.6 var(--font-big)}
.scs .editrow{margin-top:8px;display:flex;justify-content:flex-end;gap:8px}
.scs .editrow button{padding:6px 14px;border:1px solid var(--stage-line);background:var(--stage-row);color:var(--stage-card);font: 600 var(--text-control) var(--font-big);cursor:pointer}
.scs .editrow .save{background:var(--accent);border-color:var(--accent);color:var(--stage-ink)}
.scs .acts{position:absolute;right:6px;bottom:6px;z-index:20;display:flex;gap:4px;padding:4px;border-radius:0;background:color-mix(in srgb,var(--stage-black) 55%,transparent);border:1px solid color-mix(in srgb,var(--stage-card) 8%,transparent);backdrop-filter:blur(4px);opacity:0;transition:opacity .3s}
.scs .msg:hover .acts,.scs .acts:focus-within{opacity:1}
.scs .acts button{width:28px;height:28px;display:grid;place-items:center;border:0;background:none;color:var(--tone);cursor:pointer;border-radius:0}
.scs .msg.hid .por,.scs .msg.hid .bub{opacity:.5}.scs .hidtag{display:inline-flex;align-items:center;gap:4px;margin-left:8px;font-size:var(--text-meta);color:var(--stage-warn)}.scs .acts .hide.on{color:var(--stage-warn)}
.scs .acts button:hover{background:color-mix(in srgb,var(--stage-card) 8%,transparent)}
.scs .dockbar{position:absolute;left:0;right:0;bottom:0;z-index:40;padding:12px 48px;pointer-events:none}
.scs .cap{pointer-events:auto;max-width:880px;margin:0 auto;display:flex;align-items:flex-end;gap:8px;padding:12px 16px;border-radius:0;background:color-mix(in srgb,var(--stage-floor) 50%,transparent);backdrop-filter:blur(20px);border:1px solid color-mix(in srgb,var(--stage-card) 6%,transparent);box-shadow:0 8px 32px color-mix(in srgb,var(--stage-black) 40%,transparent)}
.scs .cap textarea{flex:1;min-width:0;align-self:center;resize:none;max-height:200px;background:none;border:0;outline:0;font:14px/20px var(--font-big);color:var(--stage-card)}
.scs .cap textarea::placeholder{color:var(--stage-mute);opacity:1}
.scs .cap .send{width:32px;height:32px;flex:none;display:grid;place-items:center;border-radius:0;border:0;background:color-mix(in srgb,var(--accent) 15%,transparent);color:var(--bk-scene-accent-text,var(--bk-role-brand-text));cursor:pointer}
.scs .cap .send:disabled{color:var(--stage-dim);cursor:default}
.scs .paused-mark{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:45;text-align:center;cursor:pointer;background:none;border:0}
.scs.open-l .paused-mark{left:78%}.scs.open-r .paused-mark{left:27%}
.scs .paused-mark .sq{width:64px;height:64px;margin:0 auto;display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--accent) 35%,transparent);background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--bk-scene-accent-text,var(--bk-role-brand-text))}
.scs .paused-mark small{display:block;margin-top:16px;font-family:var(--font-mono);font-size: var(--text-body);letter-spacing:.3em;color:var(--bk-scene-accent-text,var(--bk-role-brand-text))}
.scs .wing-panel{position:absolute;top:0;bottom:0;z-index:48;display:flex;flex-direction:column;background:var(--stage-well);color:var(--stage-soft)}
.scs .wing-panel.l{left:0;width:min(1000px,56%);padding-left:50px;border-right:1px solid color-mix(in srgb,var(--stage-card) 6%,transparent)}
.scs .wing-panel.r{right:0;width:min(830px,46%);padding-right:50px;border-left:1px solid color-mix(in srgb,var(--stage-card) 6%,transparent)}
.scs .fold{padding:12px 16px;border-bottom:1px solid color-mix(in srgb,var(--stage-card) 10%,transparent)}
.scs .crumb{display:flex;gap:8px;font-size: var(--text-meta);font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--stage-mute)}
.scs .crumb b{color:var(--stage-card);font-weight:600}.scs .crumb i{font-style:normal;color:var(--stage-mute)}
.scs .wbody{flex:1;min-height:0;overflow-y:auto;padding:20px 20px 24px;display:flex;flex-direction:column;gap:20px}
.scs .hero{position:relative;border:1px solid color-mix(in srgb,var(--w) 35%,transparent);padding:24px;box-shadow:6px 6px 0 0 color-mix(in srgb,var(--w) 12%,transparent);background:radial-gradient(ellipse at top left,color-mix(in srgb,var(--w) 12%,transparent),transparent 55%),linear-gradient(135deg,var(--stage-row),var(--stage-well));display:flex;gap:16px;align-items:flex-start}
.scs .hero .hi{width:48px;height:48px;flex:none;display:grid;place-items:center;border:2px solid color-mix(in srgb,var(--w) 70%,transparent);background:var(--stage-black);color:color-mix(in srgb,var(--w) 40%,var(--text))}
.scs .hero .eb{font-size: var(--text-meta);font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:var(--w)}
.scs .hero h2{margin:8px 0 0;font-weight:900;font-size:2rem;line-height:.95;letter-spacing:.05em;text-transform:uppercase;color:var(--stage-card);text-shadow:3px 3px 0 var(--stage-black)}
.scs .hero p{margin:10px 0 0;max-width:42rem;font-size: var(--text-body);line-height:1.6;color:var(--stage-soft)}
.scs .dcard{position:relative;padding:20px;background:linear-gradient(170deg,color-mix(in srgb,var(--deck-character) 40%,var(--stage-panel)),var(--stage-panel) 80%)}
.scs .dcard.persona{background:linear-gradient(170deg,color-mix(in srgb,var(--deck-persona) 40%,var(--stage-panel)),var(--stage-panel) 80%)}
.scs .dcard .np{display:inline-block;font-size: var(--text-meta);font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--deck-lorebook);background:color-mix(in srgb,var(--deck-lorebook) 15%,transparent);border:1px solid color-mix(in srgb,var(--deck-lorebook) 50%,transparent);padding:3px 8px}
.scs .dcard h3{margin:10px 0 0;font-weight:800;font-size:24px;color:var(--stage-card)}
.scs .dcard p{margin:6px 0 0;font-size: var(--text-body);line-height:1.45;color:var(--stage-soft)}
.scs .quiet{position:absolute;inset:0;display:grid;place-items:center;padding:24px;text-align:center;color:var(--stage-text-dim)}
.scs .quiet>div{max-width:30rem;padding:24px;background:var(--stage-panel);border:1px solid var(--edge)}
.scs .quiet b{font-family:var(--font-fancy);font-size:var(--text-control);letter-spacing:.12em;text-transform:uppercase;color:var(--stage-card)}
.scs .quiet p{margin:10px 0 0;font-size:var(--text-body);color:var(--stage-soft)}
.scs .quiet .qacts{display:flex;justify-content:center;gap:12px;margin-top:18px}
@container (max-width:1023px){
.scs .scroll{left:0;right:0;padding:60px 12px 110px}
.scs .sh{padding:0 10px}.scs .sh .tag{display:none}.scs .sh .nm{overflow:hidden;text-overflow:ellipsis;min-width:0;flex:0 1 auto}
.scs .por{width:88px;height:118px;border-radius:0}
.scs .msg.user .por{border-radius:0}
.scs .spk{font-size:15px;letter-spacing:2px}
.scs .prose{font-size:var(--text-body);line-height:27px;font-weight:500}
.scs .bub{padding:12px 14px}
.scs .dockbar{padding:12px}
.scs .wing-panel.l,.scs .wing-panel.r,.scs .wing-panel.l.world-wing,.scs .wing-panel.r.ai-wing,.scs .wing-panel.r.stage-wing{width:100%;padding:0}
.scs.open-l .paused-mark,.scs.open-r .paused-mark{display:none}
${narrowRail(".scs")}}
`;
