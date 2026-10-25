/**
 * Lumiverse compatibility tests. Lumiverse presets (e.g. ThreadBare) use a dialect of the macro
 * language: {{if::cond}} block conditionals, {{else if::cond}} chains, {{//if}} as an if-terminator,
 * {{trim}} blocks, {{rcounter}}, group-card macros, and platform tokens (lumia*, spotify_*). These
 * pin support for that dialect. Ported from RoleCall's lumiverse-compat.test.ts
 * (RoleCall's lumiverse-compat.test.ts): `initializeMacros()` is gone
 * (the registry builds itself from the catalog at module load), `quickExpand` is a local helper
 * (RoleCall's own `quickExpand` is `processMacros(text, createDefaultContext(overrides)).text`),
 * and variable timestamps are epoch ms instead of `Date`.
 */
import { describe, expect, test } from "bun:test";
import { processMacros, createDefaultContext } from "../process";
import type { MacroContext } from "../types";

function ctx(overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({ characterName: "Stella", userName: "Chi", ...overrides });
}

function quickExpand(text: string, context: MacroContext): string {
  return processMacros(text, context).text;
}

function withVar(name: string, value: string, overrides: Partial<MacroContext> = {}): MacroContext {
  const c = ctx(overrides);
  c.localVariables.set(name, { value, createdAt: Date.now(), updatedAt: Date.now() });
  return c;
}

describe("Lumiverse {{if::cond}} block conditionals", () => {
  test("takes the then-branch when the condition is truthy", () => {
    expect(processMacros("{{if::1}}YES{{/if}}", ctx()).text).toBe("YES");
  });

  test("takes the else-branch when the condition is falsy", () => {
    expect(processMacros("{{if::0}}YES{{else}}NO{{/if}}", ctx()).text).toBe("NO");
  });

  test("evaluates a nested getvar condition (ThreadBare pattern)", () => {
    const on = processMacros("{{if::{{getvar::nsfw_on}}}}adult{{else}}clean{{/if}}", withVar("nsfw_on", "1"));
    expect(on.text).toBe("adult");
    const off = processMacros("{{if::{{getvar::nsfw_on}}}}adult{{else}}clean{{/if}}", withVar("nsfw_on", "0"));
    expect(off.text).toBe("clean");
  });

  test("supports comparison conditions in the colon form", () => {
    const result = processMacros("{{if::{{getvar::mode}} == solo}}SOLO{{else}}GROUP{{/if}}", withVar("mode", "solo"));
    expect(result.text).toBe("SOLO");
  });

  test("treats {{//if}} as an if-terminator (Lumiverse close variant)", () => {
    expect(processMacros("{{if::1}}A{{else}}B{{//if}} tail", ctx()).text).toBe("A tail");
  });

  test("still supports the inline 3-arg form {{if::cond::then::else}}", () => {
    expect(quickExpand("{{if::1::yes::no}}", ctx())).toBe("yes");
    expect(quickExpand("{{if::0::yes::no}}", ctx())).toBe("no");
  });

  test("nests colon-form blocks correctly", () => {
    const result = processMacros("{{if::1}}outer {{if::0}}inner-yes{{else}}inner-no{{/if}}{{/if}}", ctx());
    expect(result.text).toBe("outer inner-no");
  });

  test("mixes colon-form and space-form nesting", () => {
    const result = processMacros("{{if::1}}colon {{if 1}}space{{/if}}{{/if}}", ctx());
    expect(result.text).toBe("colon space");
  });
});

describe("{{else if::cond}} chains", () => {
  const TEMPLATE =
    "{{if::{{getvar::mode}} == solo}}SOLO" +
    "{{else if::{{getvar::mode}} == swap}}SWAP" +
    "{{else if::{{getvar::mode}} == ensemble}}ENSEMBLE" +
    "{{else}}UNKNOWN{{/if}}";

  test("takes the first matching branch", () => {
    expect(processMacros(TEMPLATE, withVar("mode", "solo")).text).toBe("SOLO");
  });

  test("takes a middle else-if branch", () => {
    expect(processMacros(TEMPLATE, withVar("mode", "swap")).text).toBe("SWAP");
  });

  test("takes the last else-if branch", () => {
    expect(processMacros(TEMPLATE, withVar("mode", "ensemble")).text).toBe("ENSEMBLE");
  });

  test("falls through to else when nothing matches", () => {
    expect(processMacros(TEMPLATE, withVar("mode", "other")).text).toBe("UNKNOWN");
  });

  test("supports space-form else-if too", () => {
    const result = processMacros("{{if .x == 1}}one{{else if .x == 2}}two{{else}}many{{/if}}", withVar("x", "2"));
    expect(result.text).toBe("two");
  });
});

describe("{{trim}} block and bare forms", () => {
  test("block form trims the enclosed content", () => {
    expect(processMacros("a[{{trim}}  spaced out  {{/trim}}]b", ctx()).text).toBe("a[spaced out]b");
  });

  test("bare {{trim}} collapses surrounding whitespace (ST semantics)", () => {
    expect(processMacros("left  \n {{trim}} \n  right", ctx()).text).toBe("leftright");
  });

  test("inline {{trim::text}} still works", () => {
    expect(quickExpand("{{trim::  x  }}", ctx())).toBe("x");
  });

  test("silently consumes an orphaned {{/trim}}", () => {
    expect(processMacros("a{{/trim}}b", ctx()).text).toBe("ab");
  });
});

