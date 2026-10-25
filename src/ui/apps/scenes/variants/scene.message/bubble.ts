/** scene.message bubble (GirliePop): a tinted slab bubble with a stamp shadow, a small name label, the turn number as a sticker. */
import { variantCss } from "../../../../_shared/variant-css";
import { seeThrough } from "../../bubble-opacity";

export default variantCss("scene.message", "bubble", `
& .spk{font-family:var(--font-big);font-size:.9rem;font-weight:700;letter-spacing:.04em;text-transform:none;margin:0 0 .3rem;color:var(--text)}
& .badge{border:var(--bk-frame-w) solid var(--bk-line-strong);background:var(--stage-row);box-shadow:none;margin-right:.4rem;color:var(--text-soft)}
& .bub{padding:.8rem 1.1rem;background:${seeThrough("color-mix(in srgb,var(--tone) 18%,var(--stage-panel))")};border:var(--bk-frame-w) solid ${seeThrough("var(--bk-line-strong)")};border-radius:0;box-shadow:var(--bk-frame-shadow-x) var(--bk-frame-shadow-y) 0 var(--tone)}
& .msg.user .bub{padding:.8rem 1.1rem;background:${seeThrough("color-mix(in srgb,var(--tone) 32%,var(--stage-panel))")}}
& .bub.live{border-color:var(--tone);box-shadow:var(--bk-frame-shadow-x) var(--bk-frame-shadow-y) 0 var(--tone)}
& .prose{font:400 1rem/1.55 var(--font-body);color:var(--text)}
& .prose q{color:inherit;font-weight:700}
& .prose p+p{margin-top:.75rem}
& .bub{min-width:min(21rem,70cqi)}
& .spk{max-width:max(9rem,calc(100% - 12rem));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
& .msg.user .spk{margin-left:auto}
& .msg.user .acts{right:auto;left:.4rem}
& .acts{right:.4rem;bottom:auto;top:-2.3rem;background:var(--stage-panel);border:var(--bk-frame-w) solid var(--bk-line-strong);backdrop-filter:none}
& .msg{margin-bottom:calc(1.9rem*var(--bk-density))}
& .rb-list{margin-bottom:2.4rem}
`, ".scs");
