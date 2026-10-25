/**
 * The dock includes every available manifest once and keeps unavailable apps out of navigation.
 */
import { describe, expect, test } from "bun:test";
import type { AppManifestEntry } from "../app-contract";
import { dockManifestGroups } from "./dock-core";

const manifest = (patch: Partial<AppManifestEntry>): AppManifestEntry => ({
  id: "app",
  title: "App",
  markSvg: "<svg/>",
  accent: "var(--accent)",
  order: 10,
  ...patch,
});

describe("dock manifest routing", () => {
  test("includes catalog-only tools and the catalog itself, with utility apps at the end", () => {
    const groups = dockManifestGroups([
      manifest({ id: "library" }),
      manifest({ id: "css-workshop", catalogOnly: true }),
      manifest({ id: "app-catalog", catalogOnly: true, appCatalog: true }),
      manifest({ id: "settings", dockFoot: true }),
      manifest({ id: "company", comingSoon: true, catalogOnly: true }),
    ]);

    expect(groups.present.map((app) => app.id)).toEqual(["library", "css-workshop", "app-catalog"]);
    expect(groups.foot.map((app) => app.id)).toEqual(["settings"]);
  });
});
