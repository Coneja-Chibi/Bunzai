/**
 * What every part of the button family shares: the native attributes a part forwards (never className or style, so a
 * room cannot restyle it), the theme-parts hook, a ref, and `vars` for per-item CSS custom properties (data such as a
 * tooltip offset or a tint, never a look property).
 */
import type { ButtonHTMLAttributes, CSSProperties, Ref } from "react";

export type NativeButton = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "style" | "children">;
export type Part = { "data-part"?: string; ref?: Ref<HTMLButtonElement> };
/** Per-item CSS custom properties only: `{ "--tone": "var(--deck-lorebook)" }`. */
export type Vars = { vars?: Record<`--${string}`, string> };

export const cx = (...names: (string | false | undefined | null)[]): string => names.filter(Boolean).join(" ");
export const varsStyle = (vars: Vars["vars"], extra?: CSSProperties): CSSProperties | undefined =>
  vars || extra ? ({ ...extra, ...vars } as CSSProperties) : undefined;
