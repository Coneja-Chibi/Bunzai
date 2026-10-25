/** The theme parts page: part names are read from JSX, one row per name, and a stale page is what the check catches. */
import { expect, test } from "bun:test";
import { partsIn, renderParts, staleReason } from "./docs-parts-core";

test("reads each part with the element it sits on, even when the attributes span lines", () => {
  const source = `<nav id="dock" data-part="shell.nav" className="x">\n<button\n  type="button"\n  data-part="shell.nav.tile"\n>`;
  expect(partsIn(source, "a.tsx")).toEqual([
    { part: "shell.nav", tag: "nav", file: "a.tsx" },
    { part: "shell.nav.tile", tag: "button", file: "a.tsx" },
  ]);
});

test("ignores names that are not surface.part dotted names", () => {
  expect(partsIn('<span data-part="chord">', "a.tsx")).toEqual([]);
});

test("renders one sorted row per name under its surface, merging repeats", () => {
  const page = renderParts([
    { part: "scene.root", tag: "div", file: "b.tsx" },
    { part: "library.root", tag: "div", file: "a.tsx" },
    { part: "library.root", tag: "div", file: "c.tsx" },
  ]);
  expect(page.indexOf("### library")).toBeLessThan(page.indexOf("### scene"));
  expect(page.match(/`library\.root`/g)?.length).toBe(1);
  expect(page).toContain("`a.tsx`, `c.tsx`");
});

test("the check fails on a missing page and on a page that no longer matches the sources", () => {
  const hits = [{ part: "shell.root", tag: "div", file: "a.tsx" }];
  expect(staleReason(null, hits)).toContain("missing");
  expect(staleReason(renderParts(hits), hits)).toBeNull();
  expect(staleReason(renderParts(hits), [...hits, { part: "shell.nav", tag: "nav", file: "a.tsx" }])).toContain("stale");
});

test("reads an id-keyed template part as a `<id>` family, whatever the expression is called", () => {
  const source = "<section data-part={`scene.stage.act.${id}`}>\n<div data-part={`props.tracker.${prop.id}`}>";
  expect(partsIn(source, "a.tsx")).toEqual([
    { part: "scene.stage.act.<id>", tag: "section", file: "a.tsx" },
    { part: "props.tracker.<id>", tag: "div", file: "a.tsx" },
  ]);
});

test("reads both names of a two-literal choice, and a part forwarded as a literal `data-part` prop is read at its call site", () => {
  const source = '<div data-part={stopped ? "compendium.standardize.stopped" : "compendium.standardize.complete"}>\n<FormSection data-part="scene.cast.palette" title="x">';
  expect(partsIn(source, "a.tsx").map((h) => h.part)).toEqual(["compendium.standardize.stopped", "compendium.standardize.complete", "scene.cast.palette"]);
});
