/**
 * The button family's section 2 and section 1 additions, through their public contract: each part is a real <button>
 * carrying data-control, exposes its state to assistive tech (selected, checked, expanded, current, switch), keeps
 * per-item data in named props, and calls back with the right value (dropped files, toggled state, a close that does
 * not also select).
 */
import { afterAll, beforeAll, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { ReactElement } from "react";
import { installDom, type InstalledDom } from "../../_shared/test-dom";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8325/", extraGlobals: ["KeyboardEvent", "MouseEvent", "Event"] });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

async function mount(node: ReactElement): Promise<HTMLElement> {
  const [{ flushSync }, { createRoot }] = await Promise.all([import("react-dom"), import("react-dom/client")]);
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  flushSync(() => createRoot(host).render(node));
  return host;
}

test("ListRow: label and subtitle, a selected mark, an option tick, a picker chevron, and depth as data", async () => {
  const { ListRow } = await import("./index");
  const host = await mount(<>
    <ListRow label="Characters" subtitle="Your cast" meta={4} selected accent="var(--deck-character)" aria-current="true" />
    <ListRow variant="option" label="Narrator bank" selected role="option" aria-selected="true" />
    <ListRow variant="picker" label="GPT-5 mini" />
    <ListRow variant="tree" depth={2} label="Canal District" />
  </>);
  const [row, option, picker, tree] = [...host.querySelectorAll("button")];
  expect(row!.dataset.control).toBe("row");
  expect(row!.hasAttribute("data-selected")).toBe(true);
  expect(row!.textContent).toBe("CharactersYour cast4");
  expect(row!.style.getPropertyValue("--row-accent")).toBe("var(--deck-character)");
  expect(option!.querySelector("svg")).not.toBeNull();
  expect(picker!.querySelector("svg")).not.toBeNull();
  expect(tree!.style.getPropertyValue("--row-depth")).toBe("2");
  expect(host.querySelectorAll("button")[2]!.hasAttribute("data-selected")).toBe(false);
});

test("MenuItem is a menuitem by default; a checkable item reports aria-checked; danger is marked", async () => {
  const { MenuItem } = await import("./index");
  const host = await mount(<>
    <MenuItem icon="lucide:pencil" hint="E">Edit</MenuItem>
    <MenuItem role="menuitemradio" checked>Newest first</MenuItem>
    <MenuItem danger>Delete message</MenuItem>
  </>);
  const [edit, newest, del] = [...host.querySelectorAll("button")];
  expect(edit!.getAttribute("role")).toBe("menuitem");
  expect(edit!.hasAttribute("aria-checked")).toBe(false);
  expect(newest!.getAttribute("role")).toBe("menuitemradio");
  expect(newest!.getAttribute("aria-checked")).toBe("true");
  expect(del!.dataset.control).toBe("menuitem");
  expect(del!.dataset.tone).toBe("danger");
  expect(edit!.hasAttribute("data-tone")).toBe(false);
});

test("Disclosure reports aria-expanded and shows its summary", async () => {
  const { Disclosure } = await import("./index");
  const host = await mount(<Disclosure open={false} label="Sampling" summary="temp 0.9" />);
  const fold = host.querySelector("button")!;
  expect(fold.getAttribute("aria-expanded")).toBe("false");
  expect(fold.textContent).toBe("Samplingtemp 0.9");
});

test("Tile: a swatch carries its color, an app tile shows its caption, the rest are named by label", async () => {
  const { Tile } = await import("./index");
  const host = await mount(<>
    <Tile kind="swatch" label="Rose" color="var(--premiere-rose)" selected />
    <Tile kind="app" label="Library" icon="lucide:book-open" />
    <Tile kind="add" label="Add a sprite" />
  </>);
  const [swatch, app, add] = [...host.querySelectorAll("button")];
  expect(swatch!.getAttribute("aria-label")).toBe("Rose");
  expect(swatch!.style.getPropertyValue("--tile-color")).toBe("var(--premiere-rose)");
  expect(swatch!.hasAttribute("data-selected")).toBe(true);
  expect(app!.textContent).toBe("Library");
  expect(app!.hasAttribute("aria-label")).toBe(false);
  expect(add!.getAttribute("aria-label")).toBe("Add a sprite");
  expect(add!.querySelector("svg")).not.toBeNull();
});

test("Card: a picked choice shows its mark, an entry shows its kicker, a drop card hands over the dropped files", async () => {
  const { Card } = await import("./index");
  const got: File[][] = [];
  const host = await mount(<>
    <Card kind="choice" heading="Full Chat" subtitle="Your workspace" selected />
    <Card kind="choice" heading="Messenger" />
    <Card kind="entry" kicker="Your collection" heading="Characters" art={<i />} />
    <Card kind="drop" onFiles={(f) => got.push(f)}>Drop art here</Card>
  </>);
  const [picked, other, entry, drop] = [...host.querySelectorAll("button")];
  expect(picked!.textContent).toBe("PickedFull ChatYour workspace");
  expect(other!.textContent).toBe("Messenger");
  expect(entry!.textContent).toBe("Your collectionCharacters");
  const file = new dom.window.File(["x"], "art.png", { type: "image/png" });
  const event = new dom.window.Event("drop", { bubbles: true, cancelable: true }) as Event & { dataTransfer: unknown };
  Object.defineProperty(event, "dataTransfer", { value: { files: [file] } });
  const { flushSync } = await import("react-dom");
  flushSync(() => { drop!.dispatchEvent(event); });
  expect(got.map((list) => list.map((f) => f.name))).toEqual([["art.png"]]);
});

test("Dot: always named, and a pager dot reports aria-current", async () => {
  const { Dot } = await import("./index");
  const host = await mount(<><Dot label="Version 2" current /><Dot kind="port" label="Link a lorebook" color="var(--deck-lorebook)" /></>);
  const [pager, port] = [...host.querySelectorAll("button")];
  expect(pager!.getAttribute("aria-label")).toBe("Version 2");
  expect(pager!.getAttribute("aria-current")).toBe("true");
  expect(port!.hasAttribute("aria-current")).toBe(false);
  expect(port!.style.getPropertyValue("--dot-color")).toBe("var(--deck-lorebook)");
});

test("Toggle is a switch: it reports on, off and mixed, flips on click, and an isolated toggle keeps the click", async () => {
  const { Toggle } = await import("./index");
  const flips: boolean[] = [];
  let rowClicks = 0;
  const host = await mount(<div onClick={() => rowClicks++}>
    <Toggle on={false} onChange={(v) => flips.push(v)} aria-label="Main prompt" />
    <Toggle on={false} mixed onChange={(v) => flips.push(v)} isolate aria-label="Group" />
  </div>);
  const [plain, mixed] = [...host.querySelectorAll("button")];
  expect(plain!.getAttribute("role")).toBe("switch");
  expect(plain!.getAttribute("aria-checked")).toBe("false");
  expect(mixed!.getAttribute("aria-checked")).toBe("mixed");
  plain!.click();
  mixed!.click();
  expect(flips).toEqual([true, true]);
  expect(rowClicks).toBe(1);
});

test("InlineValue and Scrim: plain buttons that keep their text, and a named click-away", async () => {
  const { InlineValue, Scrim } = await import("./index");
  const host = await mount(<><InlineValue title="Click to type a value">0.9</InlineValue><Scrim label="Close the wing" /></>);
  const [value, scrim] = [...host.querySelectorAll("button")];
  expect(value!.textContent).toBe("0.9");
  expect(value!.dataset.control).toBe("inline");
  expect(scrim!.getAttribute("aria-label")).toBe("Close the wing");
});

test("Section 1 additions: a menu button announces its popup, a fab is still named, a chip shows its count", async () => {
  const { Button, IconButton, Chip } = await import("./index");
  const host = await mount(<><Button menu>Prompt order</Button><Button variant="link">Open the full editor</Button><IconButton size="fab" label="Story Director" icon="lucide:sparkles" /><Chip pressed count={12}>Keys</Chip></>);
  const [menu, link, fab, chip] = [...host.querySelectorAll("button")];
  expect(menu!.getAttribute("aria-haspopup")).toBe("menu");
  expect(link!.hasAttribute("aria-haspopup")).toBe(false);
  expect(fab!.getAttribute("aria-label")).toBe("Story Director");
  expect(chip!.textContent).toBe("Keys12");
});

test("vertical Tabs move with the up and down arrows", async () => {
  const { Tabs } = await import("./index");
  let value = "chats" as "chats" | "lore" | "settings";
  const host = await mount(<Tabs orientation="vertical" label="Messenger" items={[{ value: "chats", label: "C", title: "Chats" }, { value: "lore", label: "L", title: "Lore" }, { value: "settings", label: "S", title: "Settings" }]} value={value} onChange={(v) => { value = v; }} />);
  expect(host.querySelector("[role=tablist]")!.getAttribute("aria-orientation")).toBe("vertical");
  host.querySelector<HTMLButtonElement>("[role=tab]")!.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  expect(value).toBe("lore");
});

test("DocTab selects on click, and its close mark closes without selecting", async () => {
  const { DocTab } = await import("./index");
  const log: string[] = [];
  const host = await mount(<DocTab selected kind="SET" accent="var(--deck-preset)" onClick={() => log.push("select")} onClose={() => log.push("close")}>Test preset</DocTab>);
  const tab = host.querySelector("button")!;
  expect(tab.getAttribute("aria-selected")).toBe("true");
  expect(tab.style.getPropertyValue("--doctab-accent")).toBe("var(--deck-preset)");
  (host.querySelector("[aria-label=Close]") as HTMLElement).click();
  tab.click();
  expect(log).toEqual(["close", "select"]);
});

test("a Segmented option carries its own tone, and a muted Chip is marked", async () => {
  const { Segmented, Chip } = await import("./index");
  const host = await mount(<><Segmented label="Rating" value="mature" onChange={() => undefined} items={[{ value: "all-ages", label: "All ages", tone: "var(--stage-ok)" }, { value: "mature", label: "Mature", tone: "var(--stage-warn)" }]} /><Chip muted>Prose pass</Chip><Chip>Pacing pass</Chip></>);
  const [ages, mature, muted, plain] = [...host.querySelectorAll("button")];
  expect(ages!.style.getPropertyValue("--seg-tone")).toBe("var(--stage-ok)");
  expect(mature!.getAttribute("aria-pressed")).toBe("true");
  expect(muted!.hasAttribute("data-muted")).toBe(true);
  expect(plain!.hasAttribute("data-muted")).toBe(false);
});
