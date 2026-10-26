/** scene.layout manuscript (Paper): one narrow page, a ruled left margin, the portrait as a small plate in the margin. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.layout", "manuscript", `
& .bgm{background:var(--stage-well)}
& .bgm::after{display:none}
& .scroll{padding:calc(5.5rem*var(--bk-density)) 2rem 9.5rem}
& .scroll>*{max-width:40rem;margin-left:auto;margin-right:auto}
& .scroll{background:linear-gradient(90deg,transparent calc(50% - 21rem),var(--bk-line) calc(50% - 21rem),var(--bk-line) calc(50% - 21rem + var(--bk-frame-w)),transparent calc(50% - 21rem + var(--bk-frame-w)))}
& .msg{display:block;position:relative;padding-left:3.75rem;margin-bottom:calc(2rem*var(--bk-density))}
& .por{position:absolute;left:0;top:.1rem;width:2.75rem;height:2.75rem;border-radius:0;box-shadow:none;border:var(--bk-frame-w) solid var(--bk-line)}
& .por .ini{font-size:1.2rem;color:var(--text-soft)}
& .msg.user .por{border-radius:0}
& .body,& .msg.user .body{padding:0}
& .msg.user .spk{text-align:left}
& .msg.user .badge{float:none}
& .sh .back{color:var(--text)}
& [data-part="scene.paused"] [data-control="tile"],& [data-part="scene.paused"] [data-control="tile"] [data-slot="caption"]{color:var(--text)}
@container (max-width:1023px){
& .scroll{padding:4rem 1rem 7rem;background:none}
& .msg{padding-left:3rem}
& .por,& .msg.user .por{left:0;width:2.25rem;height:2.25rem;border-radius:0}
}
`, ".scs");
