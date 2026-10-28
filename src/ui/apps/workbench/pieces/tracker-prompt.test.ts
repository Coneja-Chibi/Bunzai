/** What the tracker editor's rail shows is the real pipeline's output at the tracker's starting values: the block, the plain fallback, the update tool's line, the macro engine's complaint. */
import { describe, expect, test } from "bun:test";
import { updateTrackersTool } from "../../../../core/tracker";
import { countText } from "../../../../core/tokens";
import type { TrackerBody } from "../../../../entities/tracker/schema";
import { trackerPreview } from "./tracker-prompt";

const health = (extra: Partial<TrackerBody> = {}): TrackerBody => ({
  name: "Health", description: "", layout: "record", note: "Lower hp when Vera is hurt.",
  fields: [
    { name: "hp", description: "Current hit points.", type: "number", min: 0, maxField: "hp_max", default: 20 },
    { name: "hp_max", description: "", type: "number", min: 1, default: 20 },
    { name: "mood", description: "", type: "choice", choices: ["calm", "tense", "hurt"], default: "calm" },
  ],
  ...extra,
});

describe("the prompt block", () => {
  test("with no prompt line, the AI reads the plain line under the Trackers header, at the starting values", () => {
    const p = trackerPreview(health());
    expect(p.plain).toBe("Health: hp=20, hp_max=20, mood=calm");
    expect(p.text).toBe("### Trackers\n\nHealth: hp=20, hp_max=20, mood=calm");
    expect(p.error).toBeNull();
  });

  test("a prompt line is run by the macro engine against the tracker's own values", () => {
    const p = trackerPreview(health({ template: "Vera: {{tracker::Health::hp}}/{{tracker::Health::hp_max}} hp, {{tracker::Health::mood}}." }));
    expect(p.text).toBe("### Trackers\n\nVera: 20/20 hp, calm.");
    expect(p.plain).toBe("Health: hp=20, hp_max=20, mood=calm");
  });

  test("a prompt line the engine complains about is reported in words, with the engine's own output shown", () => {
    const p = trackerPreview(health({ template: "{{tracker::Health::nope}}" }));
    expect(p.error).toContain("Health has no field nope");
    expect(p.text).toContain("### Trackers");
  });

  test("a list is shown with one sample row, so its line reads like a row", () => {
    const p = trackerPreview({ ...health(), layout: "list", fields: [{ name: "qty", description: "", type: "number", default: 1 }] });
    expect(p.plain).toBe("Health:\n- Example: qty=1");
    expect(p.text).toBe("### Trackers\n\nHealth:\n- Example: qty=1");
  });
});

describe("the update tool and the cost", () => {
  test("the tracker's line is the one the shared tool builds for it, without the fixed sentence", () => {
    const body = health();
    const p = trackerPreview(body);
    const lines = updateTrackersTool([body]).description.split("\n");
    expect(p.toolLine).toBe(lines.slice(1).join("\n"));
    expect(p.toolLine).toContain("Health (record): hp (number 0 to hp_max: Current hit points.), hp_max (number 1 or more), mood (calm|tense|hurt).");
    expect(p.toolLine).toContain("Lower hp when Vera is hurt.");
    expect(lines[0]).not.toBe(p.toolLine);
  });

  test("the cost is the tokens of the block plus the tool line, counted by the app's estimator", () => {
    const p = trackerPreview(health());
    expect(p.tokens).toBe(countText(p.text) + countText(p.toolLine));
    expect(p.tokens).toBeGreaterThan(0);
  });
});
