/** A scene's tracker settings as the stores read them back: a cell written before the state moved to its slot is read as settings alone. */
import { describe, expect, test } from "bun:test";
import type { ChatTrackers } from "../contracts/chat-tracker-types";
import { settingsOf } from "./tracker-rules";

describe("settingsOf", () => {
  test("a stale cell keeps only the module's own switches, so an unknown one cannot make the state unreadable", () => {
    const stale = { knowledge: { context: "always", subs: { secrets: true, gone: true, odd: "yes" }, data: { entries: [] } } } as unknown as ChatTrackers;
    expect(settingsOf(stale)).toEqual({ knowledge: { context: "always", subs: { secrets: true } } } as unknown as ChatTrackers);
  });

  test("a cell whose switches are all unknown keeps none of them", () => {
    const stale = { knowledge: { subs: { gone: true } } } as unknown as ChatTrackers;
    expect(settingsOf(stale)).toBeUndefined();
  });
});
