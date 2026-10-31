/** scene.layout manuscript (Paper): a wide reading page with a separate portrait column. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.layout", "manuscript", `
& .bgm{background:var(--stage-well)}
& .bgm::after{display:none}
& .scroll{padding:calc(5.5rem*var(--bk-density)) 2rem 9.5rem}
& .scroll>*{max-width:72rem;margin-left:auto;margin-right:auto}
& .msg{display:flex;align-items:flex-start;gap:1.25rem;position:relative;padding-left:0;margin-bottom:calc(2rem*var(--bk-density))}
& .msg>.pw{position:static;flex:0 0 160px;width:160px;max-width:160px;height:224px}
& .msg>.pw .por{position:relative;left:auto;top:auto;width:100%;height:100%;border-radius:0;box-shadow:none;border:var(--bk-frame-w) solid var(--bk-line)}
& .por .ini{font-size:1.2rem;color:var(--text-soft)}
& .msg.user .por{border-radius:0}
& .body,& .msg.user .body{flex:1;min-width:0;max-width:none;padding:0}
& .spk{overflow-wrap:anywhere}
& .msg.user .spk{text-align:left}
& .msg.user .badge{float:none}
& .sh .back{color:var(--text)}
& [data-part="scene.paused"] [data-control="tile"],& [data-part="scene.paused"] [data-control="tile"] [data-slot="caption"]{color:var(--text)}
@container (max-width:1023px){
& .scroll{padding:4rem 1rem 7rem;background:none}
& .msg{padding-left:0;gap:1rem}
}
@container (max-width:600px){
& .msg{gap:.75rem}
& .msg>.pw{flex-basis:80px;width:80px;max-width:80px;height:112px}
}
`, ".scs");
