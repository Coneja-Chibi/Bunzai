/**
 * The timed feedback the UI shows after a copy or an undo (dry audit B5). Each of these used its own timer and
 * clipboard call and drifted: a second copy was cleared by the first copy's timer, a "Copied" showed for a copy
 * the browser refused, the agent's copy button skipped the legacy-copy fallback, and the undo toast restarted its
 * countdown whenever its parent re-rendered with a new callback.
 */
import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { settingsBootProblem } from "../shell/boot-error";
import { BootErrorScreen } from "../shell/BootErrorScreen";
import { CopyableBand } from "../agent/kit-bands";
import { Toast } from "./toast";
import { MacroReference } from "../apps/workbench/preset/macro-reference";
import { installDom, type InstalledDom } from "./test-dom";
import { useFlash } from "./use-flash";

let installed: InstalledDom;
beforeAll(() => { installed = installDom(undefined, { globals: { IS_REACT_ACT_ENVIRONMENT: true }, extraGlobals: ["HTMLButtonElement", "SVGElement", "Event"] }); });
afterAll(() => installed.teardown());

let root: Root | null = null;
let host: HTMLElement;
afterEach(() => {
  jest.useRealTimers();
  act(() => root?.unmount());
  host?.remove();
  root = null;
  Reflect.deleteProperty(navigator, "clipboard");
  Reflect.deleteProperty(document, "execCommand");
});
const mount = (node: React.ReactElement): void => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(node));
};
const clipboard = (writeText: (t: string) => Promise<void>): void => {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
};
const click = async (el: Element | null | undefined): Promise<void> => { await act(async () => { (el as HTMLElement).click(); }); };
const button = (text: string): HTMLButtonElement | undefined => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(text));

describe("copy flash", () => {
  test("a second copy shows for its own full 1.5 s, not what is left of the first one's", async () => {
    clipboard(async () => undefined);
    jest.useFakeTimers();
    mount(<BootErrorScreen problem={settingsBootProblem(403, "forbidden", { port: "8321" })} />);
    await click(button("Copy SSH command"));
    expect(host.textContent).toContain("SSH command copied");
    await act(async () => { jest.advanceTimersByTime(1000); });
    await click(button("SSH command copied"));
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(host.textContent).toContain("SSH command copied");
    await act(async () => { jest.advanceTimersByTime(600); });
    expect(host.textContent).toContain("Copy SSH command");
  });

  test("a copy the browser refuses is not announced as copied", async () => {
    clipboard(async () => { throw new Error("denied"); });
    document.execCommand = () => false;
    mount(<MacroReference groups={[{ name: "Identity", description: "who", macros: [{ macro: "{{char}}", description: "name" }] }] as never} />);
    await click(button("Identity"));
    await click(button("{{char}}"));
    expect(host.textContent).not.toContain("Copied");
  });

  test("a copy that works is announced, then clears itself", async () => {
    clipboard(async () => undefined);
    jest.useFakeTimers();
    mount(<MacroReference groups={[{ name: "Identity", description: "who", macros: [{ macro: "{{char}}", description: "name" }] }] as never} />);
    await click(button("Identity"));
    await click(button("{{char}}"));
    expect(host.textContent).toContain("Copied");
    await act(async () => { jest.advanceTimersByTime(1600); });
    expect(host.textContent).not.toContain("Copied");
  });

  test("the agent's copy corner uses the legacy fallback when there is no clipboard API", async () => {
    document.execCommand = () => true;
    const notices: string[] = [];
    mount(<CopyableBand className="b" text="hello" onNotice={(m) => notices.push(m)}>body</CopyableBand>);
    await click(button("copy"));
    expect(notices).toEqual(["copied"]);
  });

  test("and says so when nothing can copy", async () => {
    document.execCommand = () => false;
    const notices: string[] = [];
    mount(<CopyableBand className="b" text="hello" onNotice={(m) => notices.push(m)}>body</CopyableBand>);
    await click(button("copy"));
    expect(notices).toEqual(["could not reach the clipboard"]);
  });
});

describe("undo toast", () => {
  test("its countdown is not restarted when the parent re-renders with a new callback", async () => {
    jest.useFakeTimers();
    let dismissed = 0;
    const render = (): void => {
      act(() => root!.render(<Toast message="Edit undone" actionLabel="Redo" onAction={() => undefined} onDismiss={() => { dismissed += 1; }} />));
    };
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    render();
    for (let i = 0; i < 4; i += 1) {
      await act(async () => { jest.advanceTimersByTime(3000); });
      render();
    }
    expect(dismissed).toBe(1);
  });

  test("a new message restarts it", async () => {
    jest.useFakeTimers();
    let dismissed = 0;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    const show = (message: string): void => { act(() => root!.render(<Toast message={message} actionLabel="Redo" onAction={() => undefined} onDismiss={() => { dismissed += 1; }} />)); };
    show("one");
    await act(async () => { jest.advanceTimersByTime(7000); });
    show("two");
    await act(async () => { jest.advanceTimersByTime(7000); });
    expect(dismissed).toBe(0);
    await act(async () => { jest.advanceTimersByTime(1100); });
    expect(dismissed).toBe(1);
  });
});

describe("useFlash", () => {
  test("a newer flash replaces the last and gets its own time; clear and unmount stop the clock", async () => {
    jest.useFakeTimers();
    let api!: ReturnType<typeof useFlash<string>>;
    function Probe(): null {
      api = useFlash<string>(100);
      return null;
    }
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(<Probe />));
    act(() => api.flash("a"));
    await act(async () => { jest.advanceTimersByTime(60); });
    act(() => api.flash("b"));
    await act(async () => { jest.advanceTimersByTime(60); });
    expect(api.value).toBe("b");
    await act(async () => { jest.advanceTimersByTime(60); });
    expect(api.value).toBeNull();
    act(() => api.flash("c"));
    act(() => api.clear());
    expect(api.value).toBeNull();
    act(() => api.flash("d"));
    act(() => root!.unmount());
    root = null;
    expect(jest.getTimerCount()).toBe(0);
  });
});
