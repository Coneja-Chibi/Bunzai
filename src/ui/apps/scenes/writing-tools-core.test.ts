/**
 * The writing-tool table (writing-tools-core.ts), the one list the Writing Tools tab and the composer
 * and message menus all read: RoleCall's names, order and copy, and the rule that a tab or menu only
 * offers a tool that is built.
 */
import { describe, expect, test } from "bun:test";
import { TEMPLATE_FIELDS } from "./preset-core";
import { TOOL_SECTIONS, WRITING_TOOLS, toolsIn } from "./writing-tools-core";

describe("the tool table", () => {
  test("lists RoleCall's six tools in its order, under its three sections", () => {
    expect(WRITING_TOOLS.map((t) => `${t.section}:${t.label}`)).toEqual([
      "reply:Regenerate", "reply:Guided re-roll", "reply:Continue", "reply:Correct", "character:Expand as character", "draft:Polish Input",
    ]);
    expect(TOOL_SECTIONS.map((s) => [s.id, s.label, s.menuLabel])).toEqual([
      ["reply", "Change the reply", "Change the reply"], ["character", "Write in character", "Write in character"], ["draft", "Your draft", "Input"],
    ]);
  });

  test("ids are unique, every prompt key is one of the preset's eight fields, and only RoleCall's two tools name one", () => {
    expect(new Set(WRITING_TOOLS.map((t) => t.id)).size).toBe(WRITING_TOOLS.length);
    const fields = new Set(TEMPLATE_FIELDS.map((f) => f.key));
    for (const t of WRITING_TOOLS) if (t.promptKey) expect(fields.has(t.promptKey)).toBe(true);
    expect(WRITING_TOOLS.filter((t) => t.promptKey).map((t) => [t.label, t.promptKey])).toEqual([["Continue", "continueNudge"], ["Expand as character", "impersonation"]]);
  });

  test("menu rows carry RoleCall's sublabels", () => {
    expect(WRITING_TOOLS.map((t) => t.sublabel)).toEqual([
      "re-roll last AI message", "re-run the last AI message with instructions", "extend last reply", "fix last AI message in place",
      "turn your outline into a full in-character message", "spellcheck what you typed",
    ]);
  });

  test("only built tools are offered, and only what is built today: Regenerate, Guided re-roll, Continue, Correct, Expand as character and Polish Input", () => {
    expect(toolsIn("reply").map((t) => t.label)).toEqual(["Regenerate", "Guided re-roll", "Continue", "Correct"]);
    expect(toolsIn("character").map((t) => t.label)).toEqual(["Expand as character"]);
    expect(toolsIn("draft").map((t) => t.label)).toEqual(["Polish Input"]);
  });

  test("a built tool's chip is a shortcut that exists, and every built tool says what it sends", () => {
    for (const t of WRITING_TOOLS.filter((x) => x.built)) expect(t.sends).toBeTruthy();
    expect(WRITING_TOOLS.find((t) => t.id === "continue")!.shortcut).toBe("Ctrl+Shift+C");
    expect(WRITING_TOOLS.find((t) => t.id === "regenerate")!.shortcut).toBe("Ctrl+Shift+R");
    expect(WRITING_TOOLS.find((t) => t.id === "guided")!.shortcut).toBeUndefined();
  });
});

describe("one writing-tool id table (rc-parity 12, E6)", () => {
  test("the rewrite actions are the Final Cut tool ids but Correction, and every Final Cut tool has one label", async () => {
    const { TOOL_IDS, TOOL_LABELS } = await import("../../../core/final-cut/pass");
    const { REWRITE_ACTIONS } = await import("../../../core/draft-prompts");
    const { REWRITE_BUTTONS } = await import("./correct-core");
    expect([...REWRITE_ACTIONS]).toEqual(TOOL_IDS.filter((id) => id !== "correct"));
    expect(Object.keys(TOOL_LABELS).sort()).toEqual([...TOOL_IDS].sort());
    for (const b of REWRITE_BUTTONS.filter((x) => x.action !== "delete")) expect(b.label).toBe(TOOL_LABELS[b.action as keyof typeof TOOL_LABELS]);
  });

  test("no Writing Tools id repeats a Final Cut tool id with another meaning", async () => {
    const { TOOL_IDS } = await import("../../../core/final-cut/pass");
    const { WRITING_TOOLS } = await import("./writing-tools-core");
    expect(WRITING_TOOLS.map((t) => t.id).filter((id) => (TOOL_IDS as readonly string[]).includes(id) && id !== "correct")).toEqual([]);
  });
});
