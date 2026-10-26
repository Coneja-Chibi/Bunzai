/** The Notifications page's desktop notice switch: the same pref (`messenger.notify`) and the same writer as the sidebar character menu (`useNotifyPrefs`), so turning it on asks for permission here too and a refusal leaves it off and says so. Not drawn where the browser cannot show notices. */
import type { JSX } from "react";
import { useNotifyPrefs } from "../../shell/use-notify-prefs";
import { ToggleRow } from "../../frames/settings-rows";
import type { WingArgs } from "../../wing-props";

export function DesktopNoticeRow({ a }: { a: WingArgs }): JSX.Element | null {
  const { view, change } = useNotifyPrefs(a.ctx, a.scene.chat.cast.character.id);
  if (!view.canDesktop) return null;
  return <ToggleRow label="Desktop notice" description="A notice that says who replied, never what they said. Shown only while this window is not in front." on={view.desktop} onChange={(on) => change({ kind: "desktop", on })} />;
}
