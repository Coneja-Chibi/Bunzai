/**
 * Tag-category presentation: the UI's read of the pure `categorizeTag` result (core/tag-taxonomy) - a
 * base color + a small line glyph per category, for the editor's tag chips. Categorization itself is
 * core; this is just how the editor draws each category. Lifted out of Editor.tsx (one presentation
 * concept, zero component deps).
 */
import type { JSX } from "react";
import { Ic, type IconName } from "../../_shared/ic";
import type { TagCategory } from "../../../core/tag-taxonomy";

/** a small line glyph for tag chips (sits before the tag text) */
const tglyph = (name: IconName): JSX.Element => <Ic name={name} size={12} />;

export const TAG_CATEGORY_STYLE: Record<TagCategory, { color: string; icon: JSX.Element }> = {
  identity: { color: "#22d3ee", icon: tglyph("lucide:user") }, // hardcode-ok: tag-category identity color, not theming
  trait: { color: "#a78bfa", icon: tglyph("lucide:star") }, // hardcode-ok: tag-category identity color, not theming
  role: { color: "#fb7185", icon: tglyph("lucide:briefcase") }, // hardcode-ok: tag-category identity color, not theming
  genre: { color: "#818cf8", icon: tglyph("lucide:book-open") }, // hardcode-ok: tag-category identity color, not theming
  theme: { color: "#f472b6", icon: tglyph("lucide:bookmark") }, // hardcode-ok: tag-category identity color, not theming
  setting: { color: "#34d399", icon: tglyph("lucide:map-pin") }, // hardcode-ok: tag-category identity color, not theming
  pov: { color: "#38bdf8", icon: tglyph("lucide:eye") }, // hardcode-ok: tag-category identity color, not theming
  mood: { color: "var(--stage-warn)", icon: tglyph("lucide:smile") }, // hardcode-ok: tag-category identity color, not theming
  kink: { color: "#f87171", icon: tglyph("lucide:flame") }, // hardcode-ok: tag-category identity color, not theming
  warning: { color: "#fb923c", icon: tglyph("lucide:triangle-alert") }, // hardcode-ok: tag-category identity color, not theming
  meta: { color: "#94a3b8", icon: tglyph("lucide:hash") }, // hardcode-ok: tag-category identity color, not theming
};
