/** scene.layout chat-thread (GirliePop): a centered thread, a sticker avatar at the foot of each turn, flat backdrop. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.layout", "chat-thread", `
& .bgm{background:var(--stage-well)}
& .bgm::after{display:none}
& .scroll{padding:calc(5rem*var(--bk-density)) 1.5rem 9.5rem}
& .scroll>*{max-width:44rem;margin-left:auto;margin-right:auto}
& .msg{align-items:flex-end;gap:.75rem;margin-bottom:calc(1.4rem*var(--bk-density))}
& .por{position:static;width:3.5rem;height:3.5rem;border-radius:0;box-shadow:var(--bk-frame-shadow-x) var(--bk-frame-shadow-y) 0 var(--stage-black);border:var(--bk-frame-w) solid var(--bk-line-strong)}
& .por .ini{font-size:1.5rem}
& .msg.user .por{border-radius:0}
& .body,& .msg.user .body{padding:0;max-width:34rem;flex:0 1 auto}
& .msg.user .body{margin-left:auto}
@container (max-width:1023px){
& .scroll{padding:4rem .75rem 7rem}
& .por,& .msg.user .por{width:2.75rem;height:2.75rem;border-radius:0}
}
`, ".scs");
