/** Matrix figures preserve status values and complete wrapped evidence labels. */
import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { renderMatrix } from "./docs-figures";

test("matrix status cells render readable values without clipping evidence", () => {
  const evidence = "Native keychain results required; HTTP evidence does not establish packaged isolation";
  const { svg, h } = renderMatrix({
    type: "matrix", cols: ["Status", "Evidence"],
    rows: [
      { label: "Packaged isolation", cells: [{ v: "NOT MEASURED", hi: true }, evidence] },
      { label: "Code suite", cells: [true, { v: "unit tests", lvl: 1 }] },
    ],
  });
  const doc = new JSDOM(svg, { contentType: "image/svg+xml" }).window.document;
  const texts = [...doc.querySelectorAll("text")];
  const content = texts.map((t) => t.textContent).join(" ");
  expect(content).not.toContain("[object Object]");
  expect(content).toContain("NOT MEASURED");
  expect(content).toContain("Yes");
  expect(content).toContain(evidence);
  expect(content).not.toContain("…");
  expect(texts.every((t) => Number(t.getAttribute("y")) < h)).toBe(true);
});
