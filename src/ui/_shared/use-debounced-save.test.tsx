/** useDebouncedSave: the one timer + flush + flush-on-unmount skeleton behind the scene wings' autosaves (dry audit A3). */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom, type InstalledDom } from "./test-dom";
import { useDebouncedSave, type DebouncedSave } from "./use-debounced-value";

let installed: InstalledDom;
beforeAll(() => { installed = installDom(undefined, { globals: { IS_REACT_ACT_ENVIRONMENT: true } }); });
afterAll(() => installed.teardown());

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface Rig { saver: () => DebouncedSave<string>; unmount(): Promise<void> }
async function rig(save: (v: string) => void | Promise<void>, onError?: (e: unknown) => void, delay = 20): Promise<Rig> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root: Root = createRoot(host);
  let saver!: DebouncedSave<string>;
  function Probe(): null {
    saver = useDebouncedSave<string>(save, delay, onError);
    return null;
  }
  await act(async () => root.render(<Probe />));
  return { saver: () => saver, unmount: async () => { await act(async () => root.unmount()); host.remove(); } };
}

describe("useDebouncedSave", () => {
  test("saves the last value once, after it rests", async () => {
    const saved: string[] = [];
    const r = await rig((v) => { saved.push(v); });
    r.saver().push("a");
    r.saver().push("b");
    expect(saved).toEqual([]);
    expect(r.saver().pending()).toBe("b");
    await wait(60);
    expect(saved).toEqual(["b"]);
    expect(r.saver().pending()).toBeUndefined();
    await r.unmount();
    expect(saved).toEqual(["b"]);
  });

  test("leaving inside the delay still saves the queued value", async () => {
    const saved: string[] = [];
    const r = await rig((v) => { saved.push(v); }, undefined, 5_000);
    r.saver().push("kept");
    await r.unmount();
    expect(saved).toEqual(["kept"]);
  });

  test("flush saves now and cancel forgets everything, including a value still being sent", async () => {
    const saved: string[] = [];
    let release!: () => void;
    const r = await rig((v) => { saved.push(v); return new Promise<void>((done) => { release = done; }); }, undefined, 5_000);
    r.saver().push("one");
    r.saver().flush();
    expect(saved).toEqual(["one"]);
    expect(r.saver().pending()).toBe("one");
    r.saver().cancel();
    expect(r.saver().pending()).toBeUndefined();
    r.saver().push("two");
    r.saver().cancel();
    await r.unmount();
    expect(saved).toEqual(["one"]);
    release();
  });

  test("a value in flight stays pending until it settles", async () => {
    let release!: () => void;
    const r = await rig(() => new Promise<void>((done) => { release = done; }), undefined, 5_000);
    r.saver().push("x");
    r.saver().flush();
    expect(r.saver().pending()).toBe("x");
    release();
    await wait(5);
    expect(r.saver().pending()).toBeUndefined();
    await r.unmount();
  });

  test("a failed save reaches onError, including one sent as the owner goes away", async () => {
    const errors: string[] = [];
    const r = await rig(async () => { throw new Error("offline"); }, (e) => { errors.push((e as Error).message); }, 5_000);
    r.saver().push("a");
    r.saver().flush();
    await wait(5);
    r.saver().push("b");
    await r.unmount();
    await wait(5);
    expect(errors).toEqual(["offline", "offline"]);
  });

  test("a sync throw is reported the same way", async () => {
    const errors: string[] = [];
    const r = await rig(() => { throw new Error("sync"); }, (e) => { errors.push((e as Error).message); }, 5_000);
    r.saver().push("a");
    r.saver().flush();
    expect(errors).toEqual(["sync"]);
    await r.unmount();
  });

  test("the newest save closure is the one called", async () => {
    const calls: string[] = [];
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    let saver!: DebouncedSave<string>;
    function Probe({ tag }: { tag: string }): null {
      saver = useDebouncedSave<string>((v) => { calls.push(`${tag}:${v}`); }, 5_000);
      return null;
    }
    await act(async () => root.render(<Probe tag="old" />));
    saver.push("v");
    await act(async () => root.render(<Probe tag="new" />));
    await act(async () => root.unmount());
    expect(calls).toEqual(["new:v"]);
  });
});
