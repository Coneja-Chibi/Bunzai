/**
 * Settings, Security: the proof block says what the encryption does and the one thing it does not,
 * and the stage dossier's cue grid counts and marks cues as the wireframes draw them.
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CueGrid, wordsOf } from "../../../components/stage-dossier";
import { proofLines } from "./security";
import { lockName, shortDate } from "./security-api";

const texts = (s: Parameters<typeof proofLines>[0]) => proofLines(s).map((l) => `${l.not ? "NOT " : ""}${l.text}`);

test("without a password the proof block says anyone using this computer can open it", () => {
  const lines = texts({ phase: "unlocked", hasPassword: false, hasWords: true, deviceLock: { lock: "dpapi", weak: false, strongerAvailable: false } });
  expect(lines).toContain("+ This computer opens it by itself, through Windows protection.");
  expect(lines).toContain("+ A stolen disk shows nothing without this computer or your lines.");
  expect(lines).toContain("NOT - Anyone using this computer as you can open it. Add a password to stop that.");
});

test("with a password it says the password is asked for, and makes no promise about this computer", () => {
  const lines = texts({ phase: "unlocked", hasPassword: true, hasWords: true, deviceLock: null });
  expect(lines).toContain("+ The library asks for your password before it opens.");
  expect(lines.some((l) => l.includes("Anyone using this computer"))).toBe(false);
});

test("the weak key-file lock says what it does not protect", () => {
  const lines = texts({ phase: "unlocked", hasPassword: false, hasWords: false, deviceLock: { lock: "identity-file", weak: true, strongerAvailable: true } });
  expect(lines).toContain("NOT - The key file protects a copied library, not a whole stolen disk.");
  expect(lines).toContain("+ A stolen disk shows nothing without this computer.");
});

test("lock names read as words, and unknown ones pass through", () => {
  expect(["dpapi", "macos-keychain", "linux-secret", "identity-file", "other"].map(lockName)).toEqual([
    "Windows protection",
    "macOS Keychain",
    "Linux keyring",
    "A key file",
    "other",
  ]);
});

test("pasted words split into lower-case words, whatever separates them", () => {
  expect(wordsOf("Velvet, harbor\n1. lantern  ORCHARD")).toEqual(["velvet", "harbor", "lantern", "orchard"]);
});

test("the cue grid counts delivered cues and marks the flubbed ones", () => {
  const values = ["velvet", "harbor", "", "orchard", ...Array.from({ length: 8 }, () => "")];
  const html = renderToStaticMarkup(<CueGrid values={values} onChange={() => {}} flubbed={[1]} />);
  expect(html).toContain("3 / 12 cues delivered");
  expect((html.match(/aria-invalid="true"/g) ?? []).length).toBe(1);
  expect(html).toContain('aria-label="Word 2"');
});

test("the tiles date reads as the wireframe draws it", () => {
  expect(shortDate(new Date(2026, 8, 23, 12).getTime())).toBe("23 Sep 2026");
});
