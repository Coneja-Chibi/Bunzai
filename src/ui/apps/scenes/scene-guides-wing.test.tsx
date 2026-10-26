/** The Guides tab windows each category's rows: a 500-guide library mounts a few of them. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { GuideRecord } from "../../../core/guide-record";
import { expectWindowed, flushTasks, installDom, type InstalledDom } from "../../_shared/test-dom";
import { SceneGuidesWing } from "./scene-guides-wing";
import type { ScenePrompting } from "./use-scene-prompting";

let installed: InstalledDom;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { observers: true, pretendToBeVisual: true, globals: { IS_REACT_ACT_ENVIRONMENT: true } }); });
afterAll(() => installed.teardown());

const guides = Array.from({ length: 500 }, (_, i) => ({ id: `g${String(i)}`, title: `Guide ${String(i)}`, content: "c", category: "situational", mode: "standard", visible: true, createdAt: 0, updatedAt: 0 }) as unknown as GuideRecord);
const prompting = { library: { state: "ready", guides }, reload: () => undefined, save: async () => guides[0]!, remove: async () => undefined, patch: async () => undefined, setGuide: async () => undefined } as unknown as ScenePrompting;

describe("SceneGuidesWing", () => {
  test("500 guides in one category mount fewer than 60 rows", async () => {
    const host = installed.dom.window.document.createElement("div");
    installed.dom.window.document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<SceneGuidesWing prompting={prompting} on={[]} />); });
    await act(async () => { await flushTasks(6); });
    expectWindowed(host, ".pg-row", 500, 60);
    await act(async () => { root.unmount(); });
  });
});
