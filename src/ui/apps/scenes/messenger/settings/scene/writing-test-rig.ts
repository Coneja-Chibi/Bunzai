/** Stand-ins the Writing and Memory page tests add to the scripted scene (fake-scene-rig.ts): api calls that answer and are recorded, and a library preset. Tests import it. */
import type { PresetBody } from "../../../../../../entities/preset/schema";
import type { Chat } from "../../../../../../stage/contracts/chat-store";
import type { Rig } from "./fake-scene-rig";

export const PRESET: PresetBody = { name: "Narrator bank", prompts: [], groups: [], samplers: { temperature: 0.7, topP: 0.9 } };

/** Replaces one api call on the rig with one that is recorded in `calls` and answers with `answer`. */
export function stub(r: Rig, name: string, answer: (...args: unknown[]) => unknown): void {
  (r.a.ctx.api as unknown as Record<string, unknown>)[name] = (...args: unknown[]): Promise<unknown> => {
    (r.calls[name] ??= []).push(args);
    try { return Promise.resolve(answer(...args)); } catch (e) { return Promise.reject(e); }
  };
}

/** The scene has the preset and the library hands it back. */
export function withPreset(r: Rig, body: PresetBody = PRESET): void {
  stub(r, "getEditableEntity", () => ({ entity: { kind: "preset", id: "p1", body }, revision: "r1" }));
  stub(r, "setScenePreset", (_id, preset) => ({ ...r.a.scene.chat, ...(preset ? { preset } : {}) }) as Chat);
}
