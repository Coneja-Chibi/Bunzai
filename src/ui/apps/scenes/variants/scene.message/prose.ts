/** scene.message prose (Theater): no box, the speaker in small caps over open prose, actions as a quiet line under the text. */
import { variantCss } from "../../../../_shared/variant-css";

export default variantCss("scene.message", "prose", `
& .bub,& .msg.user .bub{background:none;border:0;padding:0;border-radius:0}
& .bub.live{box-shadow:none;border:0}
& .spk{color:color-mix(in srgb,var(--tone) 60%,var(--text));font-family:var(--font-fancy);font-variant-caps:all-small-caps;font-size:1.2rem;font-weight:500;letter-spacing:.16em;text-transform:none;margin:0 0 .35rem}
& .badge{border:0;background:none;box-shadow:none;padding:0;margin-right:.6rem;float:left;line-height:1.9;color:var(--stage-mute)}
& .msg.user .badge{float:left}
& .prose{font:400 1.0625rem/1.8 var(--font-body);color:var(--text)}
& .prose p+p{margin-top:1.1rem}
& .prose em{color:var(--text-soft)}
& .prose q{color:color-mix(in srgb,var(--tone) 60%,var(--text))}
& .acts{right:0;bottom:auto;top:-2.2rem;padding:0;background:none;border:0;backdrop-filter:none}
& .rb-list{margin-bottom:2.4rem}
`, ".scs");
