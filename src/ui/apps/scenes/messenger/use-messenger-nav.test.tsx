/** A program asked for by id from elsewhere on the page (a chip under a reply opens Trackers, program-open.ts) opens it; an id that is not a program is ignored; the door closes with the Messenger. */
import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { installDom, type InstalledDom } from "../../../_shared/test-dom";
import { mounted } from "../props/story-director/fake-director-ui-rig";
import { openProgram } from "./program-open";
import type { Program } from "./programs";
import { useMessengerNav } from "./use-messenger-nav";

let installed: InstalledDom;
let dom: JSDOM;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8354/", extraGlobals: ["SVGElement", "Event", "CustomEvent"] }); dom = installed.dom; });
afterAll(() => installed.teardown());
beforeEach(() => installed.reinstall());

const PROGRAMS: Program[] = [{ id: "quickplay", wing: "booth", title: "Control Booth", icon: "lucide:zap" }, { id: "trackers", wing: "props", title: "Trackers", icon: "lucide:list" }];
const Probe = () => <i data-open={useMessengerNav(PROGRAMS, null).openId ?? ""} />;

test("openProgram opens that program, ignores an id that is not one, and stops listening once the Messenger is gone", async () => {
  const m = await mounted(dom, <Probe />);
  const open = (): string => m.host.querySelector("i")!.getAttribute("data-open")!;
  expect(open()).toBe("");
  m.flush(() => openProgram("nope"));
  expect(open()).toBe("");
  m.flush(() => openProgram("trackers"));
  expect(open()).toBe("trackers");
  m.unmount();
  openProgram("quickplay");
});
