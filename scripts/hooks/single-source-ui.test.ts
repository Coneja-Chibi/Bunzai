/** Fixtures for the UI single-source guards: each rule fires on a planted copy and stays quiet on the home and on clean code. */
import { describe, expect, test } from "bun:test";
import { copyFlashOutsideHome, debounceFlushPatternOutsideHome, hrefAllowlistOutsideHome, popoutOutsideHome, sceneDateFormatOutsideHome, typingTargetOutsideHome } from "./single-source-ui";

describe("typingTargetOutsideHome", () => {
  test("flags each hand-rolled spelling of the typing-in-a-field test", () => {
    for (const body of [
      'const t = e.target as HTMLElement | null; if (t?.isContentEditable) return;',
      'if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;',
      'const tag = target.tagName.toLowerCase(); if (tag === "textarea") return;',
    ]) {
      expect(typingTargetOutsideHome("src/ui/apps/x/keys.ts", body)).toContain("isTypingTarget");
    }
  });

  test("allows the home, tests, other roots, comments and the shared call", () => {
    const copy = 'if (t?.isContentEditable) return;';
    expect(typingTargetOutsideHome("src/ui/_shared/typing-target.ts", copy)).toBeNull();
    expect(typingTargetOutsideHome("src/ui/apps/x/keys.test.ts", copy)).toBeNull();
    expect(typingTargetOutsideHome("src/kit/keys.ts", copy)).toBeNull();
    expect(typingTargetOutsideHome("src/ui/apps/x/keys.ts", "// uses isContentEditable\nif (isTypingTarget(e.target)) return;")).toBeNull();
  });
});

describe("debounceFlushPatternOutsideHome", () => {
  const handRolled = `useEffect(() => { const timer = setTimeout(() => void onPick(next), 300); return () => clearTimeout(timer); }, [dim]);`;
  const named = `const timer = useRef(null); timer.current = setTimeout(flushOwn, 300); if (timer.current) clearTimeout(timer.current); useEffect(() => flushOwn, []);`;

  test("flags a timer of a save or flush that is cleared by hand next to an effect", () => {
    expect(debounceFlushPatternOutsideHome("src/ui/apps/scenes/x-wing.tsx", handRolled.replace("onPick", "writeIt"))).toContain("useDebouncedSave");
    expect(debounceFlushPatternOutsideHome("src/ui/apps/scenes/x-wing.tsx", named)).toContain("useDebouncedSave");
  });

  test("leaves other timers, other roots, tests and comments alone", () => {
    expect(debounceFlushPatternOutsideHome("src/ui/apps/scenes/x.tsx", "useEffect(() => { const t = setTimeout(() => setCopied(false), 1500); return () => clearTimeout(t); }, []);")).toBeNull();
    expect(debounceFlushPatternOutsideHome("src/ui/_shared/use-debounced-value.ts", named)).toBeNull();
    expect(debounceFlushPatternOutsideHome("src/ui/apps/scenes/x.test.tsx", named)).toBeNull();
    expect(debounceFlushPatternOutsideHome("src/ui/apps/scenes/x.tsx", "// setTimeout(flushOwn, 300); clearTimeout(t); useEffect(")).toBeNull();
    expect(debounceFlushPatternOutsideHome("src/ui/apps/scenes/x.tsx", "setTimeout(flushOwn, 300); useEffect(() => 1)")).toBeNull();
  });
});

describe("sceneDateFormatOutsideHome", () => {
  test("flags a hand-written month/day format in the scene UI", () => {
    expect(sceneDateFormatOutsideHome("src/ui/apps/scenes/x.tsx", 'new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" })')).toContain("dayStamp");
    expect(sceneDateFormatOutsideHome("src/ui/apps/scenes/x.ts", 'new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit" })')).toContain("dateTimeStamp");
  });

  test("allows the home, a time-only format, tests and other folders", () => {
    expect(sceneDateFormatOutsideHome("src/ui/apps/scenes/scene-meta-core.ts", 'd.toLocaleDateString([], { month: "short" })')).toBeNull();
    expect(sceneDateFormatOutsideHome("src/ui/apps/scenes/x.ts", 'd.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })')).toBeNull();
    expect(sceneDateFormatOutsideHome("src/ui/apps/scenes/x.test.ts", 'd.toLocaleDateString([], { month: "short" })')).toBeNull();
    expect(sceneDateFormatOutsideHome("src/ui/apps/library/x.ts", 'd.toLocaleDateString([], { month: "short" })')).toBeNull();
    expect(sceneDateFormatOutsideHome("src/ui/apps/scenes/x.ts", "n.toLocaleString()")).toBeNull();
  });
});

