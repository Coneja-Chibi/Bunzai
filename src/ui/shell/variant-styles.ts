/**
 * The shell's surface-variant stylesheets, imported for their side effect. Each file is keyed on the root
 * data-surface-<id> attribute the painter sets, so only the variant a theme picked applies. They are imported
 * here, not from the components, so the component catalog keeps listing each component's own classes.
 */
import "../_shared/ui-variant-styles";
import "./variants/shell.nav/playbill-rail.css";
import "./variants/shell.nav/hud-bar.css";
import "./variants/shell.nav/tab-bar.css";
import "./variants/shell.nav/index-rail.css";
import "./variants/shell.overlay/gilt-widgets.css";
import "./variants/shell.overlay/hud-widgets.css";
import "./variants/shell.overlay/sticker-widgets.css";
import "./variants/shell.overlay/ink-widgets.css";
import "./variants/shell.status/footer-line.css";
import "./variants/shell.status/hud-strip.css";
import "./variants/shell.status/chip.css";
import "./variants/shell.status/margin-note.css";
