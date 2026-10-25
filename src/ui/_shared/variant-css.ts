/**
 * Variant stylesheets are plain CSS strings keyed on the root attribute the painter sets
 * (`html[data-surface-scene-layout="vn-stage"]`), so a variant a theme does not pick matches nothing and
 * the surface keeps its current rendering. `&` in the css stands for that scope (plus an optional root
 * selector such as `.scs`). Variants change markup placement, type, frames and motion; never radius, and
 * never the presence of a control.
 */
import { surfaceAttribute, type SurfaceId, type SURFACES } from "../../extensions/surface-registry";

export function variantCss<S extends SurfaceId>(surface: S, variant: (typeof SURFACES)[S][number], css: string, root = ""): string {
  return css.replaceAll("&", `html[${surfaceAttribute(surface)}="${variant}"]${root ? ` ${root}` : ""}`);
}

/** Four corner brackets as one `background` value for an inset pseudo element: `len` long, `w` thick, in `color`. */
export function brackets(color: string, len = "0.9rem", w = "2px"): string {
  const edge = (pos: string, size: string): string => `linear-gradient(${color},${color}) ${pos}/${size} no-repeat`;
  const h = `${len} ${w}`, v = `${w} ${len}`;
  return ["top left", "top right", "bottom left", "bottom right"].flatMap((pos) => [edge(pos, h), edge(pos, v)]).join(",");
}
