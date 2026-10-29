/**
 * Apps is the packaged-app catalog reached through the Dock's Add app control. Its inventory comes
 * from AppContext manifests, never a second list. Catalog-only tools such as CSS Workshop remain
 * fully bundled and mountable without occupying the everyday Dock.
 */
import { Button } from "../../components/button";
import { OverlayWidgets } from "./overlay";
import { useEffect } from "react";
import type { JSX } from "react";
import type { AppContext, AppManifestEntry, BunzaiApp } from "../../app-contract";
import { AppMark } from "../../components/app-mark";
import { Panel } from "../../components/panel";
import { RoomHeader } from "../../components/room-header";
import { officialCatalogApps } from "./catalog-core";
import styles from "./styles.module.css";
import { icSvg } from "../../_shared/ic-svg";

const MARK_SVG = icSvg("lucide:layout-grid", 18);

const descriptionFor = (app: AppManifestEntry): string =>
  app.agentSurface?.describe ?? `${app.title} is included with this build of Bunzai.`;

function AppCard({ app, ctx }: { app: AppManifestEntry; ctx: AppContext }): JSX.Element {
  return (
    <Panel as="article" data-part="app-catalog.card" className={styles.card} data-group={app.catalogOnly ? "included" : "dock"}>
      <div className={styles.cardHead}>
        <AppMark markSvg={app.markSvg} className={styles.mark} />
        <h2 className={styles.name}>{app.title}</h2>
      </div>
      <p className={styles.description}>{descriptionFor(app)}</p>
      <div className={styles.cardFoot}>
        <span className={styles.status}>{app.catalogOnly ? "Included app" : "On your Dock"}</span>
        <Button size="sm" onClick={() => ctx.openApp(app.id)}>Open</Button>
      </div>
    </Panel>
  );
}

/** Browse and open every official app packaged in this build. */
export function AppCatalog({ ctx }: { ctx: AppContext }): JSX.Element {
  const apps = officialCatalogApps(ctx.apps());

  useEffect(() => {
    ctx.setStatus(`apps · ${apps.length} included`);
  }, [apps.length, ctx]);

  return (
    <div className={styles.room}>
      <RoomHeader
        data-part="app-catalog.header"
        kicker="Apps in this build"
        title="Official Bunzai apps"
        lede="Everything here shipped with this copy of Bunzai. Open a room when you need it; compact specialist tools stay here instead of crowding your everyday Dock."
      />

      <section className={styles.grid} aria-label="Official packaged apps">
        {apps.map(/* bounded-ok: fixed app / doc / deck-kind / store sets, or short per-import summaries */ (app) => <AppCard key={app.id} app={app} ctx={ctx} />)}
      </section>
    </div>
  );
}

const app: BunzaiApp = {
  OverlayWidgets,
  manifest: {
    id: "app-catalog",
    title: "Apps",
    markSvg: MARK_SVG,
    accent: "#5b8def", // hardcode-ok: app identity accent, not theme chrome
    order: 80,
    catalogOnly: true,
    appCatalog: true,
    agentSurface: { describe: "Catalog of official applications packaged with this build of Bunzai." },
  },
  Component: AppCatalog,
};

export default app;
