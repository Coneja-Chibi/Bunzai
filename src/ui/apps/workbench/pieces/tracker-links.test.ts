/** A prompt line follows the names it points at, keystroke by keystroke, from the text as it was when the rename began. */
import { describe, expect, test } from "bun:test";
import type { TrackerBody } from "../../../../entities/tracker/schema";
import { followFieldRename, followNameRename, noAnchors, renameFieldIn, renameTrackerIn } from "./tracker-links";
import { trackerPreview } from "./tracker-prompt";
import { pieceProblem } from "./piece-problem";

const stats = (template: string, extra: Partial<TrackerBody> = {}): TrackerBody => ({
  name: "Stats", description: "", note: "", layout: "record", template,
  fields: [{ name: "hp", description: "", type: "number", default: 3 }, { name: "hpx", description: "", type: "number", default: 9 }],
  ...extra,
});

describe("rewriting", () => {
  test("a tracker's name and a record's field follow, case and spaces as the engine reads them, and other trackers' macros stay", () => {
    expect(renameTrackerIn("{{tracker::Stats}} {{ tracker::stats::hp }} {{tracker::Other::hp}}", "Stats", "Vitals")).toBe("{{tracker::Vitals}} {{ tracker::Vitals::hp }} {{tracker::Other::hp}}");
    expect(renameFieldIn("{{tracker::Stats::hp}} {{tracker::Stats::hpx}} {{tracker::Other::hp}}", { name: "Stats", layout: "record" }, "hp", "life")).toBe("{{tracker::Stats::life}} {{tracker::Stats::hpx}} {{tracker::Other::hp}}");
  });

  test("a list's field is the third argument", () => {
    expect(renameFieldIn("{{tracker::Bag::Rope::qty}} {{tracker::Bag::qty::qty}}", { name: "Bag", layout: "list" }, "qty", "count")).toBe("{{tracker::Bag::Rope::count}} {{tracker::Bag::qty::count}}");
  });

  test("a macro with another macro inside it is left alone, never half rewritten", () => {
    expect(renameTrackerIn("{{tracker::Stats::{{getvar::f}}}}", "Stats", "Vitals")).toBe("{{tracker::Stats::{{getvar::f}}}}");
  });
});

describe("a field renamed through other names (the review's second probe)", () => {
  test("the macros that read it follow to the last name, and a sibling's macros are not taken on the way", () => {
    const start = stats("A {{tracker::Stats::hp}} B {{tracker::Stats::hpx}}");
    const anchors = noAnchors();
    let body = start;
    // the first field "hp" is typed through "hpx" (a sibling) on its way to "hpy"
    for (const to of ["h", "hpx", "hpy"]) body = followFieldRename({ ...body, fields: [{ ...body.fields[0]!, name: to }, body.fields[1]!] }, anchors, { from: "hp", to, session: 1 });
    expect(body.template).toBe("A {{tracker::Stats::hpy}} B {{tracker::Stats::hpx}}");
  });

  test("a new rename begins from the text it finds", () => {
    const anchors = noAnchors();
    let body = followFieldRename(stats("{{tracker::Stats::hp}}"), anchors, { from: "hp", to: "life", session: 1 });
    expect(body.template).toBe("{{tracker::Stats::life}}");
    body = followFieldRename(body, anchors, { from: "life", to: "vigor", session: 2 });
    expect(body.template).toBe("{{tracker::Stats::vigor}}");
  });
});

describe("the tracker renamed (the review's third probe)", () => {
  test("its macros follow it, through another tracker's name on the way, and the other tracker's macros stay", () => {
    const anchors = noAnchors();
    let body = stats("{{tracker::Stats::hp}} {{tracker::Other::hp}}");
    for (const name of ["O", "Other", "Vitals"]) body = followNameRename(body, anchors, name);
    expect(body.name).toBe("Vitals");
    expect(body.template).toBe("{{tracker::Vitals::hp}} {{tracker::Other::hp}}");
  });

  test("a renamed tracker whose macros were left behind is a problem the person can read, not a silent blank", () => {
    const body = stats("HP {{tracker::Health::hp}}", { name: "Vitals" });
    const preview = trackerPreview(body);
    expect(preview.error).toContain("There is no tracker named Health");
    expect(pieceProblem("tracker", body)).toBeNull();
  });
});

describe("a prompt line changed from elsewhere in the middle of a rename (the review's third probe)", () => {
  test("the next keystroke starts from the newer prompt line, never writes the old one back over it", () => {
    const anchors = noAnchors();
    let body = followNameRename(stats("A {{tracker::Stats::hp}}"), anchors, "Vitals");
    expect(body.template).toBe("A {{tracker::Vitals::hp}}");
    // saved elsewhere / re-read / undone: the prompt line is now something else, and no edit of ours told the anchors
    body = { ...body, template: "B {{tracker::Vitals::hp}} plus more" };
    body = followNameRename(body, anchors, "Vitals2");
    expect(body.template).toBe("B {{tracker::Vitals2::hp}} plus more");
    expect(body.name).toBe("Vitals2");
  });

  test("a rename in progress still follows from its start when nothing else touched the prompt line", () => {
    const anchors = noAnchors();
    let body = stats("{{tracker::Stats::hp}} {{tracker::Other::hp}}");
    for (const name of ["Other", "Vitals"]) body = followNameRename(body, anchors, name);
    expect(body.template).toBe("{{tracker::Vitals::hp}} {{tracker::Other::hp}}");
  });
});
