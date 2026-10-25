/**
 * How many of the REGISTERED surfaces a theme picks differently: the share of the 29 host surfaces where it names
 * a variant that no other theme names and that is not the core rendering. It counts manifest picks only, so it
 * cannot see the rest of the app and says nothing about what actually renders; the whole-app figure is the
 * screenshot measurement in scripts/theme-measure.ts (bun run theme:measure). The theme manager shows this score;
 * theme-difference.test.ts gates the bundled themes at DIFFERENCE_FLOOR so their picks cannot quietly collapse into
 * four recolors.
 */
import { DEFAULT_STUDIO_THEME } from "../studio/settings-shape";
import { SURFACES, type SurfaceId, type SurfaceVariants } from "./surface-registry";

export const DIFFERENCE_FLOOR = 0.5;

/**
 * Colour-only on purpose, so exempt from DIFFERENCE_FLOOR. A theme that
 * colors everything exactly like RC is the default. It paints RoleCall's
 * palette and fonts over the core rendering and picks no variants. Only this list is exempt, and the test requires an
 * exempt theme to pick none, so it cannot hide a theme that merely picks few. The four identity themes keep the floor.
 */
export const COLOUR_ONLY_THEMES: readonly string[] = [DEFAULT_STUDIO_THEME];

export function differenceScore(theme: SurfaceVariants, others: readonly SurfaceVariants[]): { score: number; distinct: SurfaceId[] } {
  const ids = Object.keys(SURFACES) as SurfaceId[];
  const distinct = ids.filter((id) => theme[id] !== undefined && others.every((other) => other[id] !== theme[id]));
  return { score: distinct.length / ids.length, distinct };
}
