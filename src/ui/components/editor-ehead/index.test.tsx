/** EditorEhead: the Premiere header keeps its hooks, shows the kind kicker and deck tile only when given, and sets numbers in mono. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { EditorEhead, type EditorEheadProps } from "./index";

let installed: InstalledDom;

beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", {
    url: "http://127.0.0.1:8321/",
    globals: { IS_REACT_ACT_ENVIRONMENT: true },
  });
});

afterAll(() => installed.teardown());

function mount(props: Partial<EditorEheadProps>): HTMLElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  act(() => {
    createRoot(host).render(
      <EditorEhead mark="T" name="Test" meta="8 blocks · 7 on" dirty={false} saving={false} onSave={() => {}} {...props}>
        <span data-testid="mid">mid</span>
      </EditorEhead>,
    );
  });
  return host;
}

describe("EditorEhead", () => {
  test("defaults keep the old shape: head hook, mark, name, meta, middle, Save, no kicker, no deck", () => {
    const head = mount({}).querySelector('[data-editor="head"]');
    expect(head).not.toBeNull();
    expect(head?.getAttribute("data-deck")).toBeNull();
    expect(head?.textContent).toContain("T");
    expect(head?.textContent).toContain("Test");
    expect(head?.querySelector('[data-testid="mid"]')).not.toBeNull();
    expect(head?.textContent).toContain("Saved");
    expect(head?.children[0]?.children[1]?.children.length).toBe(2); // name + meta only
  });

  test("kind renders the kicker and deck sets the tile hook", () => {
    const head = mount({ kind: "Preset", deck: "preset" }).querySelector('[data-editor="head"]');
    expect(head?.getAttribute("data-deck")).toBe("preset");
    expect(head?.textContent).toContain("Preset");
  });

  test("digit runs in string and fragment meta are wrapped, words are not", () => {
    const head = mount({ meta: <>12 entries · <b>rules</b></> }).querySelector('[data-editor="head"]');
    const nums = [...(head?.querySelectorAll("span span, span > span") ?? [])].map((n) => n.textContent);
    expect(nums).toContain("12");
    expect(nums).not.toContain("entries");
    expect(head?.querySelectorAll("b")[1]?.textContent).toBe("rules");
  });

  test("an editable name stays an input wired to onNameChange", () => {
    const head = mount({ onNameChange: () => {}, nameAriaLabel: "Preset name" }).querySelector('[data-editor="head"]');
    expect(head?.querySelector("input")?.getAttribute("aria-label")).toBe("Preset name");
  });
});
