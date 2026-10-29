/**
 * Feature markers (.claude/plans/prompt-placement.md section 3): a preset block marked with a feature's slot puts that
 * feature's content where the block stands, with the block's role, in any placement a block can have. A preset without
 * the marker keeps the feature's own spot (assemble-trackers.test.ts pins that), and a marker with nothing to carry
 * leaves nothing behind.
 */
import { describe, expect, test } from "bun:test";
import type { CharacterBody } from "../../entities/character/schema";
import type { PresetBody, PresetPrompt } from "../../entities/preset/schema";
import { makePresetPrompt } from "../preset/test-fixtures";
import { parseStPreset } from "../../formats/_shared/st-preset-wire";
import { buildStPreset } from "../../formats/_shared/st-preset-emit";
import type { TrackerBody } from "../../entities/tracker/schema";
import { trackerState } from "../tracker";
import { assemble } from "./assemble";
import { LINKED_TRACKERS_HEADER, TRACKERS_HEADER } from "./trackers";
import type { AssemblyInput, HistoryMessage } from "./types";

const card = { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } as CharacterBody;
const msg = (id: string, role: HistoryMessage["role"], content: string): HistoryMessage => ({ id, role, content });
const block = (id: string, content: string, over: Partial<PresetPrompt> = {}): PresetPrompt =>
  makePresetPrompt({ id, name: id, content, systemPrompt: true, ...over });
const marker = (slot: string, over: Partial<PresetPrompt> = {}): PresetPrompt => block(slot, "", { marker: true, markerSlot: slot, ...over });
/** Main carries every slot's macro, so presetPlan adds nothing and the test reads only its own blocks. */
const main = block("main", "Be {{char}}.{{persona}}{{lore}}{{summary}}");
const tail = block("style", "Write tight.");
const preset = (...prompts: PresetPrompt[]): PresetBody => ({ name: "Test", prompts: [main, ...prompts] });
const PLAYER = "**Player**: Level 1 | HP 100/100 | MP 50/50 | AP 3/3 | XP 0 | Gold 100";
const BLOCK = `${TRACKERS_HEADER}\n\n${PLAYER}`;
const trackersOn = { trackers: { entries: {}, on: ["tracker-resources"] } };
const input = (over: Partial<AssemblyInput> = {}): AssemblyInput => ({
  character: card,
  history: [msg("g", "assistant", "Evening."), msg("u1", "user", "Hi"), msg("a1", "assistant", "Hello.")],
  current: msg("u2", "user", "Any storms?"),
  localVariables: new Map(),
  globalVariables: new Map(),
  now: Date.UTC(2026, 9, 29),
  randomSeed: 1,
  ...over,
});
/** Every request here is also checked for a leaked placeholder (feature-slots.ts). */
const lines = (over: Partial<AssemblyInput>) => {
  const out = assemble(input(over)).messages.map((m) => `${m.role}:${m.content}`);
  expect(out.some((l) => l.includes(""))).toBe(false);
  return out;
};
const BASE = ["system:Be Vera.", "assistant:Evening.", "user:Hi", "assistant:Hello.", "user:Any storms?"];

