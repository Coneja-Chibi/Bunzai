/**
 * The personality picker wears RoleCall's portraits (DMPersonalitySelector.tsx PersonalityAvatar): the eight personalities RoleCall has a
 * picture for show it, from the shipped docs media; the Architect and the Oracle, which RoleCall has none for, show their initials; and a
 * portrait that fails to load falls back to the initials rather than a broken picture.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PERSONALITIES, personalityOf } from "../../../../../core/director/personalities";
import { installDom } from "../../../../_shared/test-dom";
import { PORTRAITS, PersonalityPicker, initialsOf } from "./personality-picker";

const installed = installDom(undefined, {
  extraGlobals: ["HTMLImageElement", "SVGElement", "Event"],
  globals: { IS_REACT_ACT_ENVIRONMENT: true },
});
afterAll(() => installed.teardown());

let root: Root | null = null;
let host: HTMLElement | null = null;
function mount(value: string): HTMLElement {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<PersonalityPicker value={value as never} onPick={() => undefined} />));
  return host;
}
function unmount(): void { act(() => root?.unmount()); host?.remove(); }

describe("PersonalityPicker portraits", () => {
  test("every personality RoleCall has a picture for is listed with its file, and the Architect and the Oracle are not", () => {
    expect(Object.keys(PORTRAITS).sort()).toEqual(["the-balanced", "the-chronicler", "the-enigma", "the-jester", "the-romantic", "the-shadow", "the-thrill-seeker", "the-weaver"]);
    expect(PERSONALITIES.map((p) => p.id)).toEqual(expect.arrayContaining([...Object.keys(PORTRAITS), "the-architect", "the-oracle"]));
  });

  test("the chosen narrator's tile is its portrait, from the docs media route", () => {
    const m = mount("the-jester");
    const img = m.querySelector<HTMLImageElement>(".dp-card .dp-av img")!;
    expect(img.getAttribute("src")).toContain(encodeURIComponent("docs/media/dm-personalities/jester.png"));
    expect(img.alt).toBe(personalityOf("the-jester").name);
    unmount();
  });

  test("a personality with no picture shows its initials", () => {
    const m = mount("the-architect");
    expect(m.querySelector(".dp-card .dp-av img")).toBeNull();
    expect(m.querySelector(".dp-card .dp-av [role=img]")?.textContent).toBe(initialsOf(personalityOf("the-architect").name));
    unmount();
  });

  test("a portrait that fails to load falls back to the initials", () => {
    const m = mount("the-jester");
    const img = m.querySelector<HTMLImageElement>(".dp-card .dp-av img")!;
    act(() => { img.dispatchEvent(new window.Event("error")); });
    expect(m.querySelector(".dp-card .dp-av img")).toBeNull();
    expect(m.querySelector(".dp-card .dp-av [role=img]")?.textContent).toBe(initialsOf(personalityOf("the-jester").name));
    unmount();
  });

  test("the opened list shows a portrait tile for each personality that has one and initials for the rest", () => {
    const m = mount("the-balanced");
    act(() => { m.querySelector<HTMLButtonElement>(".dp-card")!.click(); });
    const options = [...m.querySelectorAll(".dp-opt")];
    expect(options).toHaveLength(PERSONALITIES.length);
    expect(options.filter((o) => o.querySelector(".dp-av img")).length).toBe(Object.keys(PORTRAITS).length);
    expect(options.filter((o) => o.querySelector(".dp-av [role=img]")).length).toBe(PERSONALITIES.length - Object.keys(PORTRAITS).length);
    unmount();
  });
});
