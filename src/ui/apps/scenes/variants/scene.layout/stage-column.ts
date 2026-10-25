/** scene.layout stage-column (Theater): one prose column on the stage, a small portrait beside each speaker, hairline rules between turns. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.layout", "stage-column", `
& .scroll{padding:calc(5.5rem*var(--bk-density)) 2rem 9.5rem}
& .scroll>*{max-width:46rem;margin-left:auto;margin-right:auto}
& .msg{display:block;position:relative;padding:0 0 calc(1.75rem*var(--bk-density)) 4.5rem;margin-bottom:calc(1.75rem*var(--bk-density));border-bottom:var(--bk-frame-w) solid var(--bk-line-track)}
& .msg.user{padding-left:4.5rem}
& .por{position:absolute;left:0;top:.2rem;width:3.25rem;height:3.25rem;border-radius:0;box-shadow:none;border:var(--bk-frame-w) solid var(--bk-line-strong)}
& .por .ini{font-size:1.4rem;color:var(--text-soft)}
& .msg.user .por{border-radius:0}
& .body,& .msg.user .body{padding:0}
& .msg.user .spk{text-align:left}
& .msg.user .badge{float:none}
& .bgm::after{display:none}
@container (max-width:1023px){
& .scroll{padding:4rem 1rem 7rem}
& .msg,& .msg.user{padding-left:3.5rem}
& .por,& .msg.user .por{width:2.75rem;height:2.75rem;border-radius:0}
}
`, ".scs");