describe("a trackers marker", () => {
  test("in the order: the block lands where the marker stands, not after the leading system messages", () => {
    expect(lines({ preset: preset(marker("trackers"), tail), ...trackersOn })).toEqual([
      "system:Be Vera.", `system:${BLOCK}`, "system:Write tight.", "assistant:Evening.", "user:Hi", "assistant:Hello.", "user:Any storms?",
    ]);
  });

  test("in the chat at a depth, with the marker's role", () => {
    const at1 = marker("trackers", { placement: "in_chat", injectionDepth: 1, role: "user" });
    expect(lines({ preset: preset(at1), ...trackersOn })).toEqual([
      "system:Be Vera.", "assistant:Evening.", "user:Hi", `user:${BLOCK}`, "assistant:Hello.", "user:Any storms?",
    ]);
  });

  test("pinned to the bottom or the top", () => {
    expect(lines({ preset: preset(marker("trackers", { placement: "append_preset" })), ...trackersOn })).toEqual([...BASE, `system:${BLOCK}`]);
    expect(lines({ preset: preset(marker("trackers", { placement: "prepend_preset" })), ...trackersOn })).toEqual([`system:${BLOCK}`, ...BASE]);
  });

  test("appended at a depth it is its own message there, never glued onto a history message, and its text is kept exactly", () => {
    const health: TrackerBody = { name: "Health", description: "", layout: "record", note: "", template: "Cash: $$5 then $& and $' end", fields: [{ name: "hp", description: "", type: "number", default: 100 }] };
    const linkedTrackers = [{ id: "h", body: health, ...trackerState({}, "h", health) }];
    expect(lines({ preset: preset(marker("linkedTrackers", { placement: "append", injectionDepth: 1, role: "user" })), linkedTrackers })).toEqual([
      "system:Be Vera.", "assistant:Evening.", "user:Hi", `user:${LINKED_TRACKERS_HEADER}\n\nCash: $$5 then $& and $' end`, "assistant:Hello.", "user:Any storms?",
    ]);
  });

  test("a user marker in the chat takes a preset append block glued onto it, as any user block does, with or without content", () => {
    const at1 = marker("trackers", { placement: "in_chat", injectionDepth: 1, role: "user" });
    const glue = block("glue", "GLUED", { placement: "append", injectionDepth: 1, role: "user" });
    expect(lines({ preset: preset(at1, glue), ...trackersOn })).toEqual([
      "system:Be Vera.", "assistant:Evening.", "user:Hi", `user:${BLOCK}\nGLUED`, "assistant:Hello.", "user:Any storms?",
    ]);
    expect(lines({ preset: preset(at1, glue) })).toEqual([
      "system:Be Vera.", "assistant:Evening.", "user:Hi", "user:GLUED", "assistant:Hello.", "user:Any storms?",
    ]);
  });

  test("its own text is not sent: a marker has none", () => {
    expect(lines({ preset: preset(marker("trackers", { content: "stray words" })), ...trackersOn })).toEqual(["system:Be Vera.", `system:${BLOCK}`, ...BASE.slice(1)]);
  });

  test("placed twice, the first one is the marker and the second leaves nothing", () => {
    const second = marker("trackers", { id: "trackers-2", placement: "append_preset" });
    expect(lines({ preset: preset(marker("trackers"), second), ...trackersOn })).toEqual(["system:Be Vera.", `system:${BLOCK}`, ...BASE.slice(1)]);
  });

  test("an empty marker in the chat does not move a depth guide", () => {
    const guides = [{ id: "g", content: "Stay calm.", role: "system" as const, mode: "depth" as const, depth: 1 }];
    const empty = marker("trackers", { placement: "in_chat", injectionDepth: 2, role: "user" });
    expect(lines({ preset: preset(empty), guides })).toEqual(lines({ preset: preset(), guides }));
  });

  test("with nothing to carry leaves no message and no trace of itself", () => {
    const result = assemble(input({ preset: preset(tail, marker("trackers")) }));
    expect(result.messages.map((m) => `${m.role}:${m.content}`)).toEqual([
      "system:Be Vera.", "system:Write tight.", "assistant:Evening.", "user:Hi", "assistant:Hello.", "user:Any storms?",
    ]);
  });

  test("is traced as the trackers' own source", () => {
    const result = assemble(input({ preset: preset(marker("trackers"), tail), ...trackersOn }));
    expect(result.trace[1]?.source.kind).toBe("trackers");
  });

  test("that is switched off is no marker: the block keeps its own spot", () => {
    expect(lines({ preset: preset(tail, marker("trackers", { enabled: false })), ...trackersOn }).slice(0, 3)).toEqual([
      "system:Be Vera.", "system:Write tight.", `system:${BLOCK}`,
    ]);
    // Its own spot is after the leading system messages, which here end at the same place; prove it with the marker first.
    expect(lines({ preset: preset(marker("trackers", { enabled: false }), tail), ...trackersOn })[2]).toBe(`system:${BLOCK}`);
    expect(lines({ preset: preset(marker("trackers"), tail), ...trackersOn })[1]).toBe(`system:${BLOCK}`);
  });
});

describe("the library trackers marker", () => {
  test("follows its own marker and leaves the Props trackers' block at its spot", () => {
    const health: TrackerBody = { name: "Health", description: "", layout: "record", note: "", fields: [{ name: "hp", description: "", type: "number", default: 100 }] };
    const linkedTrackers = [{ id: "h", body: health, ...trackerState({}, "h", health) }];
    expect(lines({ preset: preset(tail, marker("linkedTrackers", { placement: "in_chat", injectionDepth: 0 })), ...trackersOn, linkedTrackers })).toEqual([
      "system:Be Vera.", "system:Write tight.", `system:${BLOCK}`, "assistant:Evening.", "user:Hi", "assistant:Hello.",
      `system:${LINKED_TRACKERS_HEADER}

Health: hp=100`, "user:Any storms?",
    ]);
  });
});

describe("feature markers through SillyTavern", () => {
  test("export and import keep the marker's slot", () => {
    const wire = buildStPreset(preset(marker("trackers", { placement: "in_chat", injectionDepth: 2 })), undefined, "none");
    const back = parseStPreset(wire).prompts.find((p) => p.id === "trackers")!;
    expect(back.marker).toBe(true);
    expect(back.markerSlot).toBe("trackers");
  });
});
