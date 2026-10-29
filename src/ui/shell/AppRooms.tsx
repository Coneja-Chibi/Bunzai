/** Retain workspace, overlay and draft owners; route each app's one live instance to its presentation host. */
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppContext, BunzaiApp } from "../app-contract";
import { useShellStore } from "./store";
import { AppActivity } from "../_shared/app-activity";
import { AppSurface } from "./AppSurface";
import { presentedAppId } from "./store-navigation";

function Room({ app, ctx, active }: { app: BunzaiApp; ctx: AppContext; active: boolean }) {
  const lastBrief = useRef<Parameters<AppContext["agent"]["publish"]>[0] | null>(null);
  const context = useMemo(() => ({ ...ctx, setStatus: (message: string) => {
    if (presentedAppId(useShellStore.getState()) === app.manifest.id) ctx.setStatus(message);
  }, agent: { ...ctx.agent, publish: (brief: Parameters<AppContext["agent"]["publish"]>[0]) => {
    lastBrief.current = brief;
    if (presentedAppId(useShellStore.getState()) === app.manifest.id) ctx.agent.publish(brief);
  } } }), [app, ctx]);
  useEffect(() => {
    if (active && presentedAppId(useShellStore.getState()) === app.manifest.id && lastBrief.current) ctx.agent.publish(lastBrief.current);
  }, [active, app, ctx]);
  const Component = app.Component;
  return <div className="studio-app-room"><AppActivity.Provider value={active}><Component ctx={context} /></AppActivity.Provider></div>;
}

export function AppRooms({ app, activeAppId, workspaceAppId, overlayAppId, workspace, overlay, overlayOpen, ctx }: {
  app: BunzaiApp | null; activeAppId: string; workspaceAppId: string; overlayAppId: string;
  workspace: HTMLElement | null; overlay: HTMLElement | null; overlayOpen: boolean; ctx: AppContext;
}) {
  const [retained, setRetained] = useState<BunzaiApp[]>([]);
  const keep = (room: BunzaiApp): boolean => !!room.manifest.editsPieces || room.manifest.id === workspaceAppId || room.manifest.id === overlayAppId;
  const rooms = [...retained.filter(keep), ...(app && !retained.includes(app) ? [app] : [])];
  useEffect(() => {
    setRetained((current) => {
      const next = current.filter((room) => !!room.manifest.editsPieces || room.manifest.id === workspaceAppId || room.manifest.id === overlayAppId);
      if (app && !next.includes(app)) next.push(app);
      return next.length === current.length && next.every((room, i) => room === current[i]) ? current : next;
    });
  }, [app, workspaceAppId, overlayAppId]);
  return <>{rooms.map(/* bounded-ok: tabs, menus, wizard steps, options and chips: fixed small sets */ (room) => {
    const id = room.manifest.id; const floating = overlayOpen && id === overlayAppId;
    return <AppSurface key={id} workspace={workspace} overlay={floating ? overlay : null} visible={floating || id === workspaceAppId}>
      <Room app={room} ctx={ctx} active={id === activeAppId} />
    </AppSurface>;
  })}{(!app || app.manifest.id !== activeAppId) && activeAppId && <AppSurface workspace={workspace} overlay={overlayOpen ? overlay : null}><div id="canvasLoading">Setting the stage...</div></AppSurface>}</>;
}