describe("{{rcounter::name}}", () => {
  test("numbers sequentially within one evaluation", () => {
    const result = processMacros("Step {{rcounter::step}}. Step {{rcounter::step}}. Step {{rcounter::step}}.", ctx());
    expect(result.text).toBe("Step 1. Step 2. Step 3.");
  });

  test("tracks separate names independently", () => {
    const result = processMacros("{{rcounter::a}}-{{rcounter::b}}-{{rcounter::a}}", ctx());
    expect(result.text).toBe("1-1-2");
  });

  test("continues across calls sharing one context (multi-block prompt build)", () => {
    const shared = ctx();
    expect(processMacros("{{rcounter::step}}", shared).text).toBe("1");
    expect(processMacros("{{rcounter::step}}", shared).text).toBe("2");
  });

  test("resets with a fresh context (next generation)", () => {
    expect(processMacros("{{rcounter::step}}", ctx()).text).toBe("1");
    expect(processMacros("{{rcounter::step}}", ctx()).text).toBe("1");
  });

  test("poisons result cacheability (volatile)", () => {
    expect(processMacros("{{rcounter::step}}", ctx()).cacheable).toBe(false);
  });
});

describe("reasoning prefix/suffix macros", () => {
  test("defaults to <think> / </think>", () => {
    expect(quickExpand("{{reasoningPrefix::raw}}", ctx())).toBe("<think>");
    expect(quickExpand("{{reasoningSuffix::raw}}", ctx())).toBe("</think>");
  });

  test("respects context overrides", () => {
    const c = ctx({ reasoningPrefix: "<reasoning>", reasoningSuffix: "</reasoning>" });
    expect(quickExpand("{{reasoningPrefix}}", c)).toBe("<reasoning>");
    expect(quickExpand("{{reasoningSuffix}}", c)).toBe("</reasoning>");
  });
});

describe("group-card macros", () => {
  test("groupCardMode defaults to solo outside group chats", () => {
    expect(quickExpand("{{groupCardMode}}", ctx())).toBe("solo");
  });

  test("reflects the group mode and focused character in group context", () => {
    const c = ctx({
      groupCardMode: "swap",
      focusedCharacterName: "Mira",
      focusedCharacterDescription: "A sly fox.",
      focusedCharacterPersonality: "Cunning.",
      groupMembers: [{ name: "Stella" }, { name: "Mira" }, { name: "Juno" }],
    });
    expect(quickExpand("{{groupCardMode}}", c)).toBe("swap");
    expect(quickExpand("{{charGroupFocused}}", c)).toBe("Mira");
    expect(quickExpand("{{charGroupFocusedDescription}}", c)).toBe("A sly fox.");
    expect(quickExpand("{{charGroupFocusedPersonality}}", c)).toBe("Cunning.");
    expect(quickExpand("{{groupOthers}}", c)).toBe("Stella, Juno");
  });

  test("falls back to the active character when no group focus is set", () => {
    const c = ctx({ characterDescription: "A star.", characterPersonality: "Bright." });
    expect(quickExpand("{{charGroupFocused}}", c)).toBe("Stella");
    expect(quickExpand("{{charGroupFocusedDescription}}", c)).toBe("A star.");
    expect(quickExpand("{{charGroupFocusedPersonality}}", c)).toBe("Bright.");
    expect(quickExpand("{{groupOthers}}", c)).toBe("");
  });

  test("drives ThreadBare Character-block branching correctly", () => {
    const template = "{{if::{{groupCardMode}} == solo}}SOLO:{{char}}{{else}}FOCUS:{{charGroupFocused}}{{/if}}";
    expect(processMacros(template, ctx()).text).toBe("SOLO:Stella");
    const grouped = ctx({ groupCardMode: "swap", focusedCharacterName: "Mira" });
    expect(processMacros(template, grouped).text).toBe("FOCUS:Mira");
  });
});

describe("Lumiverse platform tokens", () => {
  test("aliases lumiaDef/lumiaPersonality to RC character fields", () => {
    const c = ctx({ characterDescription: "Desc here.", characterPersonality: "Pers here." });
    expect(quickExpand("{{lumiaDef}}", c)).toBe("Desc here.");
    expect(quickExpand("{{lumiaPersonality}}", c)).toBe("Pers here.");
  });

  test("resolves unavailable platform tokens to empty (not literal text)", () => {
    const tokens = [
      "lumiaCouncilModeActive",
      "lumiaCouncilInst",
      "lumiaCouncilDeliberation",
      "lumiaStateSynthesis",
      "lumiaBehavior",
      "lumiaOOC",
      "lumiaOOCErotic",
      "lumiaOOCEroticBleed",
      "spotify_track_name",
      "spotify_artists",
      "spotify_album_art",
      "spotify_album_name",
      "spotify_has_lyrics",
      "spotify_is_playing",
      "spotify_lyrics",
      "sim_tracker",
      "usercolormode",
      "isnarrator",
      "wi_marker",
    ];
    for (const token of tokens) {
      expect(quickExpand(`{{${token}}}`, ctx())).toBe("");
    }
  });

  test("supports standalone {{eq::a::b}} (ThreadBare tracker pattern)", () => {
    expect(quickExpand("{{eq::none::none}}", ctx())).toBe("true");
    expect(quickExpand("{{eq::sweat::none}}", ctx())).toBe("false");
    expect(quickExpand("{{eq::None::none}}", ctx())).toBe("true"); // case-insensitive
  });

  test("keeps lumia-gated sections from falsely activating", () => {
    // Before this support, {{lumiaCouncilModeActive}} survived as literal text (a truthy string),
    // wrongly enabling Lumiverse-only sections.
    const result = processMacros("{{if::{{lumiaCouncilModeActive}}}}COUNCIL{{else}}{{/if}}ok", ctx());
    expect(result.text).toBe("ok");
  });
});
