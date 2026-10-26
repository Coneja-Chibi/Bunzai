/**
 * The Trackers panel's rules and the programs it adds, without a render: which Props count as trackers, the header line, the one Trackers program replacing sixteen, and the Messenger
 * Director kind keeping the original kind's id.
 */
import { describe, expect, test } from "bun:test";
import { sceneProps } from "../../../props/registry";
import { directorPanelPopout } from "../../../props/story-director/director-panel";
import { hasOwnProgram, messengerKind, trackersProgram } from "../index";
import { isOpenable, isTrackerProp, moduleOf, trackersOn, trackersSummary } from "./trackers-core";

const props = sceneProps();

describe("trackers-core", () => {
  test("a tracker is a Prop with the tracker prefix; the module is the rest of the id", () => {
    const inv = props.find((p) => p.id === "tracker-inventory")!;
    expect(isTrackerProp(inv)).toBe(true);
    expect(moduleOf(inv)).toBe("inventory");
    expect(isTrackerProp(props.find((p) => p.id === "story-director")!)).toBe(false);
  });

  test("the 12 legacy trackers and the 4 storyboards are all openable; Calendar is not a Prop", () => {
    const trackers = props.filter(isTrackerProp);
    expect(trackers.length).toBe(16);
    expect(trackers.every(isOpenable)).toBe(true);
  });

  test("trackersOn keeps the registry order and only what is on", () => {
    expect(trackersOn(props, ["tracker-party", "tracker-inventory", "story-director", "tracker-nothing"])).toEqual(props.map((p) => p.id).filter((id) => id === "tracker-inventory" || id === "tracker-party"));
    expect(trackersOn(props, null)).toEqual([]);
  });

  test("the summary names the update cadence only while the Director updates them", () => {
    expect(trackersSummary(5, null)).toBe("5 on");
    expect(trackersSummary(5, { on: false, autoUpdate: true, every: 2 })).toBe("5 on");
    expect(trackersSummary(5, { on: true, autoUpdate: false, every: 2 })).toBe("5 on");
    expect(trackersSummary(5, { on: true, autoUpdate: true, every: 2 })).toBe("5 on · Story Director updates every 2 replies");
    expect(trackersSummary(1, { on: true, autoUpdate: true, every: 1 })).toBe("1 on · Story Director updates every reply");
  });
});

describe("the programs", () => {
  test("trackers that are on become ONE program, and none while none is on", () => {
    expect(trackersProgram(props, ["tracker-party", "tracker-inventory"]).map((p) => p.id)).toEqual(["trackers"]);
    expect(trackersProgram(props, ["story-director"])).toEqual([]);
  });

  test("the same set gives the same kind, a changed set a new one with the same id", () => {
    const a = trackersProgram(props, ["tracker-party"])[0]!.panel;
    expect(trackersProgram(props, ["tracker-party"])[0]!.panel).toBe(a);
    const b = trackersProgram(props, ["tracker-party", "tracker-inventory"])[0]!.panel;
    expect(b).not.toBe(a);
    expect(b.id).toBe(a.id);
  });

  test("a tracker has no program of its own, the Director has one", () => {
    expect(hasOwnProgram(props.find((p) => p.id === "tracker-party")!)).toBe(false);
    expect(hasOwnProgram(props.find((p) => p.id === "story-director")!)).toBe(true);
  });

  test("the Messenger Director kind keeps the id, title and noun, draws differently, and is the same object each time", () => {
    const k = messengerKind(directorPanelPopout);
    expect(k.id).toBe(directorPanelPopout.id);
    expect(k.noun).toBe(directorPanelPopout.noun);
    expect(k.render).not.toBe(directorPanelPopout.render);
    expect(messengerKind(directorPanelPopout)).toBe(k);
  });
});
