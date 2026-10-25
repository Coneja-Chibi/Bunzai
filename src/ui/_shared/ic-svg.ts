/** `Ic` as a markup string, for the places that take an SVG string (app marks, library view switches) instead of a component. */
import glyphs from "../../generated/ic-glyphs.json";
import type { IconName } from "./ic";

export function icSvg(name: IconName, size = 16): string {
  const solid = name.startsWith("mdi:");
  const paths = glyphs[name].split("|").map((d) => `<path d="${d}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" data-ic="" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${solid ? "currentColor" : "none"}" stroke="${solid ? "none" : "currentColor"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}
