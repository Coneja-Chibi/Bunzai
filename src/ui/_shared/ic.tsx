/** The one icon door: RoleCall's lucide (stroked) and mdi (filled) glyphs, named by their real ids and drawn from the generated table. */
import type { JSX } from "react";
import glyphs from "../../generated/ic-glyphs.json";
import "./icon-variant-styles";

export type IconName = keyof typeof glyphs;

/** `fill` draws a lucide glyph solid, as RoleCall does for the Booth bolt and the stop square; mdi glyphs are always solid. */
export function Ic({ name, size = 16, fill = false, className }: { name: IconName; size?: number; fill?: boolean; className?: string }): JSX.Element {
  const solid = fill || name.startsWith("mdi:");
  return (
    <svg data-ic="" className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={solid ? "currentColor" : "none"}
      stroke={name.startsWith("mdi:") ? "none" : "currentColor"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {glyphs[name].split("|").map(/* bounded-ok: single message / fixed menu or glyph parts */ (d) => <path key={d} d={d} />)}
    </svg>
  );
}
