/**
 * RoleCall's Message Bubble Opacity (ChatMessageShell.tsx:427): how see-through a bubble's fill and border are, 0 to 200% of the
 * theme's own (the Stage wing's Message act sets --bk-msg-opacity on the scene root; unset reads 1). A percentage past 100 would make
 * color-mix invalid and drop the whole declaration, so the share is clamped.
 */
export const seeThrough = (color: string, percent = 100): string =>
  `color-mix(in srgb,${color} clamp(0%,calc(${percent}%*var(--bk-msg-opacity,1)),100%),transparent)`;
