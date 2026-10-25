/**
 * The pure half of restoring the bench (perf plan Phase 2 / R4): peekWorkspace answers "which app"
 * from settings alone, with no piece list; resolveWorkspace answers "which pieces survived" once
 * the list exists. Split so use-boot.ts can decide the landing app before the list has even been
 * asked for, and correct the decision later only in the one case that needs it (workspace-core.ts's
 * liveRefs precedent: a piece deleted since is dropped, not restored as a dead tab).
 */
import { describe, expect, test } from "bun:test";
import { peekWorkspace, resolveWorkspace } from "./use-workspace";
import { snapshotWorkspace } from "./workspace-core";

const piece = (kind: string, id: string) => ({ kind, id, name: id });

const settingsWith = (workspace: unknown, restoreOn = true): Record<string, unknown> => ({
  "workbench.restoreSession": restoreOn,
  "workbench.workspace": workspace,
});

describe("peekWorkspace: which app, with no piece list", () => {
  test("null when the restore setting is off, even with a saved bench", () => {
    const snap = snapshotWorkspace({
      pieces: [piece("preset", "a")], activeKey: "preset:a", splitKey: "", appId: "workbench",
    });
    expect(peekWorkspace(settingsWith(snap, false))).toBeNull();
  });

  test("null when the setting is on but nothing was ever saved open", () => {
    const snap = snapshotWorkspace({ pieces: [], activeKey: "", splitKey: "", appId: "" });
    expect(peekWorkspace(settingsWith(snap))).toBeNull();
  });

  test("names the app, without touching whether its pieces still exist", () => {
    const snap = snapshotWorkspace({
      pieces: [piece("preset", "a"), piece("preset", "b")],
      activeKey: "preset:a", splitKey: "", appId: "workbench",
    });
    const peeked = peekWorkspace(settingsWith(snap));
    expect(peeked?.appId).toBe("workbench");
    expect(peeked?.open.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("resolveWorkspace: which pieces survived, once the list exists", () => {
  test("A PIECE DELETED SINCE IS DROPPED, not restored as a tab that cannot open", () => {
    const snap = snapshotWorkspace({
      pieces: [piece("preset", "alive"), piece("preset", "gone")],
      activeKey: "preset:alive", splitKey: "", appId: "workbench",
    });
    const peeked = peekWorkspace(settingsWith(snap))!;
    const resolved = resolveWorkspace(peeked, [piece("preset", "alive")]);
    expect(resolved?.pieces.map((p) => p.id)).toEqual(["alive"]);
    expect(resolved?.appId).toBe("workbench");
  });

  test("null when every named piece is gone - the case use-boot.ts's correction covers", () => {
    const snap = snapshotWorkspace({
      pieces: [piece("preset", "gone")], activeKey: "", splitKey: "", appId: "workbench",
    });
    const peeked = peekWorkspace(settingsWith(snap))!;
    expect(resolveWorkspace(peeked, [])).toBeNull();
  });

  test("a remembered active piece that is gone falls back to the first survivor", () => {
    const snap = snapshotWorkspace({
      pieces: [piece("preset", "a"), piece("preset", "b")],
      activeKey: "preset:gone", splitKey: "", appId: "workbench",
    });
    const peeked = peekWorkspace(settingsWith(snap))!;
    const resolved = resolveWorkspace(peeked, [piece("preset", "a"), piece("preset", "b")]);
    expect(resolved?.activeKey).toBe("preset:a");
  });

  test("a dropped piece before a lorebook does not shift focusEntry onto the wrong survivor", () => {
    // open order: alive (no entry), GONE, lorebook (entry "docks"). liveRefs drops "gone", so the
    // survivor list is [alive, lorebook] at positions [0, 1] - but their refs in `open` sit at
    // [0, 2], one position further apart once "gone" is out. Indexing the survivor list against
    // the original array by POSITION (bug) reads open[1] ("gone"'s ref, no entry) for the
    // lorebook; indexing by id (fix) reads the lorebook's own ref regardless of what was dropped.
    const alive = piece("preset", "alive");
    const gone = piece("preset", "gone");
    const lore = { kind: "lorebook", id: "book", name: "book", params: { focusEntry: "docks" } };
    const snap = snapshotWorkspace({
      pieces: [alive, gone, lore], activeKey: "preset:alive", splitKey: "", appId: "workbench",
    });
    const peeked = peekWorkspace(settingsWith(snap))!;
    const resolved = resolveWorkspace(peeked, [alive, { kind: "lorebook", id: "book", name: "book" }]);
    const restoredLore = resolved?.pieces.find((p) => p.id === "book");
    expect((restoredLore?.params as { focusEntry?: string } | undefined)?.focusEntry).toBe("docks");
  });
});
