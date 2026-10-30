/** Desktop composition: all routes for an open ChatStore share its one in-flight turn owner. */
import type { ChatStore } from "../stage/contracts/chat-store";
import { closeTurnRuntime, createTurnRuntime } from "../studio/scene-turn-runtime";
import { publishSceneTrackers } from "../studio/scene-events";

const runtimes = new WeakMap<ChatStore, ReturnType<typeof createTurnRuntime>>();

export function sceneRuntimeFor(chats: ChatStore) {
  let runtime = runtimes.get(chats);
  if (!runtime) { runtime = createTurnRuntime(publishSceneTrackers); runtimes.set(chats, runtime); }
  return runtime;
}

export async function closeSceneRuntime(chats: ChatStore): Promise<void> {
  const runtime = runtimes.get(chats);
  if (runtime) await closeTurnRuntime(runtime);
}
