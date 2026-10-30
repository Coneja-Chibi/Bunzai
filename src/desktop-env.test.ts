/**
 * The Linux environ detach. A child process does what libgtk-4 does as it loads (unsetenv the launcher
 * variables, or really load libgtk-4 where it is installed) and then starts a Worker: with the detach
 * the Worker runs. Without it Bun 1.3 segfaults - remove the detach from the probe to see it go red.
 */
import { expect, test } from "bun:test";
import { join } from "node:path";
import { detachEnvironFromGtk, detachVarName } from "./desktop-env";

const PROBE = join(import.meta.dir, "..", "scripts", "probe-desktop-env.ts");
const LAUNCHED = { XDG_ACTIVATION_TOKEN: "token", DESKTOP_STARTUP_ID: "startup", DESKTOP_AUTOSTART_ID: "autostart" };

const probe = (...args: string[]): string =>
  Bun.spawnSync([process.execPath, PROBE, ...args], { env: { ...process.env, ...LAUNCHED }, timeout: 30_000 }).stdout.toString().trim();

// Asked of a child: loading libgtk-4 here would unset the launcher variables in THIS runner and crash
// the next test file's Worker - the very bug under test.
const gtkLoadable = process.platform === "linux" && probe("--has-gtk") === "gtk";

test("nothing is touched off Linux", () => {
  expect(detachEnvironFromGtk("win32")).toBe(false);
  expect(detachEnvironFromGtk("darwin")).toBe(false);
});

test("the detach variable is always a NEW name, since replacing one in place moves nothing", () => {
  expect(detachVarName({}, 42)).toBe("BUNZAI_ENVIRON_DETACHED_42");
  expect(detachVarName({ BUNZAI_ENVIRON_DETACHED_42: "1" }, 42)).toBe("BUNZAI_ENVIRON_DETACHED_42_");
});

test.if(process.platform === "linux")("a detach variable inherited from a parent Bunzai does not switch the fix off", () => {
  // A fixed name inherited from the parent would be replaced in place and move nothing.
  const inherited = Bun.spawnSync([process.execPath, PROBE, "--detach"], {
    env: { ...process.env, ...LAUNCHED, BUNZAI_ENVIRON_DETACHED: "1" },
    timeout: 30_000,
  });
  expect(inherited.stdout.toString().trim()).toBe("worker ok");
});

test.if(process.platform === "linux")("after the detach, unsetting every launcher variable leaves Workers starting", () => {
  expect(probe("--detach")).toBe("worker ok");
});

test.if(gtkLoadable)("after the detach, the real libgtk-4 load leaves Workers starting", () => {
  expect(probe("--detach", "--gtk")).toBe("worker ok");
});
