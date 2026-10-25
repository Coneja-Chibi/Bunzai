/** Apps overlay: the discovered packaged-app directory, grouped visually without a second roster. */
import type { OverlayWidgetProps } from "../../app-contract";
import { AppMark } from "../../components/app-mark";
import { OverlayWidget } from "../../components/overlay-widget";

export function OverlayWidgets({ ctx, onActivate }: OverlayWidgetProps) {
  const apps = ctx.apps().filter((m) => !m.comingSoon);
  return <OverlayWidget title="Packaged app directory"><div className="overlay-widget-grid">{apps.map((app) => <button key={app.id} onClick={() => { ctx.openApp(app.id); onActivate(); }}><AppMark markSvg={app.markSvg} /><strong>{app.title}</strong><small>{app.subtitle ?? "App"}</small></button>)}</div></OverlayWidget>;
}
