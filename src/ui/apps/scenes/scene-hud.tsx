/** The scene page's one-line readout (data-part scene.hud): the take, the message count and the model, shown unless a theme variant hides it. */
import type { JSX } from "react";

export function SceneHud({ take, messages, model }: { take: string; messages: number; model: string }): JSX.Element {
  return (
    <div className="hudline" data-part="scene.hud" role="group" aria-label="Scene readout">
      <span><small>Take</small> <b>{take}</b></span>
      <span><small>Messages</small> <b>{messages}</b></span>
      <span><small>Model</small> <b>{model}</b></span>
    </div>
  );
}
