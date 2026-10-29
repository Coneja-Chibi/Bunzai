/** Trusted packaged app exports: its canvas and optional temporary-overlay widgets share one host context. */
import type { ReactNode } from "react";
import type { AppContext, AppManifestEntry } from "./app-contract";

export interface OverlayWidgetProps { ctx: AppContext; onActivate(): void }
export interface BunzaiApp {
  manifest: AppManifestEntry;
  Component: (props: { ctx: AppContext }) => ReactNode;
  /** First-party app code only. Theme packages select decoration, never executable widgets or new capabilities. */
  OverlayWidgets?: (props: OverlayWidgetProps) => ReactNode;
}
