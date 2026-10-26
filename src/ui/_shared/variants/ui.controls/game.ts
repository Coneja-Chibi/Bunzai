/** ui.controls game (Encore): two-pixel frames, a hard edge under each key, mono capitals on the buttons, a bold focus ring. */
import { variantCss } from "../../variant-css";

export default variantCss("ui.controls", "game", `
&{--stamp-x:0px;--stamp-y:2px;--stamp-shadow:var(--bk-line-strong)}
& :where([data-control="button"],[data-control="icon"]):not(.host-protected *){--sx:var(--stamp-x);--sy:var(--stamp-y);--sh:var(--stamp-shadow);border-width:2px;text-transform:uppercase;letter-spacing:.08em;font-family:var(--font-mono);font-weight:700}
& :where(input:not([type=checkbox],[type=radio],[type=range],[type=file],[type=color]),select,textarea):not(.host-protected *){border-width:2px;box-shadow:inset 0 0 0 1px var(--bk-line-track)}
& :where(button,input,select,textarea,a):focus-visible:not(.host-protected *){outline:2px solid var(--bk-focus-color);outline-offset:2px}
`);
