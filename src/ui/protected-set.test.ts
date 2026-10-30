/**
 * The protected set ("The protected layer"): every control named in PROTECTED_CONTROLS is drawn with protect()
 * in the file that owns it, and no tracker delete action is drawn by hand outside the layer. A control moved out of the layer fails
 * here; a new id without a list line fails the type check.
 */
import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { PROTECTED_CONTROLS, type ProtectedControlId } from "./_shared/protected-control";

const OWNERS: Record<ProtectedControlId, string[]> = {
  "inspector-actions": ["src/ui/apps/scenes/scene-inspector.tsx"],
  "provider-keys": ["src/ui/apps/settings/sections/models.tsx"],
  "mcp-connections": ["src/ui/apps/settings/sections/connections.tsx"],
  "spotify-link": ["src/ui/apps/settings/sections/spotify.tsx"],
  "narrator-tools": ["src/ui/apps/scenes/scene-booth-wing.tsx"],
  "compendium-access": ["src/ui/apps/scenes/compendium/tabs/settings/access-chip.tsx"],
  "regex-switches": ["src/ui/apps/scenes/scene-regex-wing.tsx"],
  "take-delete": ["src/ui/apps/scenes/scene-takes.tsx", "src/ui/apps/scenes/scene-tree.tsx"],
  "entry-delete": ["src/ui/apps/scenes/scene-lore-entries.tsx"],
  "participant-delete": ["src/ui/apps/scenes/cast/participant-row.tsx", "src/ui/apps/scenes/cast/cast-participants-tab.tsx"],
  "director-model": ["src/ui/apps/scenes/props/story-director/director-model.tsx"],
  "director-reset": ["src/ui/apps/scenes/props/story-director/director-panel.tsx"],
  "dramaturg-model": ["src/ui/apps/scenes/props/dramaturg/dramaturg-settings.tsx"],
  "tracker-delete": ["bonds/bonds", "codex/codex", "corruption/corruption", "cycles/cycles", "events/events", "inventory/inventory", "knowledge/knowledge", "memories/memories", "party/party", "spellbook/spellbook"].map((p) => `src/ui/apps/scenes/props/trackers/${p}-panel.tsx`),
};
const text = (path: string): string => readFileSync(path, "utf8");

test("every protected control is drawn with protect() in each file that owns it", () => {
  const missing = Object.entries(OWNERS).flatMap(([id, files]) => files.filter((f) => !text(f).includes(`protect("${id}"`)).map((f) => `${id} in ${f}`));
  expect(missing).toEqual([]);
});

test("the owners table covers exactly the list", () => {
  expect(Object.keys(OWNERS).sort()).toEqual(Object.keys(PROTECTED_CONTROLS).sort());
});

test("no scene file draws a tracker delete action by hand, outside the layer", () => {
  const scenes = "src/ui/apps/scenes";
  const files = readdirSync(scenes, { recursive: true }).map((p) => `${scenes}/${String(p).replace(/\\/g, "/")}`).filter((p) => /\.tsx$/.test(p) && !/\.test\.tsx$/.test(p));
  expect(files.filter((f) => /className="it-act bad"/.test(text(f)))).toEqual([]);
});

test("the documentation page names every protected control", () => {
  for (const page of ["docs/reference/extending/make-a-theme.md"]) {
    const body = text(page);
    expect(Object.values(PROTECTED_CONTROLS).filter((words) => !body.includes(words)).map((w) => `${page}: ${w}`)).toEqual([]);
  }
});
