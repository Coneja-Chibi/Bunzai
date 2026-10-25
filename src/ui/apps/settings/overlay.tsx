/** Settings overlay: verified appearance readout, never credentials or approval controls. */
import type { OverlayWidgetProps } from "../../app-contract";
import { OverlayWidget } from "../../components/overlay-widget";

export function OverlayWidgets({ ctx, onActivate }: OverlayWidgetProps) {
  const appearance = ctx.appearance.get(); const type = appearance.appearance?.type;
  return <OverlayWidget title="Appearance profile"><div className="overlay-widget-grid"><div className="overlay-widget-swatch">Action color</div><div className="overlay-widget-swatch">Panel color</div></div>
    <dl><dt>Effective theme</dt><dd>{appearance.name ?? "Host default"}</dd><dt>Body type</dt><dd>{type?.body ?? "Host default"}</dd><dt>Display type</dt><dd>{type?.display ?? "Host default"}</dd><dt>Accent</dt><dd>{appearance.appearance?.accent.follows ?? "Host default"}</dd></dl>
    <button onClick={onActivate}>Return to settings</button><small>Theme approvals and sensitive settings remain in their protected host panels.</small></OverlayWidget>;
}
