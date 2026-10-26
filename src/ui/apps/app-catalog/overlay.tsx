/** Apps overlay: the discovered packaged-app directory, grouped visually without a second roster. */
import { Tile } from "../../components/button";
import type { OverlayWidgetProps } from "../../app-contract";
import { AppMark } from "../../components/app-mark";
import { OverlayWidget } from "../../components/overlay-widget";

export function OverlayWidgets({ ctx, onActivate }: OverlayWidgetProps) {
  const apps = ctx.apps().filter((m) => !m.comingSoon);
  return <OverlayWidget title="Packaged app directory"><div className="overlay-widget-grid">{apps.map(/* bounded-ok: fixed app / doc / deck-kind / store sets, or short per-import summaries */ (app) => <Tile kind="app" key={app.id} label={app.title} title={`${app.title}: ${app.subtitle ?? "App"}`} icon={<AppMark markSvg={app.markSvg} />} onClick={() => { ctx.openApp(app.id); onActivate(); }} />)}</div></OverlayWidget>;
}
