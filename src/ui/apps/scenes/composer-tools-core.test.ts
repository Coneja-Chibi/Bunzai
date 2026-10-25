/** The "+" menu's gate over the writing-tool table (rc-parity 03 F8: one list), and the draft's key. */
import { expect, test } from "bun:test";
import { composerRows, composerSections, draftKey, readDraft } from "./composer-tools-core";

const idle = { busy: false, connected: true, continuable: true, inspector: false };

test("the menu offers the table's built tools under RoleCall's headings, in its words; the dead rows are not here (F9)", () => {
  expect(composerSections(composerRows(idle)).map((s) => [s.label, s.rows.map((r) => [r.label, r.sublabel])])).toEqual([
    ["Change the reply", [
      ["Regenerate", "re-roll last AI message"],
      ["Guided re-roll", "re-run the last AI message with instructions"],
      ["Continue", "extend last reply"],
      ["Correct", "fix last AI message in place"],
    ]],
    ["Write in character", [["Expand as character", "turn your outline into a full in-character message"]]],
    ["Input", [["Polish Input", "spellcheck what you typed"]]],
    ["Debug", [["Prompt Inspector: Off", ""]]],
  ]);
});

test("an idle, connected scene with a reply offers every row", () => {
  expect(composerRows(idle).every((r) => r.disabled === undefined)).toBe(true);
});

test("a running reply or a missing connection disables every row and says why", () => {
  for (const [gate, why] of [[{ busy: true }, "A reply is being written."], [{ connected: false }, "Pick a connection first."]] as const) {
    expect(composerRows({ ...idle, ...gate }).map((r) => r.disabled)).toEqual([why, why, why, why, why, why, undefined]);
  }
});

test("Continue is disabled with a reason when the reply cannot be continued; the re-rolls stay enabled and answer a click themselves, as RoleCall's do", () => {
  const rows = composerRows({ ...idle, continuable: false });
  expect(rows.map((r) => [r.id, r.disabled])).toEqual([["regenerate", undefined], ["guided", undefined], ["continue", "There is no reply to continue."], ["correct", undefined], ["expand-character", undefined], ["polish", undefined], ["inspector", undefined]]);
});

test("the draft lives under one key per scene and anything but text reads as empty", () => {
  expect(draftKey("chat1")).toBe("scenes.draft.chat1");
  expect(readDraft("half a line")).toBe("half a line");
  for (const bad of [undefined, null, 4, {}]) expect(readDraft(bad)).toBe("");
});

test("the Debug row reads the pref in RoleCall's words and is never disabled, a running reply or no connection included", () => {
  for (const gate of [idle, { ...idle, busy: true }, { ...idle, connected: false }]) {
    expect(composerRows({ ...gate, inspector: true }).at(-1)).toEqual({ id: "inspector", section: "debug", label: "Prompt Inspector: On", sublabel: "" });
  }
});
