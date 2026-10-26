/** The simple rows read the stored value through the existing getters and write through ctx.prefs under the existing key; nothing else is touched. */
import { describe, expect, test } from "bun:test";
import type { AppContext } from "../../../../app-contract";
import { CHAT_LAYOUT_KEY } from "../../chat-layout";
import { AUTO_OPEN_KEY, CAP_LONG_KEY } from "../../scene-reasoning-core";
import { SHOW_TIMESTAMPS_KEY } from "../../scene-meta-core";
import { LIMITS, LOOK_DEFAULTS, LOOK_KEYS } from "../../stage-look-core";
import { VOLUME_KEY } from "../../stage-music-core";
import { ALL_ROWS, USER_ROWS as R, type RowDef, type RowEnv } from "./rows";

function rig(seed: Record<string, unknown> = {}): { env: RowEnv; store: Map<string, unknown>; writes: [string, unknown][]; repaints: number[] } {
  const store = new Map<string, unknown>(Object.entries(seed));
  const writes: [string, unknown][] = [];
  const repaints: number[] = [];
  const prefs = { get: (k: string) => store.get(k), set: (k: string, v: unknown) => { store.set(k, v); writes.push([k, v]); } };
  return { env: { ctx: { prefs } as unknown as AppContext, repaint: () => { repaints.push(1); } }, store, writes, repaints };
}

describe("messenger settings rows", () => {
  test("unset prefs read as the owners' defaults", () => {
    const { env } = rig();
    expect(R.layout.read(env)).toBe("stage");
    expect(R.avatars.read(env)).toBe(LOOK_DEFAULTS.avatars);
    expect(R.timestamps.read(env)).toBe(true);
    expect(R.opacity.read(env)).toBe(Math.round(LOOK_DEFAULTS.opacity * 100));
    expect(R.gap.read(env)).toBe(LOOK_DEFAULTS.gap);
    expect(R.font.read(env)).toBe(LOOK_DEFAULTS.font);
    expect(R.size.read(env)).toBe(LOOK_DEFAULTS.size);
    expect(R.lineHeight.read(env)).toBe(LOOK_DEFAULTS.lineHeight);
    expect(R.autoScroll.read(env)).toBe(LOOK_DEFAULTS.autoScroll);
    expect(R.capReasoning.read(env)).toBe(false);
    expect(R.autoOpenReasoning.read(env)).toBe(true);
    expect(R.fadeIn.read(env)).toBe(LOOK_DEFAULTS.fadeIn);
    expect(R.compact.read(env)).toBe(LOOK_DEFAULTS.compact);
    expect(R.chime.read(env)).toBe(LOOK_DEFAULTS.chime);
    expect(R.typing.read(env)).toBe(LOOK_DEFAULTS.typing);
    expect(R.volume.read(env)).toBe(60);
  });

  test("stored values read back", () => {
    const { env } = rig({ [CHAT_LAYOUT_KEY]: "messenger", [LOOK_KEYS.avatars]: false, [SHOW_TIMESTAMPS_KEY]: false, [LOOK_KEYS.opacity]: 0.5, [LOOK_KEYS.gap]: 8, [LOOK_KEYS.font]: "mono", [LOOK_KEYS.size]: 20, [LOOK_KEYS.lineHeight]: 2, [LOOK_KEYS.autoScroll]: "never", [CAP_LONG_KEY]: true, [AUTO_OPEN_KEY]: false, [VOLUME_KEY]: 0.25 });
    expect([R.layout.read(env), R.avatars.read(env), R.timestamps.read(env), R.opacity.read(env), R.gap.read(env), R.font.read(env), R.size.read(env), R.lineHeight.read(env), R.autoScroll.read(env), R.capReasoning.read(env), R.autoOpenReasoning.read(env), R.volume.read(env)])
      .toEqual(["messenger", false, false, 50, 8, "mono", 20, 2, "never", true, false, 25]);
  });

  test("each write goes to the existing key once and repaints", () => {
    const cases: [RowDef, unknown, string, unknown][] = [
      [R.layout, "messenger", CHAT_LAYOUT_KEY, "messenger"], [R.avatars, false, LOOK_KEYS.avatars, false], [R.timestamps, false, SHOW_TIMESTAMPS_KEY, false], [R.opacity, 50, LOOK_KEYS.opacity, 0.5],
      [R.gap, 12, LOOK_KEYS.gap, 12], [R.font, "serif", LOOK_KEYS.font, "serif"], [R.size, 18, LOOK_KEYS.size, 18], [R.lineHeight, 1.7, LOOK_KEYS.lineHeight, 1.7], [R.autoScroll, "always", LOOK_KEYS.autoScroll, "always"],
      [R.capReasoning, true, CAP_LONG_KEY, true], [R.autoOpenReasoning, false, AUTO_OPEN_KEY, false], [R.fadeIn, false, LOOK_KEYS.fadeIn, false], [R.compact, true, LOOK_KEYS.compact, true],
      [R.chime, true, LOOK_KEYS.chime, true], [R.typing, false, LOOK_KEYS.typing, false], [R.volume, 40, VOLUME_KEY, 0.4],
    ];
    expect(cases.length).toBe(ALL_ROWS.length);
    for (const [row, value, key, stored] of cases) {
      const r = rig();
      (row.write as (env: RowEnv, v: unknown) => void)(r.env, value);
      expect(r.writes).toEqual([[key, stored]]);
      expect(r.repaints).toHaveLength(1);
    }
  });

  test("ranges come from the owners' limits, not the wireframe's sample numbers", () => {
    expect([R.size.min, R.size.max, R.size.step]).toEqual([...LIMITS.size]);
    expect([R.gap.min, R.gap.max, R.gap.step]).toEqual([...LIMITS.gap]);
    expect([R.lineHeight.min, R.lineHeight.max, R.lineHeight.step]).toEqual([...LIMITS.lineHeight]);
    expect([R.opacity.min, R.opacity.max]).toEqual([0, 200]);
  });

  test("rows the maps mark missing are absent", () => {
    const ids = ALL_ROWS.map((r) => r.id);
    for (const missing of ["streamReplies", "desktopNotification", "uiTextSize", "reduceMotion", "highContrast", "playOnOpen", "blur", "backupSchedule"]) expect(ids).not.toContain(missing);
  });
});
