/** Test stand-in: a valid v2 theme package built from a bundled manifest, so route and lifecycle tests never hand-write palettes. */
import type { ThemePackageInput } from "./theme-contract";
import { themeInventory } from "./theme-inventory";

/** A copy of the bundled Theater package under another identity; `id` and `name` are the only edits. */
export async function fixtureThemePackage(id: string, name: string, licenseText = "Test fixture license"): Promise<ThemePackageInput> {
  // theme-key-ok: the fixture copies the bundled Theater package
  const theater = (await themeInventory()).find((input) => (input.manifest as { id: string }).id === "theater")!;
  const copy = JSON.parse(JSON.stringify(theater)) as { manifest: Record<string, unknown>; assets: Record<string, unknown> };
  copy.manifest.id = id;
  copy.manifest.name = name;
  return { ...copy, licenseText };
}
