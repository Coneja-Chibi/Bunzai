/**
 * Settings > Appearance > Chat layout: Full Chat or Messenger for every chat, the same key the first-open chooser saves
 * (scenes/chat-layout.ts). Unset shows Full Chat, the chooser's preselection, without saving it.
 */
import { useState, type JSX } from "react";
import { CHAT_LAYOUT_KEY, chatLayoutOf, type ChatLayout } from "../../scenes/chat-layout";
import { SegControl, SettingsRow } from "../section-contract";

export function ChatLayoutRow({ prefs }: { prefs: { get(key: string): unknown; set(key: string, value: unknown): void } }): JSX.Element {
  const [layout, setLayout] = useState<ChatLayout>(() => chatLayoutOf(prefs) ?? "stage");
  return (
    <SettingsRow label="Chat layout" hint="How every chat is laid out.">
      <SegControl<ChatLayout>
        options={[{ value: "stage", label: "Full Chat" }, { value: "messenger", label: "Messenger" }]}
        current={layout}
        onPick={(value) => { prefs.set(CHAT_LAYOUT_KEY, value); setLayout(value); }}
      />
    </SettingsRow>
  );
}
