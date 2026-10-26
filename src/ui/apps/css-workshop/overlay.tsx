/** CSS Workshop overlay: escaped draft excerpt and its actual target, with editing owned by the workshop. */
import { Button } from "../../components/button";
import type { OverlayWidgetProps } from "../../app-contract";
import { OverlayWidget } from "../../components/overlay-widget";
import { asPrefString, DEFAULT_PACK_ID, PREF_DRAFT, PREF_PACK, STARTER_CSS } from "./prefs";

export function OverlayWidgets({ ctx, onActivate }: OverlayWidgetProps) {
  const css = asPrefString(ctx.prefs.get(PREF_DRAFT), STARTER_CSS);
  return <OverlayWidget title="Stylesheet scratchpad"><p>Saved draft / target: {asPrefString(ctx.prefs.get(PREF_PACK), DEFAULT_PACK_ID)}</p><pre>{css.slice(0, 800) || "Your stylesheet is empty."}</pre>
    <Button onClick={onActivate}>Continue editing CSS</Button><small>Draft text stays data here; it is never applied to Studio chrome.</small></OverlayWidget>;
}
