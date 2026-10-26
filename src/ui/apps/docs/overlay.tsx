/** Docs overlay: the actual reading bookmark, presented as a small reference card. */
import { Button } from "../../components/button";
import type { OverlayWidgetProps } from "../../app-contract";
import { OverlayWidget } from "../../components/overlay-widget";

export function OverlayWidgets({ ctx, onActivate }: OverlayWidgetProps) {
  const last = ctx.prefs.get("docs.last");
  return <OverlayWidget title="Reading bookmark"><div className="overlay-widget-page"><small>Last opened page</small><strong>{typeof last === "string" && last ? last : "No page opened yet"}</strong><p>The reader keeps your current page underneath this overlay.</p></div>
    <Button onClick={onActivate}>Continue reading</Button></OverlayWidget>;
}
