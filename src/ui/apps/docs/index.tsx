/** Help / Docs: the committed documentation corpus, packaged as a first-class app room. */
import { OverlayWidgets } from "./overlay";
import type { BunrakuApp } from "../../app-contract";
import { DocsRoom } from "./room";
import { icSvg } from "../../_shared/ic-svg";

const MARK_SVG = icSvg("lucide:file-text", 18);

const app: BunrakuApp = {
  OverlayWidgets,
  manifest: {
    id: "docs",
    title: "Help / Docs",
    markSvg: MARK_SVG,
    accent: "#3b82f6", // hardcode-ok: app identity accent, not theme chrome
    order: 70,
    subtitle: "app · help",
    catalogOnly: true,
    agentSurface: {
      describe: "Everything about Bunraku, readable here or on GitHub from the same source.",
    },
  },
  Component: DocsRoom,
};

export default app;
