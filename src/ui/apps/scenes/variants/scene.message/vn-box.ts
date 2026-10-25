/** scene.message vn-box (Encore): a bracketed dialogue box, a name plate on its top edge, the turn number as a slot tag, a hard-stepped reveal on the newest reply. */
import { brackets, variantCss } from "../../../../_shared/variant-css";
import { seeThrough } from "../../bubble-opacity";

export default variantCss("scene.message", "vn-box", `
& .body{position:relative;padding-top:.85rem}
& .spk,& .msg.user .spk{position:absolute;top:0;left:1rem;z-index:2;margin:0;padding:.1rem .9rem;background:var(--stage-panel);border:var(--bk-frame-w) solid var(--bk-line-strong);font-family:var(--font-fancy);font-size:.95rem;font-weight:600;letter-spacing:.12em;line-height:1.7;text-align:left}
& .msg.user .spk{left:auto;right:1rem}
& .badge,& .msg.user .badge{position:absolute;top:.2rem;right:0;float:none;border:0;background:none;box-shadow:none;padding:0 .25rem;font-size:.8125rem;color:var(--stage-mute)}
& .msg.user .badge{right:auto;left:0}
& .bub,& .msg.user .bub{position:relative;padding:1.5rem 1.4rem 1.1rem;background:${seeThrough("var(--stage-panel)")};border:var(--bk-frame-w) solid ${seeThrough("var(--bk-line-strong)")};border-radius:0}
& .bub::before{content:"";position:absolute;inset:5px;pointer-events:none;background:${brackets("var(--bk-line-strong)", ".7rem")}}
& .bub.live{border-color:var(--tone);box-shadow:none}
& .spk{color:color-mix(in srgb,var(--tone) 60%,var(--text))}
& .prose{font:400 1rem/1.7 var(--font-body);color:var(--text)}
& .prose q{color:color-mix(in srgb,var(--tone) 60%,var(--text))}
& .prose p+p{margin-top:.9rem}
& .caret{width:.6rem;height:1.05rem;vertical-align:-.2rem}
& .rb-list{margin-top:1.5rem}
& .acts{right:.75rem;bottom:auto;top:.45rem;background:var(--stage-panel);border:var(--bk-frame-w) solid var(--bk-line-strong);backdrop-filter:none}
@media (prefers-reduced-motion:no-preference){
& .msg.last .bub:not(.live) .prose{animation:scs-reveal calc(var(--bk-dur-slow)*3) steps(18,end) 1 both}
}
@keyframes scs-reveal{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
`, ".scs");
