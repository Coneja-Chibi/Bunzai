/** ui.controls sticker (GirliePop): thick slab frames and a stamp shadow on every field and Stamp, friendly bold labels, a chunky focus ring. */
import { variantCss } from "../../variant-css";

export default variantCss("ui.controls", "sticker", `
&{--stamp-x:var(--bk-frame-shadow-x);--stamp-y:var(--bk-frame-shadow-y);--stamp-shadow:var(--bk-line-strong)}
& :where(.stamp):not(.host-protected *){border-width:var(--bk-frame-w);font-family:var(--font-big);font-weight:700}
& :where(input:not([type=checkbox],[type=radio],[type=range],[type=file],[type=color]),select,textarea):not(.host-protected *){border-width:var(--bk-frame-w);box-shadow:var(--bk-frame-shadow-x) var(--bk-frame-shadow-y) 0 var(--bk-line-strong)}
& :where(button,input,select,textarea,a):focus-visible:not(.host-protected *){outline:3px solid var(--bk-focus-color);outline-offset:3px}
`);
