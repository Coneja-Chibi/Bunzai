/** The rp-core Director inspector follows the visible path and committed answer versions. */
import { expect, test } from "bun:test";
import type { Entry, MessageView } from "rp-core";
import { directorOnPath } from "./core-inspect";

const message = (id: string): MessageView => ({ id, parent: null, role: "assistant", blocks: [], hidden: false, edited: false, swipe: { index: 0, count: 1 } });
const record = (turn: number) => ({ turn, ok: true, state: { turn, arcs: [] } });

test("Director view ignores an uncommitted plan and a different swipe, then uses the latest committed edit", () => {
  const entries = [
    { t: "msg", id: "a", dir: record(1) },
    { t: "prep", dir: record(9) },
    { t: "msg", id: "other-swipe", dir: record(2) },
    { t: "edit", target: "a", dir: record(3) },
  ] as unknown as Entry[];
  expect(directorOnPath([message("a")], entries)?.["turn"]).toBe(3);
  expect(directorOnPath([message("other-swipe")], entries)?.["turn"]).toBe(2);
  expect(directorOnPath([message("missing")], entries)).toBeNull();
});
