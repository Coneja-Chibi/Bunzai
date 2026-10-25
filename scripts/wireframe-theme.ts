/**
 * Regenerate the palette block in design/wireframes/theme.js from the bundled theme manifests, so
 * wireframes that switch themes by data-theme paint the same custom properties the app's painter writes.
 * Run after a bundled manifest changes: bun run scripts/wireframe-theme.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { inspectThemePackage } from "../src/extensions/theme-contract";
import { themeInventory } from "../src/extensions/theme-inventory";
import { themeProperties } from "../src/ui/shell/theme-tokens";

const target = new URL("../design/wireframes/theme.js", import.meta.url);
const palettes: Record<string, Record<string, string>> = {};
for (const input of await themeInventory()) {
  const id = (input.manifest as { id: string }).id;
  palettes[id] = themeProperties((await inspectThemePackage(input, id)).appearance);
}
const block = `/*palettes:start*/var PALETTES = ${JSON.stringify(palettes)};/*palettes:end*/`;
writeFileSync(target, readFileSync(target, "utf8").replace(/\/\*palettes:start\*\/[\s\S]*?\/\*palettes:end\*\//, block));
