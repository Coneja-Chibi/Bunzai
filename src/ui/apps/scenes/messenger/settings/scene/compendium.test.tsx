/** The Compendium page is rows: each reads the resolved value (defaults on read, nothing written) and writes the patch the Settings tab writes through `setSceneCompendium`; the runs are drill rows; no wing body is drawn inside. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createElement, type ReactNode } from "react";
import { ENTRY_TYPES } from "../../../../../../core/compendium";
import { teardownAllDoms, type InstalledDom } from "../../../../../_shared/test-dom";
import { installSingleDom, mountSingle } from "../../../single-wing-rig";
import { compendiumCategory } from "./compendium";
import { bodyOfSection, control, none, rig, rowOf, setValue, wait, type Rig } from "./fake-scene-rig";

let installed: InstalledDom;
beforeAll(() => { installed = installSingleDom(8412); });
afterAll(async () => { await teardownAllDoms(); });

const mount = (node: ReactNode): ReturnType<typeof mountSingle> => mountSingle(installed, createElement("div", null, node));
const NO_BODIES = ["compendium.settings", "compendium.ingest", "scene.world", "scene.messenger.settings.tool", "scene.messenger.settings.studio"];
const GUIDES = [{ id: "g1", title: "Keep it tight", type: "guide", visible: true }, { id: "g2", title: "Hidden", type: "guide", visible: false }];

const rigged = (chat: Record<string, unknown> = {}): Rig => {
  const r = rig({ chat: chat as never });
  (r.a.ctx.api as unknown as Record<string, unknown>)["listGuides"] = () => Promise.resolve(GUIDES);
  return r;
};
const section = async (r: Rig, id: string): Promise<ReturnType<typeof mountSingle>> => {
  const m = await mount(bodyOfSection(compendiumCategory(r.a, r.open), id));
  await wait(40);
  return m;
};
const patches = (r: Rig): unknown[] => (r.calls["setSceneCompendium"] ?? []).map((c) => c[1]);
const press = (host: HTMLElement, text: string): void => {
  const hit = [...host.querySelectorAll<HTMLElement>('[role="radio"],button')].find((b) => b.textContent === text);
  if (!hit) throw new Error(`no button "${text}"`);
  hit.click();
};

describe("Compendium page", () => {
  test("is its own category with the Settings tab's groups, in order", () => {
    const cat = compendiumCategory(rig().a, () => undefined);
    expect(cat.sections.map((s) => s.id)).toEqual(["comp-master", "comp-books", "comp-recall", "comp-tuning", "comp-filing", "comp-allow", "comp-tree", "comp-historian", "comp-ingest", "comp-standardize"]);
  });

  test("the master switch is off by default, writes on, and shows nothing as written", async () => {
    const r = rigged();
    const m = await section(r, "comp-master");
    const sw = control<HTMLElement>(m.host, "Use Compendium in this scene");
    expect(sw.getAttribute("aria-checked")).toBe("false");
    expect(patches(r)).toEqual([]);
    sw.click();
    await wait(30);
    expect(patches(r)).toEqual([{ on: true }]);
    none(m.host, ...NO_BODIES);
    m.done();
  });

  test("Narrator explore tool reads the saved switch, says when tool access is off, and writes lookup", async () => {
    const r = rigged({ compendium: { lookup: true } });
    const m = await section(r, "comp-master");
    expect(rowOf(m.host, "Narrator explore tool").textContent).toContain("Narrator tool access is off");
    control<HTMLElement>(m.host, "Narrator explore tool").click();
    await wait(30);
    expect(patches(r)).toEqual([{ lookup: false }]);
    m.done();
  });

  test("the output language saves once it rests, and a blank one clears it", async () => {
    const r = rigged({ compendium: { language: "French" } });
    const m = await section(r, "comp-master");
    const box = control<HTMLTextAreaElement>(m.host, "Output language");
    expect(box.value).toBe("French");
    setValue(box, "  Spanish ");
    await wait(450);
    setValue(box, "");
    await wait(450);
    expect(patches(r)).toEqual([{ language: "Spanish" }, { language: null }]);
    m.done();
  });

  test("the Compendium model is a select whose empty choice clears it; the program is a drill", async () => {
    const r = rigged({ compendium: { model: { id: "k1", model: "m1" } } });
    const m = await section(r, "comp-master");
    const pick = control<HTMLSelectElement>(m.host, "Compendium model");
    expect(pick.value).toBe("k1|m1");
    setValue(pick, "");
    await wait(30);
    expect(patches(r)).toEqual([{ model: null }]);
    rowOf(m.host, "Browse, file").click();
    expect(r.opened).toEqual(["compendium"]);
    m.done();
  });

  test("books: access writes the access patch, the default write book offers only writable books and writes writeBook", async () => {
    const r = rigged({ compendium: { books: { b1: { access: "read_write" } }, writeBook: "b1" } });
    const m = await section(r, "comp-books");
    const access = control<HTMLSelectElement>(m.host, "Compendium access: The Drowned Coast");
    expect(access.value).toBe("read_only");
    const write = control<HTMLSelectElement>(m.host, "Default write book");
    expect(write.value).toBe("b1");
    expect([...write.options].map((o) => o.value)).toEqual(["", "b1"]);
    setValue(write, "");
    await wait(30);
    setValue(access, "read_write");
    await wait(30);
    expect(patches(r)).toEqual([{ writeBook: null }, { books: { b2: { access: "read_write" } } }]);
    none(m.host, ...NO_BODIES);
    m.done();
  });

  test("a book that stops being writable takes the default write book with it", async () => {
    const r = rigged({ compendium: { books: { b1: { access: "read_write" } }, writeBook: "b1" } });
    const m = await section(r, "comp-books");
    setValue(control<HTMLSelectElement>(m.host, "Compendium access: Keeper's Log"), "read_only");
    await wait(30);
    expect(patches(r)).toEqual([{ books: { b1: { access: "read_only" } }, writeBook: null }]);
    m.done();
  });

  test("Before a reply: recall switch, guidance (blank clears) and a Guide that is visible", async () => {
    const r = rigged({ compendium: { recall: { on: false, guidance: "relationships", guide: "g1" } } });
    const m = await section(r, "comp-recall");
    expect(control<HTMLElement>(m.host, "Recall from Compendium").getAttribute("aria-checked")).toBe("false");
    const text = control<HTMLTextAreaElement>(m.host, "What should it prioritize?");
    expect(text.value).toBe("relationships");
    const guide = control<HTMLSelectElement>(m.host, "What should it prioritize? Guide");
    expect(guide.value).toBe("g1");
    expect([...guide.options].map((o) => o.value)).toEqual(["", "g1"]);
    control<HTMLElement>(m.host, "Recall from Compendium").click();
    await wait(30);
    setValue(text, "");
    await wait(800);
    setValue(guide, "");
    await wait(30);
    expect(patches(r)).toEqual([{ recall: { on: true } }, { recall: { guidance: null } }, { recall: { guide: null } }]);
    m.done();
  });

  test("Retrieval tuning reads the resolved defaults and writes each recall field, clamped to its range", async () => {
    const r = rigged();
    const m = await section(r, "comp-tuning");
    expect(control<HTMLInputElement>(m.host, "Max entries to retrieve").value).toBe("10");
    expect(control<HTMLSelectElement>(m.host, "Entry detail level").value).toBe("taglines");
    setValue(control<HTMLInputElement>(m.host, "Max entries to retrieve"), "99");
    setValue(control<HTMLInputElement>(m.host, "Collapsed depth"), "3");
    await wait(550);
    setValue(control<HTMLSelectElement>(m.host, "Entry detail level"), "preview");
    press(m.host, "Per-Book");
    await wait(30);
    expect(patches(r)).toEqual([{ recall: { maxEntries: 30 } }, { recall: { depth: 3 } }, { recall: { detail: "preview" } }, { recall: { bookDisplay: "per_book" } }]);
    m.done();
  });

  test("After a reply: filing switch, every N, and when to file as the wait number", async () => {
    const r = rigged({ compendium: { filing: { on: false, everyN: 3, wait: 0 } } });
    const m = await section(r, "comp-filing");
    expect(control<HTMLElement>(m.host, "File lasting changes").getAttribute("aria-checked")).toBe("false");
    expect(control<HTMLInputElement>(m.host, "How often (every N of your turns)").value).toBe("3");
    expect(control<HTMLSelectElement>(m.host, "When to file").value).toBe("0");
    control<HTMLElement>(m.host, "File lasting changes").click();
    setValue(control<HTMLSelectElement>(m.host, "When to file"), "4");
    setValue(control<HTMLInputElement>(m.host, "How often (every N of your turns)"), "5");
    await wait(550);
    expect(patches(r)).toEqual([{ filing: { on: true } }, { filing: { wait: 4 } }, { filing: { everyN: 5 } }]);
    m.done();
  });

  test("What Compendium may file has one switch per entry type and writes the allowed list in type order", async () => {
    const r = rigged({ compendium: { filing: { allow: ["character", "location"] } } });
    const m = await section(r, "comp-allow");
    const switches = [...m.host.querySelectorAll<HTMLElement>('[role="switch"],[aria-checked]')];
    expect(switches.length).toBe(ENTRY_TYPES.length);
    expect(switches.filter((s) => s.getAttribute("aria-checked") === "true").length).toBe(2);
    const off = switches.find((s) => s.getAttribute("aria-checked") === "false")!;
    off.click();
    await wait(30);
    const sent = (patches(r)[0] as { filing: { allow: string[] } }).filing.allow;
    expect(sent.length).toBe(3);
    expect(sent).toEqual(ENTRY_TYPES.filter((t) => sent.includes(t)));
    m.done();
  });

  test("Tree building reads and writes treeBuild; the constraints are a drill to the Compendium", async () => {
    const r = rigged();
    const m = await section(r, "comp-tree");
    expect(control<HTMLSelectElement>(m.host, "Granularity").value).toBe("0");
    setValue(control<HTMLSelectElement>(m.host, "Granularity"), "3");
    setValue(control<HTMLSelectElement>(m.host, "Entry detail level"), "full");
    setValue(control<HTMLSelectElement>(m.host, "Placement mode"), "parallel");
    control<HTMLElement>(m.host, "Refine entries during build").click();
    await wait(40);
    expect(patches(r)).toEqual([{ treeBuild: { granularity: 3 } }, { treeBuild: { detail: "full" } }, { treeBuild: { placement: "parallel" } }, { treeBuild: { refine: true } }]);
    rowOf(m.host, "Tree and entry constraints").click();
    expect(r.opened).toEqual(["compendium"]);
    m.done();
  });

  test("Historian summaries read the resolved defaults and write the three fields", async () => {
    const r = rigged();
    const m = await section(r, "comp-historian");
    expect(control<HTMLInputElement>(m.host, "Interval (your turns)").value).toBe("20");
    expect(control<HTMLInputElement>(m.host, "Context overlap").value).toBe("10");
    setValue(control<HTMLInputElement>(m.host, "Interval (your turns)"), "0");
    control<HTMLElement>(m.host, "Summary-aware context truncation").click();
    await wait(550);
    expect(patches(r)).toEqual([{ historian: { smartContext: true } }, { historian: { interval: 0 } }]);
    m.done();
  });

  test("Import chat history writes each option; the run is a drill and no import progress is drawn", async () => {
    const r = rigged();
    const m = await section(r, "comp-ingest");
    expect(control<HTMLElement>(m.host, "Cross-chunk continuity").getAttribute("aria-checked")).toBe("true");
    control<HTMLElement>(m.host, "Facts phase").click();
    press(m.host, "Scene model");
    await wait(40);
    expect(patches(r)).toEqual([{ ingest: { facts: false } }, { ingest: { model: "scene" } }]);
    rowOf(m.host, "Import messages").click();
    expect(r.opened).toEqual(["compendium"]);
    none(m.host, ...NO_BODIES);
    m.done();
  });

  test("Standardization defaults write standardize; the run and its revert are a drill", async () => {
    const r = rigged();
    const m = await section(r, "comp-standardize");
    expect(control<HTMLInputElement>(m.host, "Default batch size").value).toBe("5");
    setValue(control<HTMLInputElement>(m.host, "Default batch size"), "20");
    control<HTMLElement>(m.host, "Auto-retry failed entries once").click();
    press(m.host, "Narrator");
    await wait(550);
    expect(patches(r)).toEqual([{ standardize: { autoRetry: false } }, { standardize: { modelSource: "scene" } }, { standardize: { batchSize: 20 } }]);
    rowOf(m.host, "Standardize and revert").click();
    expect(r.opened).toEqual(["compendium"]);
    m.done();
  });
});
