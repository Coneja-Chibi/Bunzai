/**
 * CSS Workshop dock app - folders-as-schema tile in Apps.
 * Thin shell: manifest + Room. Shared leaf: components/css-workshop.
 * Plan: docs/CSS-WORKSHOP-PLAN.md · Wireframes: design/vs-css-workshop*.html
 */
import { OverlayWidgets } from "./overlay";
import type { BunzaiApp } from "../../app-contract";
import { CssWorkshopRoom } from "./room";
import { icSvg } from "../../_shared/ic-svg";

/** palette mark (flat stroke; house grammar) */
const MARK_SVG = icSvg("lucide:palette", 18);

const app: BunzaiApp = {
  OverlayWidgets,
  manifest: {
    id: "css-workshop",
    title: "CSS Workshop",
    markSvg: MARK_SVG,
    accent: "#7c3aed", // hardcode-ok: per-app identity accent, not theming
    order: 35,
    catalogOnly: true,
    subtitle: "app · style",
    agentSurface: {
      describe:
        "Assisted CSS authoring room. Starters, property knobs, plain CSS source, sealed preview. Copy or download for any host.",
    },
  },
  Component: ({ ctx }) => <CssWorkshopRoom ctx={ctx} />,
};

export default app;
