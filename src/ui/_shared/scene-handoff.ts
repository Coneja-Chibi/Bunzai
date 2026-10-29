/**
 * Hand-offs between apps: one app leaves a value, another reads it on mount and on the event. Kept in
 * session storage so a reload lands in the same place. Two today: which scene the Scenes app opens
 * next (the Library's Start Scene), and opening the Library on its Trash (the Scenes page's Trash).
 */
import { webStorage } from "./web-storage";

export const SCENES_APP = "scenes";
export const LIBRARY_APP = "library";

function handoff(key: string) {
  const event = `bunzai:handoff:${key}`;
  return {
    give(value: string | null): void {
      try {
        if (value) webStorage("session")?.setItem(key, value);
        else webStorage("session")?.removeItem(key);
      } catch {
        // A blocked store only means the app opens where it was.
      }
      window.dispatchEvent(new CustomEvent(event));
    },
    taken(): string | null {
      try {
        return webStorage("session")?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    on(listener: () => void): () => void {
      window.addEventListener(event, listener);
      return () => window.removeEventListener(event, listener);
    },
  };
}

const scene = handoff("bunzai.scenes.open");
export const handOffScene = scene.give;
export const handedScene = scene.taken;
export const onSceneHandoff = scene.on;

/** The Library opens on its Trash when this is set; it clears it once shown. */
export const libraryTrash = handoff("bunzai.library.trash");
