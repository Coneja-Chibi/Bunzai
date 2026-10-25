/**
 * Settings, Security, "Check my library": a finding's chip and buttons, and the sentence for a clean or
 * stopped check, read as the health-check wireframe draws them.
 */
import { expect, test } from "bun:test";
import { allWell, chipOf, isDanger, repairButton, stoppedWords, type Finding } from "./health-core";

const finding = (code: Finding["code"], repairs: Finding["repairs"] = ["set-aside", "restore-snapshot"]): Finding => ({ id: "f0", code, item: "x", cause: "y", repairs });

test("findings get the wireframe's chips, danger for lost content, and their repairs the right buttons", () => {
  expect(["cell-unreadable", "row-changed", "dangling", "file-damaged"].map((c) => chipOf(c as Finding["code"]))).toEqual(["Needs a choice", "Changed", "Left over", "The file"]);
  expect(isDanger("cell-unreadable")).toBe(true);
  expect(isDanger("row-changed")).toBe(false);
  expect(repairButton("roll-back", finding("cell-unreadable"))).toEqual({ label: "Go back to the earlier version", primary: true });
  expect(repairButton("restore-snapshot", finding("file-damaged")).label).toBe("Choose a snapshot");
  expect(repairButton("restore-snapshot", finding("cell-unreadable")).label).toBe("Restore from a snapshot");
  expect(repairButton("re-sign", finding("row-changed")).label).toBe("It looks right, keep it");
});

test("a clean check says how much was looked at, and a stopped one is never called clean", () => {
  const done = { state: "done", at: 0, complete: true, stoppedAt: null, sealOwed: null, adopted: 3, checked: { chats: 38, messages: 9120 }, findings: [] } satisfies Parameters<typeof allWell>[0];
  expect(allWell(done)).toBe("Checked 9,158 saved rows just now. Everything opens and matches what was saved. Rows saved before this check existed were marked as good.");
  expect(stoppedWords("chats")).toBe('The check stopped at "chats"');
});
