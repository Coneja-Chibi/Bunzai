/** Agent overlay: the existing live screen brief, with conversation and approvals kept in their owners. */
import type { OverlayWidgetProps } from "../../app-contract";
import { useSyncExternalStore } from "react";
import { OverlayWidget } from "../../components/overlay-widget";

export function OverlayWidgets({ ctx, onActivate }: OverlayWidgetProps) {
  const surface = useSyncExternalStore(ctx.agent.onChange, ctx.agent.current, () => null);
  return <OverlayWidget title="Agent briefing"><div className="overlay-widget-page"><small>Current screen context</small><p>{surface?.state.headline ?? "No screen has published a brief yet."}</p></div>
    <button onClick={onActivate}>Return to the agent</button><small>Starting a request and approving changes remain explicit actions in the agent and its Gate.</small></OverlayWidget>;
}
