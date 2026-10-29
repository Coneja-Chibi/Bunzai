/**
 * Settings, Backups: the words the screen uses (when a copy was made, what a restore would change, a
 * refusal's label, the proof block) read as the wireframe draws them.
 */
import { expect, test } from "bun:test";
import { proofLines } from "./backups";
import { agoLabel, changeWords, keptWords, previewRows, refusalLabel, removable, sizeLabel, whenLabel, type Diff, type Preview } from "./backups-core";

const at = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m, d, h, min).getTime();
const diff = (over: Partial<Diff>): Diff => ({ now: 0, inSnapshot: 0, onlyNow: 0, onlySnapshot: 0, changed: 0, ...over });

test("a copy is named by when it was made", () => {
  const now = at(2026, 9, 5, 16, 0);
  expect(whenLabel(at(2026, 9, 5, 15, 12), now)).toBe("Today, 3:12 pm");
  expect(whenLabel(at(2026, 9, 5, 0, 5), now)).toBe("Today, 12:05 am");
  expect(whenLabel(at(2026, 9, 4, 23, 0), now)).toBe("Sun 4 Oct, 11:00 pm");
  expect(agoLabel(now - 12 * 60_000, now)).toBe("12 minutes ago");
  expect(agoLabel(now - 3 * 3_600_000, now)).toBe("3 hours ago");
});

test("sizes read in the largest sensible unit", () => {
  expect([sizeLabel(138_000_000), sizeLabel(4_200_000_000), sizeLabel(12_000)]).toEqual(["138 MB", "4.2 GB", "12 kB"]);
});

test("a restore says what would be set aside, rewound, or come back, and 'no change' when nothing", () => {
  expect(changeWords(diff({ onlyNow: 1, changed: 2 }))).toBe("1 would be set aside · 2 would be rewound");
  expect(changeWords(diff({ onlySnapshot: 3 }))).toBe("3 would come back");
  expect(changeWords(diff({}))).toBe("no change");
});

test("the preview has the four rows of the wireframe", () => {
  const p = { chats: diff({ now: 12, inSnapshot: 11, onlyNow: 1 }), cards: diff({ now: 94, inSnapshot: 94 }), messages: diff({ now: 2410, inSnapshot: 2288, onlyNow: 122 }), otherPieces: diff({}) } as Preview;
  expect(previewRows(p).map((r) => [r.name, r.meta, r.status])).toEqual([
    ["Chats", "12 now, 11 in the copy", "1 would be set aside"],
    ["Cards", "94 now, 94 in the copy", "no change"],
    ["Messages", "2,410 now, 2,288 in the copy", "122 would be set aside"],
    ["Other pieces", "Lorebooks, personas, presets and the rest", "no change"],
  ]);
});

test("a refusal gets the wireframe's label, whatever the plain sentence says", () => {
  expect(refusalLabel("not enough free disk space; nothing was changed")).toBe("No room in the wings");
  expect(refusalLabel("this snapshot was made by a different version of Bunzai and cannot be restored here")).toBe("Made by another version");
  expect(refusalLabel("this snapshot does not open with this library's key: it is from another library, or damaged")).toBe("Not this library");
});

test("before recovery words the proof block says a copy only opens on this computer", () => {
  const lines = (words: boolean) => proofLines(words).map((l) => `${l.not ? "NOT " : ""}${l.text}`);
  expect(lines(true)).toContain("NOT - Until you write your lines (recovery words), a copy only opens on this computer.");
  expect(lines(false)).toContain("+ A copy opens on a new computer with your lines (recovery words).");
  expect(lines(true).some((l) => l.includes("opens on a new computer"))).toBe(false);
});

test("what is kept says the cap on copies made by you, and that safety copies stay until the person removes them", () => {
  expect(keptWords({ count: 3, cap: 10 }, 2)).toContain("Copies made by you stay until you remove them (3 of 10).");
  expect(keptWords({ count: 0, cap: 10 }, 2)).toContain("The copies saved before a restore stay as long as they hold newer work");
  expect(removable({ id: "a", kind: "auto", takenAt: 0, bytes: 1 })).toBe(false);
  expect(removable({ id: "b", kind: "before-restore", takenAt: 0, bytes: 1 })).toBe(true);
  expect(removable({ id: "c", kind: "manual", takenAt: 0, bytes: 1 })).toBe(true);
});
