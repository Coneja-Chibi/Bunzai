/**
 * The World wing's Lorebook tab at each state RoleCall's screenshots show (rc-world-1 to rc-world-7):
 * no books, one book unpicked, a book open, an entry open, advanced settings open; the book list's
 * own switches, the two ways to add a book, the shared writer with the Control Booth, and a 213-entry
 * book that mounts a window of rows rather than all of them. The entry editor's writes and the saves
 * are in scene-lore-editor.test.tsx and scene-lore-entries.test.tsx.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createElement } from "react";
import { expectWindowed } from "../../_shared/test-dom";
import {
  bodyOf, bookRow, BOOKS, byLabel, byText, entry, entryRow, installLoreDom, loreCtx, mountWing, openBook, openEntry, press, pressKey, q, qa, rig, resetLore, settle, text, typeInto, unmount, waitFor,
} from "./fake-lore-rig";

beforeAll(installLoreDom);
afterAll(() => rig.installed?.teardown());
beforeEach(() => resetLore());

describe("no lorebooks (rc-world-1)", () => {
  test("shows RoleCall's empty states and header", async () => {
    rig.books = [];
    const flushSync = await mountWing();
    expect(q(".wl-t")!.textContent).toBe("World Info");
    expect(q(".wl-st")!.textContent).toBe("· 0 books · 0 entries · 0 tok");
    expect(q(".wl-bh")!.textContent).toBe("Active lorebooks0");
    expect(text()).toContain("No lorebooks");
    expect(text()).toContain("Add one to begin");
    expect(text()).toContain("No lorebooks linked");
    expect(text()).toContain("Use the library icon to add one");
    expect(byLabel("Browse / add lorebooks")).not.toBeNull();
    expect(byText("button", "Add Lorebook")).toBeDefined();
    unmount(flushSync);
  });
});

describe("one book linked, none picked (rc-world-2)", () => {
  test("lists the book and asks for a pick, without opening one on its own", async () => {
    rig.books = [BOOKS[0]!];
    const flushSync = await mountWing();
    expect(q(".wl-st")!.textContent).toBe("· 1 book · 2 entries · 200 tok");
    expect(text()).toContain("Pick a lorebook");
    expect(text()).toContain("Choose one on the left to edit its entries");
    expect(bookRow("Keeper's Log")!.textContent).toContain("2");
    expect(bookRow("Keeper's Log")!.textContent).toContain("From Marguerite Vane");
    expect(rig.loads).toEqual([]);
    unmount(flushSync);
  });

  test("a large book reads in thousands: 92.6k", async () => {
    rig.books = [{ ...BOOKS[0]!, entries: 213, tokens: 92_600 }];
    const flushSync = await mountWing();
    expect(q(".wl-st")!.textContent).toBe("· 1 book · 213 entries · 92.6k tok");
    unmount(flushSync);
  });
});

describe("a book open (rc-world-3)", () => {
  test("the header swaps to back plus the book, and the list splits into Constant and Selective", async () => {
    const flushSync = await mountWing();
    await openBook(flushSync);
    expect(q(".wl-t")!.textContent).toBe("Keeper's Log");
    expect(q(".wl-st")!.textContent).toMatch(/^· 2 entries · \d+ tok$/);
    expect(byLabel("Back to lorebooks")).not.toBeNull();
    expect(q(".wl-books")).toBeNull();
    expect(byLabel("New entry")).not.toBeNull();
    expect(byLabel("Open full editor")).not.toBeNull();
    expect(q<HTMLInputElement>('input[type="search"]')!.placeholder).toBe("Search entries, text, or triggers...");
    expect(qa("[data-part='scene.lore.group-head']").map((h) => h.textContent)).toEqual(["Constant1", "Selective1"]);
    expect(text()).toContain("Select an Entry");
    expect(text()).toContain("Pick one from the list to edit its content, triggers, and placement.");
    expect(rig.loads).toEqual(["b1"]);
    unmount(flushSync);
  });

  test("Back returns to the book list", async () => {
    const flushSync = await mountWing();
    await openBook(flushSync);
    await press(flushSync, byLabel("Back to lorebooks"));
    await waitFor(flushSync, () => q(".wl-books"), "the book list");
    expect(q(".wl-t")!.textContent).toBe("World Info");
    unmount(flushSync);
  });

  test("an empty book offers its first entry", async () => {
    rig.held.get("b1")!.entity.body.entries = [];
    const flushSync = await mountWing();
    await openBook(flushSync);
    expect(text()).toContain("Empty Lorebook");
    expect(text()).toContain("Add an entry to start feeding world details into the scene.");
    expect(byText("button", "Add your first entry")).toBeDefined();
    expect(text()).toContain("This lorebook is empty.");
    unmount(flushSync);
  });

  test("the search box narrows the list, says when nothing matches, and Clear brings everything back", async () => {
    rig.held.get("b1")!.entity.body.entries = [entry("a1", { title: "Harbour", content: "salt and tar", triggers: [{ keyword: "dock", isRegex: false }] }), entry("a2", { title: "Lamp", content: "oil", triggers: [{ keyword: "wick", isRegex: false }] })];
    const flushSync = await mountWing();
    await openBook(flushSync);
    const search = q('input[type="search"]')!;
    typeInto(flushSync, search, "TAR"); // the match rules are lore-core.test.ts; this proves the box is wired to them
    expect(qa(".wl-en-n").map((n) => n.textContent)).toEqual(["Harbour"]);
    typeInto(flushSync, search, "nothing like it");
    expect(text()).toContain("No matching entries");
    await press(flushSync, byText("button", "Clear search"));
    expect(qa(".wl-en-n").map((n) => n.textContent).sort()).toEqual(["Harbour", "Lamp"]);
    unmount(flushSync);
  });

  test("a group header collapses its entries", async () => {
    const flushSync = await mountWing();
    await openBook(flushSync);
    expect(entryRow("The storm")).toBeDefined();
    await press(flushSync, byText("[data-part='scene.lore.group-head']", "Selective"));
    expect(entryRow("The storm")).toBeUndefined();
    expect(entryRow("always1")).toBeDefined();
    unmount(flushSync);
  });

  test("a 213-entry book mounts a window of rows, not all of them", async () => {
    const many = Array.from({ length: 213 }, (_, i) => entry(`e${i}`, { title: `Entry ${i}`, constant: i < 5, sortOrder: i }));
    rig.held.get("b1")!.entity.body.entries = many;
    rig.books = [{ ...BOOKS[0]!, entries: 213, tokens: 75_000 }];
    const flushSync = await mountWing();
    await openBook(flushSync);
    expectWindowed(rig.host, ".wl-en", 213, 40);
    expect(qa("[data-part='scene.lore.group-head']").map((h) => h.textContent)).toEqual(["Constant5", "Selective208"]);
    expect(entryRow("Entry 212")).toBeUndefined(); // the last row is far below the window
    unmount(flushSync);
  });
});

describe("an entry open (rc-world-4)", () => {
  test("title, switch, keys, content, macros row, tokens and the Show advanced card", async () => {
    const flushSync = await mountWing();
    await openBook(flushSync);
    await openEntry(flushSync, "The storm");
    expect(q<HTMLInputElement>('input[aria-label="Entry title"]')!.value).toBe("The storm");
    expect(q('[role="switch"]')!.getAttribute("aria-checked")).toBe("true");
    expect(qa(".wl-ch").map((c) => c.textContent)).toEqual(["storm"]);
    expect(q(".wl-ch [aria-label='Remove storm']")).not.toBeNull();
    expect(q<HTMLTextAreaElement>("textarea.wl-ta")!.value).toBe("content-key1");
    expect(q(".wl-mac")!.textContent).toContain("{{user}}{{char}}macros");
    expect(q(".wl-mac .tk")!.textContent).toMatch(/^~\d+ tokens$/);
    const card = q("[data-part='scene.lore.advanced']")!;
    expect(card.textContent).toContain("Show advanced settings");
    expect(card.textContent).toContain("Order, timing, injection position, filters, and the rest of the machinery.");
    expect(q(".wl-ord")).toBeNull();
    expect(q(".wl-fx")).toBeNull();
    expect(byLabel("Close this entry panel")).not.toBeNull();
    unmount(flushSync);
  });

  test("the close button returns to the placeholder", async () => {
    const flushSync = await mountWing();
    await openBook(flushSync);
    await openEntry(flushSync, "The storm");
    await press(flushSync, byLabel("Close this entry panel"));
    expect(q(".wl-e")).toBeNull();
    expect(text()).toContain("Select an Entry");
    unmount(flushSync);
  });
});

describe("advanced settings open (rc-world-5 and 7)", () => {
  test("the card opens Order, Scan, the injection cards and the filter, and stays open on the next entry", async () => {
    const flushSync = await mountWing();
    await openBook(flushSync);
    await openEntry(flushSync, "The storm");
    await press(flushSync, q("[data-part='scene.lore.advanced']"));
    expect(q("[data-part='scene.lore.advanced']")!.textContent).toContain("Hide advanced settings");
    expect(q("[data-part='scene.lore.type']")!.textContent).toBe("Selective");
    expect(q(".wl-ord")!.textContent).toContain("Order");
    expect(q(".wl-scn")!.textContent).toContain("Scan");
    expect(q<HTMLInputElement>('input[aria-label="Scan depth"]')!.value).toBe("4"); // the book's own default, while the entry inherits it
    expect(text()).toContain("Character Filter");
    expect(qa(".wl-cf .modes button").map((b) => b.textContent)).toEqual(["Whitelist", "Blacklist", "None"]);
    expect(text()).toContain("(optional)");
    expect(text()).toContain("Injection");
    expect(qa("[data-part='scene.lore.position'] button").map((b) => b.textContent)).toEqual(["World", "Character", "Scene", "@ Depth", "Append", "Top", "Bottom"]);
    expect(rig.prefs.get("scenes.loreAdvanced")).toBe(true);
    expect(text()).toContain("Side Effects");
    expect(byText("button", "Add Effect")).toBeDefined();
    expect(text()).toContain("Cross-Entry Boosting");
    expect(q<HTMLInputElement>('input[placeholder="Entry name to boost..."]')).not.toBeNull();
    // RoleCall's Preserve lock is read by the Standardize run: drawn in the header row, off until pressed
    expect(q('[aria-label="Preserve during standardize"]')!.getAttribute("aria-pressed")).toBe("false");
    await press(flushSync, qa(".wl-en").find((r) => r.textContent!.includes("always1")));
    expect(q("[data-part='scene.lore.advanced']")!.textContent).toContain("Hide advanced settings");
    unmount(flushSync);
  });
});

describe("the book list", () => {
  test("the power switch sends the scene's choice, and trash is only on a book this scene added", async () => {
    const flushSync = await mountWing();
    expect(byLabel("Remove The Drowned Coast from this scene")).not.toBeNull();
    expect(byLabel("Remove Keeper's Log from this scene")).toBeNull();
    await press(flushSync, byLabel("Disable Keeper's Log"));
    expect(rig.setLore).toEqual([{ chatId: "chat1", lore: { added: ["b2"], off: ["b3", "b1"] } }]);
    await press(flushSync, byLabel("Remove The Drowned Coast from this scene"));
    expect(rig.setLore.at(-1)!.lore!.added).toEqual([]);
    unmount(flushSync);
  });

  test("the Control Booth's switch and the World wing's send the same write: one writer", async () => {
    const { BoothLoreRow } = await import("./booth-lore-row");
    const flushSync = await mountWing(loreCtx(), ({ ctx }) => createElement(BoothLoreRow, { ctx, chatId: "chat1" }));
    await press(flushSync, byLabel("Disable Keeper's Log"));
    const fromWorld = rig.setLore.at(-1);
    rig.setLore = [];
    await press(flushSync, byLabel("Switch off Keeper's Log"));
    expect(rig.setLore).toEqual([fromWorld!]);
    unmount(flushSync);
  });

  test("the last turn's footer shows only when the take has a trace", async () => {
    rig.lastTurn = { totalTokens: 740, fired: [{ bookId: "b1", entryId: "key1", title: "key1", reason: "key", matched: ["storm"], tokens: 90, cut: false }] };
    const flushSync = await mountWing();
    expect(text()).toContain("1 fired · ~740 tok");
    await openBook(flushSync);
    expect(entryRow("The storm")!.textContent).toContain('"storm"');
    unmount(flushSync);
  });
});

describe("adding a book", () => {
  test("the header's library button opens the full-pane picker; a book already in the scene cannot be added twice", async () => {
    const flushSync = await mountWing();
    await press(flushSync, byLabel("Browse / add lorebooks"));
    expect(q(".wl-t")!.textContent).toBe("Add Lorebook");
    expect(text()).toContain("My Library (2)");
    const rows = qa<HTMLButtonElement>("[data-part='scene.lore.book-row']");
    expect(rows.map((r) => r.textContent)).toEqual(["Keeper's Log2 entries · In this scene", "Sea Reckoning7 entries"]);
    expect(rows[0]!.disabled).toBe(true);
    rig.held.set("b4", { entity: { kind: "lorebook", id: "b4", body: bodyOf("Sea Reckoning", []) }, revision: 1 });
    await press(flushSync, rows[1]);
    expect(rig.setLore).toEqual([{ chatId: "chat1", lore: { added: ["b2", "b4"], off: ["b3"] } }]);
    await waitFor(flushSync, () => rig.loads.includes("b4") && q(".wl-ents"), "the added book to open");
    unmount(flushSync);
  });

  test("the library search narrows by name and says when nothing matches", async () => {
    const flushSync = await mountWing();
    await press(flushSync, byLabel("Browse / add lorebooks"));
    typeInto(flushSync, byLabel("Search my library"), "reck");
    expect(qa("[data-part='scene.lore.book-row']").map((r) => r.querySelector("[data-slot='label']")!.textContent)).toEqual(["Sea Reckoning"]);
    typeInto(flushSync, byLabel("Search my library"), "zzz");
    expect(text()).toContain("No lorebooks match your search");
    expect(text()).toContain("Try different keywords");
    unmount(flushSync);
  });

  test("the dashed button opens the popover: + New Lorebook names, creates, adds and opens the empty book", async () => {
    rig.held.set("newbook1", { entity: { kind: "lorebook", id: "newbook1", body: bodyOf("Sea Log", []) }, revision: 1 });
    const flushSync = await mountWing();
    await press(flushSync, byText("button", "Add Lorebook"));
    expect(q(".wl-pop")).not.toBeNull();
    await press(flushSync, byText(".wl-new button", "+ New Lorebook"));
    const name = byLabel("New lorebook name")!;
    expect(byText(".wl-new button", "Create")!.hasAttribute("disabled")).toBe(true); // no name yet
    typeInto(flushSync, name, "Sea Log");
    await press(flushSync, byText(".wl-new button", "Create"));
    await waitFor(flushSync, () => rig.loads.includes("newbook1") && q(".wl-ents"), "the fresh book to open");
    expect(rig.created).toEqual(["Sea Log"]);
    expect(rig.setLore.at(-1)).toEqual({ chatId: "chat1", lore: { added: ["b2", "newbook1"], off: ["b3"] } });
    expect(q(".wl-pop")).toBeNull();
    unmount(flushSync);
  });

  test("Escape cancels the naming and Cancel creates nothing", async () => {
    const flushSync = await mountWing();
    await press(flushSync, byText("button", "Add Lorebook"));
    await press(flushSync, byText(".wl-new button", "+ New Lorebook"));
    typeInto(flushSync, byLabel("New lorebook name"), "Half-typed");
    pressKey(flushSync, byLabel("New lorebook name")!, "Escape");
    expect(byLabel("New lorebook name")).toBeNull();
    await press(flushSync, byText(".wl-new button", "+ New Lorebook"));
    await press(flushSync, byText(".wl-new button", "Cancel"));
    expect(rig.created).toEqual([]);
    await settle(flushSync);
    unmount(flushSync);
  });
});

describe("failures", () => {
  test("a scene whose books cannot be read says so with a retry", async () => {
    const ctx = loreCtx();
    ctx.api.getSceneLore = async () => { throw new Error("the library is closed"); };
    const flushSync = await mountWing(ctx);
    expect(text()).toContain("the library is closed");
    unmount(flushSync);
  });

  test("a book the library no longer holds says so", async () => {
    rig.held.delete("b1");
    const flushSync = await mountWing();
    await press(flushSync, bookRow("Keeper's Log"), 60);
    expect(text()).toContain("This book is no longer in your library.");
    unmount(flushSync);
  });
});
