/**
 * The user's accessibility choices, read from the studio settings and painted on the page root. One owner: the Settings app and the
 * Messenger You scope both read and write the same three keys through ctx.prefs, and the shell store paints them whenever settings change.
 * The CSS that answers them lives in theme/tokens.css (--ui-scale, [data-reduce-motion], [data-high-contrast]).
 */
import { SETTING_KEYS } from "../../studio/settings-shape";
import { highContrastOf, reduceMotionOf, UI_TEXT, uiTextSizeOf } from "../_shared/accessibility-prefs";

/** Paint the three choices on the root. Idempotent: an unchanged value touches nothing. */
export function paintAccessibility(settings: Readonly<Record<string, unknown>>, root: HTMLElement = document.documentElement): void {
  const scale = uiTextSizeOf(settings[SETTING_KEYS.uiTextSize]) / UI_TEXT.def;
  const want = scale === 1 ? "" : String(scale);
  if (root.style.getPropertyValue("--ui-scale") !== want) {
    if (want) root.style.setProperty("--ui-scale", want); else root.style.removeProperty("--ui-scale");
  }
  const flag = (name: string, on: boolean): void => {
    if ((root.getAttribute(name) !== null) === on) return;
    if (on) root.setAttribute(name, ""); else root.removeAttribute(name);
  };
  flag("data-reduce-motion", reduceMotionOf(settings[SETTING_KEYS.uiReduceMotion]));
  flag("data-high-contrast", highContrastOf(settings[SETTING_KEYS.uiHighContrast]));
}
