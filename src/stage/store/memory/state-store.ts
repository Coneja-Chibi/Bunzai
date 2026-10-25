/**
 * The in-memory StateStore, for tests and the temporary browser Studio: the documents in a map,
 * forgotten on reload. It checks keys exactly as the SQLite store does.
 */
import { checkStateKey, type StateKey, type StateStore } from "../../contracts/state-store";

export function memoryStateStore(): StateStore {
  const docs = new Map<StateKey, string>();
  return {
    async read(key) {
      return docs.get(checkStateKey(key)) ?? null;
    },
    async write(key, text) {
      if (typeof text !== "string") throw new Error("state text must be a string");
      docs.set(checkStateKey(key), text);
    },
  };
}
