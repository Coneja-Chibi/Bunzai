/** scene.message screenplay (Paper): the speaker in capitals, dialogue in a centered column, the turn number in the margin as a scene mark. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.message", "screenplay", `
& .spk,& .msg.user .spk{text-align:center;text-transform:uppercase;letter-spacing:.1em;font-family:var(--font-mono);font-size:.9375rem;font-weight:600;color:var(--text);margin:.25rem 0 .35rem}
& .badge,& .msg.user .badge{float:none;position:absolute;top:.35rem;right:0;margin:0;border:0;background:none;box-shadow:none;padding:0;font-size:.8125rem;color:var(--text-dim)}
& .bub,& .msg.user .bub{background:none;border:0;padding:0;border-radius:0}
& .bub.live{box-shadow:none;border:0}
& .prose{font:400 1.0625rem/1.75 var(--font-body);max-width:31rem;margin:0 auto;color:var(--text)}
& .prose q{color:inherit}
& .prose em{color:var(--text-soft)}
& .prose p+p{margin-top:1rem}
& .acts{position:static;display:flex;justify-content:center;margin-top:.6rem;padding:0;background:none;border:0;backdrop-filter:none}
& .acts button{color:var(--text-dim)}
& .meta{justify-content:center}
@container (max-width:1023px){
& .badge,& .msg.user .badge{position:static;margin:0 0 .15rem;text-align:right}
}
`, ".scs");
