/**
 * The Fallback Model control under the Booth's Narrator Model (RoleCall's FallbackModelControl.tsx, rendered at
 * QuickPlayPanel.tsx:1903): what answers when the scene's model fails. RoleCall's three modes are two here, Off
 * (the default: fail visibly) and Custom (a model you pick), because Bunzai has no helper model or house default
 * for Auto to fall back to. The choice is the per-user pref `scenes.fallbackModel` (fallback-model.ts); picking a
 * model is what saves Custom, so a Custom with no model yet behaves as Off.
 */
import { useState, type JSX } from "react";
import type { AppContext } from "../../app-contract";
import { FALLBACK_KEY, readFallback } from "./fallback-model";
import { Segmented } from "../../components/button";
import { BoothModelPicker } from "./booth-model-picker";
import type { ChatConnection } from "../../../stage/contracts/chat-store";
import type { SceneModels } from "./use-scene-models";

const MODES = [
  { id: "off", label: "Off", hint: "Fail instead of switching models" },
  { id: "custom", label: "Custom", hint: "A model you pick" },
] as const;

export function BoothFallbackRow({ ctx, models }: { ctx: AppContext; models: SceneModels }): JSX.Element {
  const saved = readFallback(ctx.prefs.get(FALLBACK_KEY));
  const [mode, setMode] = useState<"off" | "custom">(saved.mode);
  const [connection, setConnection] = useState<ChatConnection | undefined>(saved.mode === "custom" ? saved.connection : undefined);
  const choose = (next: "off" | "custom"): void => {
    setMode(next);
    if (next === "off") ctx.prefs.set(FALLBACK_KEY, { mode: "off" });
    else if (connection) ctx.prefs.set(FALLBACK_KEY, { mode: "custom", connection });
  };
  const pick = (c: ChatConnection): void => {
    setConnection(c);
    ctx.prefs.set(FALLBACK_KEY, { mode: "custom", connection: c });
  };
  return (
    <div className="bth-fb" data-part="scene.booth.fallback">
      <h4>Fallback Model</h4>
      <p>When your model fails, this decides what answers instead. Applies to all your scenes.</p>
      <Segmented label="Fallback mode" items={MODES.map((m) => ({ value: m.id, label: m.label }))} value={mode} onChange={choose} />
      <small>{MODES.find((m) => m.id === mode)!.hint}</small>
      {mode === "custom" && (
        <>
          <p>Used once when the main model gives up.</p>
          <BoothModelPicker current={connection} models={models} onPick={pick} />
        </>
      )}
    </div>
  );
}
