/** Name the appearance the host verified, never the previous three-value setting shape. */
import type { EffectiveThemeAppearance } from "../../extensions/theme-contract";

export function effectiveThemeLabel(appearance: Pick<EffectiveThemeAppearance, "themeId" | "name">): string {
  if (appearance.themeId === null) return "Core";
  if (appearance.name) return appearance.name;
  // No name came with it: its id is bunzai.theme.<slug>, shown as the slug in words ("bunzai.theme.neon-pop" -> "Neon Pop").
  return appearance.themeId.replace(/^bunzai.theme./, "").split(/[-.]/).filter(Boolean).map((word) => word[0]!.toUpperCase() + word.slice(1)).join(" ");
}
