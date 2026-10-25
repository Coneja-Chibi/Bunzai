/** ui.controls quiet (Theater): hairline frames, no offset shadow, a thin focus ring; the shell Stamp lies flat. */
import { variantCss } from "../../variant-css";

export default variantCss("ui.controls", "quiet", `
&{--stamp-x:0px;--stamp-y:0px}
& :where(.stamp):not(.host-protected *){border-width:var(--bk-frame-w)}
& :where(input:not([type=checkbox],[type=radio],[type=range],[type=file],[type=color]),select,textarea):not(.host-protected *){border-width:var(--bk-frame-w);box-shadow:none}
& :where(button,input,select,textarea,a):focus-visible:not(.host-protected *){outline:var(--bk-frame-w) solid var(--bk-focus-color);outline-offset:2px}
`);
