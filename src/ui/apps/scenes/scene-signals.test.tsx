/**
 * The scene page's published signals: the take's version and whether a turn is answering, heard only when one changes, and nothing is published before the page has a scene.
 */
import { afterAll, beforeAll, expect, test } from "bun:test";
import type { ReactElement } from "react";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { mounted } from "./props/story-director/fake-director-ui-rig";
import { publishSceneSignals, usePublishSceneSignals, useSceneSignals } from "./scene-signals";

let installed: InstalledDom;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8342/", extraGlobals: ["Event", "HTMLElement"] }); });
afterAll(() => installed.teardown());

function Page({ version, running }: { version: number | undefined; running: boolean }): ReactElement {
  usePublishSceneSignals("sig-chat", version, running);
  const heard = useSceneSignals("sig-chat");
  return <span data-part="heard">{`${heard.version}:${String(heard.running)}`}</span>;
}

test("the page publishes its version and running state, and a panel hears each change", async () => {
  const m = await mounted(installed.dom, <Page version={undefined} running={false} />);
  const heard = (): string => m.host.querySelector("[data-part=heard]")!.textContent!;
  expect(heard()).toBe("0:false"); // no scene yet: nothing published
  await m.rerender(<Page version={4} running={false} />);
  expect(heard()).toBe("4:false");
  await m.rerender(<Page version={4} running={true} />);
  expect(heard()).toBe("4:true");
  publishSceneSignals("sig-chat", { version: 5, running: false });
  await m.tick();
  expect(heard()).toBe("5:false");
  m.unmount();
});
