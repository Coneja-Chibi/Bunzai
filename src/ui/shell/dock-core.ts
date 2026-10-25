/**
 * Pure dock roster: every available app is reachable, with utility apps separated at the end.
 */
import type { AppManifestEntry } from "../app-contract";

export interface DockManifestGroups {
  present: AppManifestEntry[];
  foot: AppManifestEntry[];
}

export function dockManifestGroups(manifests: AppManifestEntry[]): DockManifestGroups {
  const visible = manifests.filter((app) => !app.comingSoon).sort((a,b) => a.order - b.order);
  const body = visible.filter((app) => !app.dockFoot);
  return {
    present: body,
    foot: visible.filter((app) => app.dockFoot),
  };
}
