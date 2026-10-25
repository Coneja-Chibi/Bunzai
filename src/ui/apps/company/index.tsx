/**
 * The Company - the house agent's future door (JOURNEY Act 4). Docked DIMMED per the locked shell:
 * an honest "installs later" tile, never mountable until the act lands. Its presence in the dock is
 * the moddability promise made visible.
 */
import type { AppContext, BunrakuApp } from "../../app-contract";
import { COMPANY_AGENT_SURFACE, usePublishCompanySurface } from "./agent-surface";
import { icSvg } from "../../_shared/ic-svg";

/** the locked player-silhouette mark (vs-shell-apps) */
const MARK_SVG = icSvg("lucide:circle-user", 18);

/** never rendered while comingSoon; the shell disables the tile and never loads this module's bundle.
 * The publish is wired anyway so the agent window is live the day the door opens - dormant, not
 * missing (see agent-surface.ts). */
function Company({ ctx }: { ctx: AppContext }): null {
  usePublishCompanySurface(ctx);
  return null;
}

const app: BunrakuApp = {
  manifest: {
    id: "company",
    title: "The Company",
    markSvg: MARK_SVG,
    accent: "#2aa198", // hardcode-ok: app identity accent, not theme chrome
    order: 90,
    comingSoon: true,
    catalogOnly: true,
    agentSurface: COMPANY_AGENT_SURFACE,
  },
  Component: Company,
};

export default app;
