/**
 * The Dramaturg's persona (core/dramaturg/prompt.ts, RoleCall's THE_DRAMATURG adapted): out of character, no write path in its wording,
 * Kit named where Orison was, Bunzai's tool names and the scene's own "#n" numbering, and a variant for a model that takes no tools.
 */
import { describe, expect, test } from "bun:test";
import { dramaturgPrompt } from "./prompt";

const TOOLS = ["list_scene_messages", "search_scene_messages", "read_scene_messages", "search_lorebook", "read_lorebook_entry", "read_preset_block"];
const ROLECALL_ONLY = ["read_character", "read_persona", "read_preset`", "read_lorebook`", "read_stagecraft", "read_storyboard", "read_live_tracker_state", "read_tracker_module", "orison_search", "tool_search", "tmp_read", "consult_", "next_from_index"];

describe("dramaturgPrompt", () => {
  test("keeps RoleCall's beliefs, rules, framework and hard constraints", () => {
    const text = dramaturgPrompt({ tools: true });
    for (const heading of ["## CORE BELIEFS", "## NEVER CLAIM", "## ALWAYS POINT AT THE EVIDENCE", "WORKING FRAMEWORK", "STAGE 1", "STAGE 4", "## HARD CONSTRAINTS"]) expect(text).toContain(heading);
    expect(text).toContain("Inference and evidence are different things");
    expect(text).toContain("NEVER write the next scene message");
  });

  test("Kit, the Agent window, is where product questions go; Orison and RoleCall are gone", () => {
    for (const tools of [true, false]) {
      const text = dramaturgPrompt({ tools });
      expect(text).toContain("Kit");
      expect(text).toContain("the Agent window");
      expect(text).toContain("Bunzai");
      expect(text).not.toMatch(/Orison|RoleCall/);
    }
  });

  test("with tools: Bunzai's six, by name, and none of RoleCall's it does not carry", () => {
    const text = dramaturgPrompt({ tools: true });
    for (const name of TOOLS) expect(text).toContain(`\`${name}\``);
    for (const name of ROLECALL_ONLY) expect(text).not.toContain(name);
    expect(text).toContain("next_from");
  });

  test("messages are cited by the scene's own numbers", () => {
    const text = dramaturgPrompt({ tools: true });
    expect(text).toContain("(#56)");
    expect(text).not.toMatch(/\(msg \d+\)|0-based|from_index/);
  });

  test("without tools it says so, names no tool to call, and says to name what was trimmed", () => {
    const text = dramaturgPrompt({ tools: false });
    for (const name of TOOLS) expect(text).not.toContain(name);
    expect(text).toMatch(/no tools/i);
    expect(text).toMatch(/left out/);
    expect(text).not.toContain("HOW THE LOOP WORKS");
  });

  test("no wording offers to change anything: it reads and discusses", () => {
    for (const tools of [true, false]) {
      const text = dramaturgPrompt({ tools });
      expect(text).toContain("You have no write tools of any kind");
      expect(text).not.toMatch(/\b(update|edit|save|delete|create|set)_[a-z]/);
      expect(text).not.toMatch(/I can (change|edit|fix|rewrite)/i);
    }
  });

  test("no em dashes and no braces a macro pass could read", () => {
    for (const tools of [true, false]) {
      const text = dramaturgPrompt({ tools });
      expect(text).not.toContain("\u2014");
      expect(text).not.toContain("{{");
    }
  });
});
