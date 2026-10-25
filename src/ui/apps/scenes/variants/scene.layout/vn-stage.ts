/** scene.layout vn-stage (Encore): a framed portrait slot beside each box, dense grid, hatch backdrop (design/system scene variant B). */
import { brackets, variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.layout", "vn-stage", `
& .bgm{background:repeating-linear-gradient(0deg,transparent 0 23px,color-mix(in srgb,var(--bk-line-track) 55%,transparent) 23px 24px),var(--stage-well)}
& .bgm::after{display:none}
& .scroll{padding:calc(4.5rem*var(--bk-density)) 2rem 9.5rem}
& .scroll>*{max-width:62rem;margin-left:auto;margin-right:auto}
& .msg{display:grid;grid-template-columns:13rem minmax(0,1fr);gap:0 1.25rem;align-items:start;margin-bottom:calc(1.5rem*var(--bk-density))}
& .msg.user{grid-template-columns:minmax(0,1fr) 7rem}
& .msg.user .por{order:2}
& .por{position:sticky;top:3.5rem;width:100%;height:auto;aspect-ratio:2/3;border-radius:0;box-shadow:none;border:var(--bk-frame-w) solid var(--bk-line-strong)}
& .por::after{content:"";position:absolute;inset:6px;pointer-events:none;background:${brackets("var(--bk-line-strong)")}}
& .msg.user .por{border-radius:0}
& .body,& .msg.user .body{padding:0}
@container (max-width:1023px){
& .scroll{padding:4rem .75rem 7rem}
& .msg{grid-template-columns:5.5rem minmax(0,1fr)}
& .msg.user{grid-template-columns:minmax(0,1fr) 4.5rem}
& .por{width:100%;height:auto;border-radius:0}
}
`, ".scs");
