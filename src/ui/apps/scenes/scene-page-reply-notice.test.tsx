/**
 * The desktop notice for a finished reply, on the scene page itself (so removing the hook's wiring turns it red): a reply that finishes while the window is away shows "New reply from Vera"
 * and nothing of the text; a swipe, a focused window, a muted scene and a switch that is off show nothing. The scripted page is fake-scene-page-rig.ts.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { click, endsOnReply, endsOnYou, installRigDom, mount, resetRig, rig, settle, unmount, type FlushSync } from "./fake-scene-page-rig";
import { MUTED_SCENES_KEY, NOTIFY_KEY } from "./reply-notice";

const shown: { title: string; options: NotificationOptions | undefined }[] = [];
class FakeNotification {
  static permission: NotificationPermission = "granted";
  constructor(title: string, options?: NotificationOptions) { shown.push({ title, options }); }
}
const real = { notification: (globalThis as { Notification?: unknown }).Notification };
let focused = false;

beforeAll(() => {
  installRigDom();
  (globalThis as { Notification?: unknown }).Notification = FakeNotification;
  (rig.dom.window.document as { hasFocus: () => boolean }).hasFocus = () => focused;
});
afterAll(() => { (globalThis as { Notification?: unknown }).Notification = real.notification; });
beforeEach(() => { resetRig(); shown.length = 0; focused = false; FakeNotification.permission = "granted"; rig.prefs.set(NOTIFY_KEY, { desktop: true, byCharacter: {} }); });

const finish = async (flushSync: FlushSync, kind: "reply" | "swipe"): Promise<void> => {
  const label = kind === "reply" ? "Ask again for a reply" : "Regenerate as a new version";
  click(flushSync, rig.host.querySelector(`[aria-label='${label}']`)!);
  await settle(flushSync);
  flushSync(() => rig.handler!({ type: "start", turnId: "t1", kind, messageId: null }));
  flushSync(() => rig.handler!({ type: "text", delta: "A secret line the notice must not carry.", full: false } as never));
  flushSync(() => rig.handler!({ type: "done", message: endsOnReply()[2]! }));
  rig.endTurn!();
  await settle(flushSync);
};

describe("ScenePage: the reply notice", () => {
  test("a reply that finishes while the window is away shows New reply from the character, with no message text", async () => {
    const flushSync = await mount(endsOnYou());
    await finish(flushSync, "reply");
    expect(shown).toEqual([{ title: "Bunzai", options: { body: "New reply from Vera", tag: "chat1" } }]);
    unmount(flushSync);
  });

  test.each([
    ["the window has focus", () => { focused = true; }],
    ["the switch is off", () => { rig.prefs.set(NOTIFY_KEY, { desktop: false, byCharacter: {} }); }],
    ["the scene is muted", () => { rig.prefs.set(MUTED_SCENES_KEY, ["chat1"]); }],
    ["the character is muted", () => { rig.prefs.set(NOTIFY_KEY, { desktop: true, byCharacter: { vera: "muted" } }); }],
    ["permission was taken back", () => { FakeNotification.permission = "denied"; }],
  ])("no notice when %s", async (_why, arrange) => {
    arrange();
    const flushSync = await mount(endsOnYou());
    await finish(flushSync, "reply");
    expect(shown).toEqual([]);
    unmount(flushSync);
  });

  test("a new version of a reply (a swipe) is not a new reply", async () => {
    const flushSync = await mount(endsOnReply());
    await finish(flushSync, "swipe");
    expect(shown).toEqual([]);
    unmount(flushSync);
  });
});
