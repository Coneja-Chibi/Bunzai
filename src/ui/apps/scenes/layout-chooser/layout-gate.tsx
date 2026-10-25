/**
 * The first-open gate (RoleCall's isChatAppearanceEntry + ChatAppearanceContext): a scene opens only once the person has
 * chosen a chat layout. Unset, or a saved value this build cannot read, shows the chooser in place of the scene; the rest
 * of the app stays usable. Choosing saves through chat-layout.ts's key, then the scene renders.
 */
import { useState, type JSX, type ReactNode } from "react";
import type { AppContext } from "../../../app-contract";
import { CHAT_LAYOUT_KEY, chatLayoutOf, type ChatLayout } from "../chat-layout";
import { LayoutChooser } from "./index";

export function LayoutGate({ ctx, children }: { ctx: AppContext; children: ReactNode }): JSX.Element {
  const [layout, setLayout] = useState<ChatLayout | null>(() => chatLayoutOf(ctx.prefs));
  if (layout) return <>{children}</>;
  return <LayoutChooser onChoose={(value) => { ctx.prefs.set(CHAT_LAYOUT_KEY, value); setLayout(value); }} />;
}
