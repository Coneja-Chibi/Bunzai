/** ui.controls ink (Paper): hairline frames, fields as a ruled underline, small capitals on the Stamp, a dotted focus ring. */
import { variantCss } from "../../variant-css";

export default variantCss("ui.controls", "ink", `
&{--stamp-x:0px;--stamp-y:0px}
& :where([data-control="button"],[data-control="icon"]):not(.host-protected *){--sx:var(--stamp-x);--sy:var(--stamp-y);--sh:var(--stamp-shadow);border-width:var(--bk-frame-w);font-variant-caps:all-small-caps;letter-spacing:.06em;font-weight:600}
& :where(input:not([type=checkbox],[type=radio],[type=range],[type=file],[type=color]),select,textarea):not(.host-protected *){border-width:0 0 var(--bk-frame-w) 0;box-shadow:none}
& :where(button,input,select,textarea,a):focus-visible:not(.host-protected *){outline:2px dotted var(--bk-focus-color);outline-offset:3px}
`);
