/** Source updates and stale-session recovery offers are transient shell state until the person chooses to reload. */
import type { StateCreator } from "zustand";

export type DevUpdate = "source" | "restart";
export interface DevUpdateSlice {
  devUpdate: DevUpdate | null;
  offerDevUpdate(reason: DevUpdate): void;
}

export const createDevUpdateSlice: StateCreator<DevUpdateSlice> = (set, get) => ({
  devUpdate: null,
  offerDevUpdate(reason) {
    if (get().devUpdate === "restart" || get().devUpdate === reason) return;
    set({ devUpdate: reason });
  },
});
