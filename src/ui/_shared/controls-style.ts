/**
 * The ui.controls variants are global (every control in every app), so the shell paints them once into the
 * head instead of one app mounting them. Each rule is scoped to its own root attribute and to elements outside
 * `.host-protected`, so the lock, recovery words, Kit Gate and the theme manager never take a theme's controls.
 */
import ink from "./variants/ui.controls/ink";
import game from "./variants/ui.controls/game";
import quiet from "./variants/ui.controls/quiet";
import sticker from "./variants/ui.controls/sticker";

export const CONTROLS_STYLE = [quiet, game, sticker, ink].join("\n");

/** Idempotent: the one <style id="bk-controls"> in the head. */
export function installControlsStyle(): void {
  const head = typeof document === "undefined" ? undefined : document.head;
  if (!head || head.querySelector("#bk-controls")) return;
  const style = document.createElement("style");
  style.id = "bk-controls";
  style.textContent = CONTROLS_STYLE;
  head.append(style);
}
