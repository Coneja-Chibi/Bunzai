/**
 * The Props trackers' state as a fake server holds it (tests only): `held` is each module's saved data, the state read answers it, and a state write changes it the way the store does and tells `onWrite`
 * the module, its whole next data and who wrote it. The panel tests mount a panel against this and read back what it wrote.
 */
import type { JsonValue, TrackerModule } from "../../../../../../stage/contracts/chat-store";
import type { TrackerStates, TrackerWriteInput } from "../../../../../../studio/tracker-state";

export type HeldStates = Partial<Record<TrackerModule, JsonValue>>;

/** The api members and the piece store the state hook reads, over `held`. `left` is what a generated write answers as left alone. */
export function heldTrackerApi(held: () => HeldStates, onWrite: (module: TrackerModule, data: JsonValue | null, base?: JsonValue | null) => void) {
  const states = (): TrackerStates => ({ branchId: "b1", branchVersion: 1, tipId: "m1", data: structuredClone(held()), unreadable: [], updates: {} });
  return {
    pieces: { subscribeList: () => () => undefined, streamState: () => ({ sceneTrackers: null }) },
    api: {
      getTrackerStates: async (): Promise<TrackerStates> => states(),
      writeTrackerStates: async (input: TrackerWriteInput): Promise<TrackerStates> => {
        for (const w of input.writes) {
          onWrite(w.module, w.data, w.base);
          if (w.data === null) delete held()[w.module]; else held()[w.module] = w.data;
        }
        return states();
      },
    },
  };
}
