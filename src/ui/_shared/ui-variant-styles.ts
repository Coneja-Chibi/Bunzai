/**
 * The shared ui.* surface-variant stylesheets (panel, meter, toast, empty, toolbar, section-header, tabs, label-type), imported once by the shell for their side
 * effect. Each is keyed on the root data-surface-<id> attribute and skips protected host UI. (ui.dialog and ui.icons
 * load beside their components.)
 */
import "./variants/ui.panel/gilt-frame.css";
import "./variants/ui.panel/bracket-frame.css";
import "./variants/ui.panel/slab-frame.css";
import "./variants/ui.panel/ruled-frame.css";
import "./variants/ui.meter/thin-rule.css";
import "./variants/ui.meter/segmented.css";
import "./variants/ui.meter/chunky-pill-bar.css";
import "./variants/ui.meter/ink-tally.css";
import "./variants/ui.toast/program-slip.css";
import "./variants/ui.toast/hud-ticker.css";
import "./variants/ui.toast/bubble.css";
import "./variants/ui.toast/footnote.css";
import "./variants/ui.empty/spotlight.css";
import "./variants/ui.empty/no-data-panel.css";
import "./variants/ui.empty/doodle.css";
import "./variants/ui.empty/blank-page.css";
import "./variants/ui.toolbar/playbill-bar.css";
import "./variants/ui.toolbar/hud-command-bar.css";
import "./variants/ui.toolbar/sticker-shelf.css";
import "./variants/ui.toolbar/margin-ruler.css";
import "./variants/ui.section-header/engraved-title.css";
import "./variants/ui.section-header/slot-header.css";
import "./variants/ui.section-header/banner-tag.css";
import "./variants/ui.section-header/chapter-heading.css";
import "./variants/ui.tabs/rule-tabs.css";
import "./variants/ui.tabs/menu-cursor.css";
import "./variants/ui.tabs/pill-row.css";
import "./variants/ui.tabs/underline-ink.css";
import "./variants/ui.label-type/small-caps-serif.css";
import "./variants/ui.label-type/caps-mono.css";
import "./variants/ui.label-type/rounded-sentence.css";
import "./variants/ui.label-type/italic-serif.css";
