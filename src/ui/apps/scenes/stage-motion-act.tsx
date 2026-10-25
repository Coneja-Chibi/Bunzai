/**
 * The Motion & Signals act (RoleCall's "Motion & Signals", StageSettingsPanel.tsx:2290-2400): auto-scroll, the typing indicator,
 * streaming fade-in, the response chime and reasoning. Auto-open and Cap long reasoning are the reasoning blocks' own preferences
 * (scene-reasoning-core.ts); the rest are read by use-auto-scroll.ts, use-stage-signals.ts and the scene page.
 */
import type { JSX } from "react";
import { AUTO_OPEN_KEY, CAP_LONG_KEY, autoOpenReasoning, capLongReasoning } from "./scene-reasoning-core";
import { Field, SwitchRow, Tiles } from "./stage-controls";
import type { AutoScroll } from "./stage-look-core";
import type { StageActProps } from "./stage-message-act";

const SCROLLS = [{ id: "always", label: "Always", icon: "mdi:arrow-down-bold-circle" }, { id: "smart", label: "Smart", icon: "mdi:arrow-down-circle-outline" }, { id: "never", label: "Never", icon: "mdi:cancel" }] as const;
const SCROLL_HELP: Record<AutoScroll, string> = { always: "Always scroll to new messages", smart: "Scroll only when near bottom", never: "Never auto-scroll, show indicator" };

export function MotionAct({ look, set, prefs, onSet }: StageActProps): JSX.Element {
  return (
    <>
      <Field icon="mdi:arrow-down-circle" label="Auto-Scroll" help={SCROLL_HELP[look.autoScroll]}>
        <Tiles label="Auto-Scroll" items={SCROLLS} value={look.autoScroll} onPick={(v) => set("autoScroll", v)} />
      </Field>
      <div className="sa-sws">
        <SwitchRow icon="mdi:keyboard" name="Typing Indicator" tone="var(--stage-warn)" on={look.typing} onChange={(on) => set("typing", on)} />
        <SwitchRow icon="mdi:blur" name="Streaming Fade-In" tone="var(--stage-warn)" on={look.fadeIn} onChange={(on) => set("fadeIn", on)} />
        <SwitchRow icon="mdi:bell-outline" name="Response Chime" tone="var(--stage-warn)" on={look.chime} onChange={(on) => set("chime", on)} />
        <SwitchRow icon="mdi:thought-bubble-outline" name="Auto-Open Reasoning" tone="var(--stage-macro)" on={autoOpenReasoning(prefs.get(AUTO_OPEN_KEY))} onChange={(on) => onSet(AUTO_OPEN_KEY, on)} />
        <SwitchRow icon="lucide:maximize-2" name="Cap long reasoning" tone="var(--stage-macro)" help="Keep a long block to 300px and scroll inside it." on={capLongReasoning(prefs.get(CAP_LONG_KEY))} onChange={(on) => onSet(CAP_LONG_KEY, on)} />
      </div>
    </>
  );
}