describe("copyFlashOutsideHome", () => {
  test("flags a direct clipboard write, a local duration constant and a hand-rolled flash timer", () => {
    expect(copyFlashOutsideHome("src/ui/apps/x/a.tsx", "void navigator.clipboard?.writeText(text);")).toContain("copyText");
    expect(copyFlashOutsideHome("src/ui/apps/x/a.tsx", "await navigator.clipboard.writeText(text);")).toContain("copyText");
    expect(copyFlashOutsideHome("src/ui/apps/x/a.tsx", "const TOAST_MS = 8000;")).toContain("FLASH_MS");
    expect(copyFlashOutsideHome("src/ui/apps/x/a.tsx", "export const COPY_FEEDBACK_MS = 1500;")).toContain("FLASH_MS");
    expect(copyFlashOutsideHome("src/ui/apps/x/a.tsx", "setTimeout(() => setCopied(false), 1500);")).toContain("useFlash");
  });

  test("allows the homes, tests, other roots, other timers and comments", () => {
    expect(copyFlashOutsideHome("src/ui/_shared/clipboard.ts", "await navigator.clipboard.writeText(text);")).toBeNull();
    expect(copyFlashOutsideHome("src/ui/_shared/use-flash.ts", "const TOAST_MS = 8000;")).toBeNull();
    expect(copyFlashOutsideHome("src/ui/apps/x/a.test.tsx", "navigator.clipboard.writeText")).toBeNull();
    expect(copyFlashOutsideHome("src/kit/render/use-copy-notice.ts", "const NOTICE_MS = 2200;")).toBeNull();
    expect(copyFlashOutsideHome("src/ui/apps/x/a.tsx", "setTimeout(() => setArmed(null), 4000); const READ_TIMEOUT_MS = 2000;")).toBeNull();
    expect(copyFlashOutsideHome("src/ui/apps/x/a.tsx", "// navigator.clipboard.writeText is wrapped by copyText")).toBeNull();
  });
});

describe("hrefAllowlistOutsideHome", () => {
  test("flags a hand-rolled href scheme allowlist", () => {
    for (const body of [
      "const SAFE_LINK = /^(?:https?|mailto):/i;",
      "const SAFE_SCHEME = /^(?:https?:|mailto:)/i;",
      "if (/^(?:https?|mailto):/i.test(href)) keep(href);",
    ]) {
      expect(hrefAllowlistOutsideHome("src/ui/apps/x/link.ts", body)).toContain("safeOutwardHref");
    }
  });

  test("allows the home, tests, other roots, comments and the shared calls", () => {
    const copy = "const SAFE_LINK = /^(?:https?|mailto):/i;";
    expect(hrefAllowlistOutsideHome("src/ui/_shared/render-policy.ts", copy)).toBeNull();
    expect(hrefAllowlistOutsideHome("src/ui/apps/x/link.test.ts", copy)).toBeNull();
    expect(hrefAllowlistOutsideHome("src/kit/link.ts", copy)).toBeNull();
    expect(hrefAllowlistOutsideHome("src/ui/apps/x/link.ts", "// SAFE_LINK was /^(?:https?|mailto):/\nconst h = safeOutwardHref(raw);")).toBeNull();
    expect(hrefAllowlistOutsideHome("src/ui/apps/x/link.ts", "if (isSafeHref(raw)) keep(raw);")).toBeNull();
    expect(hrefAllowlistOutsideHome("src/ui/apps/docs/docs-core.ts", "if (/^(?:https?:|mailto:|#)/i.test(rawHref)) return whole;")).toBeNull();
  });
});

describe("popoutOutsideHome", () => {
  const copy = `const move = (e) => setPos({ x: Math.min(window.innerWidth - 380, e.clientX) }); window.addEventListener("mousemove", move); return createPortal(<div style={{ position: "fixed" }} />, document.body);`;

  test("flags a hand-rolled floating panel in an app, portaled or fixed", () => {
    expect(popoutOutsideHome("src/ui/apps/scenes/compendium/feed.tsx", copy)).toContain("PopoutKind");
    expect(popoutOutsideHome("src/ui/apps/library/panel.tsx", `window.addEventListener("pointermove", move); const h = window.innerHeight; const s = { position: "fixed" };`)).toContain("PopoutKind");
  });

  test("leaves the home, the agent panel, tests, comments and a drag that is not floating alone", () => {
    expect(popoutOutsideHome("src/ui/apps/scenes/popout/popout-panel.tsx", copy)).toBeNull();
    expect(popoutOutsideHome("src/ui/agent/use-floating.ts", copy)).toBeNull();
    expect(popoutOutsideHome("src/ui/apps/scenes/x.test.tsx", copy)).toBeNull();
    expect(popoutOutsideHome("src/ui/apps/scenes/x.tsx", `// ${copy}`)).toBeNull();
    expect(popoutOutsideHome("src/ui/apps/scenes/x.tsx", `window.addEventListener("mousemove", move); const w = window.innerWidth;`)).toBeNull();
    expect(popoutOutsideHome("src/ui/apps/scenes/x.tsx", `return createPortal(<Dialog />, document.body); const w = window.innerWidth;`)).toBeNull();
  });
});
