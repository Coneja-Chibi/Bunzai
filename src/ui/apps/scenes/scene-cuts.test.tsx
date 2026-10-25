/** The restore line a cut leaves in a scene tells the person how long the cut can be undone: one day (ChatStore rule 11). */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CutLine } from "./scene-cuts";

test("a cut line says a message can be restored for 1 day", () => {
  const html = renderToStaticMarkup(<CutLine count={1} onRestore={() => undefined} />);
  expect(html).toContain("A message was cut here");
  expect(html).toContain("you can restore it for 1 day");
  expect(html).not.toContain("3 days");
});

test("a run of cut messages uses the same window", () => {
  expect(renderToStaticMarkup(<CutLine count={4} onRestore={() => undefined} />)).toContain("you can restore them for 1 day");
});
