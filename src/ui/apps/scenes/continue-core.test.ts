/** Continue is offered on a continuable last reply only, and Ctrl+Shift+C is the one key for it. */
import { expect, test } from "bun:test";
import type { Message } from "../../../stage/contracts/chat-store";
import { canContinue, isContinueKey, isRegenerateKey, type ContinueKeyEvent } from "./continue-core";

const reply = (over: Partial<Message> = {}, content = "The lamp swings,"): Message =>
  ({ id: "m3", branchId: "b", seq: 3, role: "assistant", swipes: [{ id: "s", content, createdAt: 1, pinned: false }], current: 0, createdAt: 1, ...over });
const base = { reply: reply(), busy: false, connected: true, held: false, peeking: false };

test("offered on an idle, connected scene's last reply", () => {
  expect(canContinue(base)).toBe(true);
});

test("not offered with no reply, while busy, unconnected, held, peeking another version, hidden, or empty", () => {
  expect(canContinue({ ...base, reply: null })).toBe(false);
  expect(canContinue({ ...base, busy: true })).toBe(false);
  expect(canContinue({ ...base, connected: false })).toBe(false);
  expect(canContinue({ ...base, held: true })).toBe(false);
  expect(canContinue({ ...base, peeking: true })).toBe(false);
  expect(canContinue({ ...base, reply: reply({ hidden: true }) })).toBe(false);
  expect(canContinue({ ...base, reply: reply({}, "  \n") })).toBe(false);
});

const key = (over: Partial<ContinueKeyEvent> = {}): ContinueKeyEvent => ({ key: "C", ctrlKey: true, metaKey: false, shiftKey: true, altKey: false, repeat: false, target: null, ...over });

test("Ctrl+Shift+C or Cmd+Shift+C, once per press", () => {
  expect(isContinueKey(key())).toBe(true);
  expect(isContinueKey(key({ key: "c", ctrlKey: false, metaKey: true }))).toBe(true);
  expect(isContinueKey(key({ shiftKey: false }))).toBe(false);
  expect(isContinueKey(key({ ctrlKey: false }))).toBe(false);
  expect(isContinueKey(key({ altKey: true }))).toBe(false);
  expect(isContinueKey(key({ repeat: true }))).toBe(false);
  expect(isContinueKey(key({ key: "v" }))).toBe(false);
  expect(isContinueKey(key({ isComposing: true }))).toBe(false);
});

test("not while typing in a field", () => {
  const field = { closest: (selector: string) => (selector.includes("textarea") ? {} : null) };
  const plain = { closest: () => null };
  expect(isContinueKey(key({ target: field }))).toBe(false);
  expect(isContinueKey(key({ target: plain }))).toBe(true);
});

test("offered whatever the scene's model: one that refuses a started reply gets RoleCall's whole-new-reply continue (rule 13)", () => {
  for (const model of ["anthropic/claude-opus-4-6", "claude-sonnet-5", "deepseek-reasoner"]) { const scene = { ...base, model }; expect(canContinue(scene)).toBe(true); }
});

/** An element-like target: `closest` answers only for the selectors it was built to match. */
const within = (...parts: string[]) => ({ closest: (selector: string) => (parts.some((p) => selector.includes(p)) ? {} : null) });
const composerBox = within("textarea", "scene.composer");

test("RoleCall's chords do nothing in a field (useKeyboardShortcuts allowInInput is off, a browser reload for Ctrl+Shift+R), but here the composer's own box takes them and nothing else does (F10)", () => {
  expect(isContinueKey(key({ target: composerBox }))).toBe(true);
  expect(isRegenerateKey(key({ key: "R", target: composerBox }))).toBe(true);
  expect(isRegenerateKey(key({ key: "R", target: within("textarea") }))).toBe(false);
});

test("Ctrl+Shift+R or Cmd+Shift+R, once per press, never mid-composition", () => {
  expect(isRegenerateKey(key({ key: "R" }))).toBe(true);
  expect(isRegenerateKey(key({ key: "r", ctrlKey: false, metaKey: true }))).toBe(true);
  expect(isRegenerateKey(key({ key: "R", shiftKey: false }))).toBe(false);
  expect(isRegenerateKey(key({ key: "R", repeat: true }))).toBe(false);
  expect(isRegenerateKey(key({ key: "R", isComposing: true }))).toBe(false);
  expect(isRegenerateKey(key({ key: "R", altKey: true }))).toBe(false);
  expect(isRegenerateKey(key({ key: "C" }))).toBe(false);
  expect(isContinueKey(key({ key: "R" }))).toBe(false);
});
