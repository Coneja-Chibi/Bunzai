/** Development update events and reconnects preserve the document; only explicit UI reload owns navigation. */
import { expect, test } from "bun:test";
import { createStore } from "zustand/vanilla";
import { connectDevReload } from "./dev-reload";
import { createDevUpdateSlice } from "./shell/store-dev-update";

function harness() {
  const source = new EventTarget(); const state = createStore(createDevUpdateSlice); const statuses: string[] = [];
  const timers = new Map<number, () => void>(); let serial = 0;
  const clock = {
    setTimeout: (handler: TimerHandler) => { if (typeof handler !== "function") throw new Error("Expected a timer callback"); const id = ++serial; timers.set(id, () => handler()); return id; },
    clearTimeout: (id: number | undefined) => { if (id !== undefined) timers.delete(id); },
  } as Pick<Window, "setTimeout" | "clearTimeout">;
  const stop = connectDevReload(source, (reason) => state.getState().offerDevUpdate(reason), (text) => statuses.push(text), clock);
  const message = (data: unknown) => source.dispatchEvent(new MessageEvent("message", { data }));
  const error = () => source.dispatchEvent(new Event("error"));
  return { state, timers, statuses, stop, message, error };
}

test("source update bursts produce one persistent offer, retained across ordinary status activity", () => {
  const h = harness(); let changes = 0; h.state.subscribe(() => { changes++; });
  h.message("hello one"); h.message("reload"); h.message("reload"); h.message("hello one"); h.message({ reload: true });
  expect(h.state.getState().devUpdate).toBe("source"); expect(changes).toBe(1); expect(h.statuses).toEqual([]); h.stop();
});

test("a server restart offers reconnect without resetting the pending update or reloading", () => {
  const h = harness(); h.message("hello one"); h.message("reload"); h.message("hello two"); h.message("reload"); h.message("hello two");
  expect(h.state.getState().devUpdate).toBe("restart"); expect(h.statuses).toEqual([]); h.stop();
});

test("transient stream drops cancel the outage timer; sustained outages report once and recover", () => {
  const h = harness(); h.error(); expect(h.timers.size).toBe(0);
  h.message("hello one"); h.error(); h.error(); expect(h.timers.size).toBe(1);
  h.message("hello one"); expect(h.timers.size).toBe(0); expect(h.statuses).toEqual([]);
  h.error(); const fire = [...h.timers.values()][0]!; h.timers.clear(); fire(); h.error();
  expect(h.statuses).toEqual(["Studio server is not running. Your work stays open; reconnecting..."]);
  h.message("hello one"); expect(h.statuses[1]).toBe("Studio server is back."); expect(h.state.getState().devUpdate).toBeNull(); h.stop();
});

test("disposing the lifecycle removes subscriptions and pending outage work", () => {
  const h = harness(); h.message("hello one"); h.error(); h.stop(); h.message("reload"); h.error();
  expect(h.timers.size).toBe(0); expect(h.state.getState().devUpdate).toBeNull(); expect(h.statuses).toEqual([]);
});

test("a restarted server clears its stale outage status while retaining the explicit update offer", () => {
  const h = harness(); h.message("hello one"); h.error();
  const fire = [...h.timers.values()][0]!; h.timers.clear(); fire(); h.message("hello two");
  expect(h.statuses.at(-1)).toBe("Studio server is back."); expect(h.state.getState().devUpdate).toBe("restart"); h.stop();
});
