/**
 * Render-policy tests - the policy is pure, so these pin the security-relevant decisions directly:
 * which link schemes survive, where the parse cap bites, and which inline styles may remain. The DOM
 * sanitizer battery lives in render-markup.test.ts (it needs a DOM); this file guards the half that
 * decides what is even allowed.
 */
import { describe, expect, test } from "bun:test";
import {
  ALLOWED_INLINE_STYLE_PROPS,
  capInput,
  escapeHtml,
  isSafeHref,
  isSafeStyleValue,
  linkifyEscaped,
  RENDER_INPUT_CAP,
  safeOutwardHref,
  sanitizeInlineStyle,
} from "./render-policy";

describe("isSafeHref", () => {
  test("keeps http, https, and mailto", () => {
    expect(isSafeHref("https://example.com")).toBe(true);
    expect(isSafeHref("http://example.com")).toBe(true);
    expect(isSafeHref("mailto:a@b.com")).toBe(true);
  });

  test("keeps in-document and root-relative links", () => {
    expect(isSafeHref("#section")).toBe(true);
    expect(isSafeHref("/library/regex")).toBe(true);
  });

  test("rejects script-bearing and non-navigational schemes", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("  JavaScript:alert(1)")).toBe(false);
    expect(isSafeHref("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeHref("vbscript:msgbox(1)")).toBe(false);
    expect(isSafeHref("file:///etc/passwd")).toBe(false);
    expect(isSafeHref("")).toBe(false);
  });
});

describe("isSafeHref hardening", () => {
  test("refuses protocol-relative and backslash hosts", () => {
    for (const h of ["//evil.example", "\\\\evil.example", "\\evil.example", "/\\evil.example","  //evil.example", "\t//evil.example", "/\t/evil.example"]) {
      expect(isSafeHref(h)).toBe(false);
    }
  });

  test("refuses a scheme hidden behind control characters or whitespace", () => {
    for (const h of ["java\tscript:alert(1)", "\u0000javascript:alert(1)", "java\nscript:alert(1)", "jav\u0001ascript:alert(1)", "  \r\njavascript:alert(1)"]) {
      expect(isSafeHref(h)).toBe(false);
    }
  });

  test("still keeps http, https, mailto, anchors and single-slash paths", () => {
    for (const h of ["http://a.example", "https://a.example/x", "mailto:a@b.com", "#top", "/api/x", "/"]) {
      expect(isSafeHref(h)).toBe(true);
    }
  });
});

describe("safeOutwardHref", () => {
  test("returns the blank-stripped href for http, https and mailto only", () => {
    expect(safeOutwardHref("https://a.example/x")).toBe("https://a.example/x");
    expect(safeOutwardHref(" HTTP://A.example ")).toBe("HTTP://A.example");
    expect(safeOutwardHref("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(safeOutwardHref("ht\ttps://a.example")).toBe("https://a.example");
  });

  test("keeps interior spaces; only the ends and tab/LF/CR are stripped, as a browser does", () => {
    expect(safeOutwardHref("mailto:a@b.com?subject=Hi there")).toBe("mailto:a@b.com?subject=Hi there");
    expect(safeOutwardHref(" https://a.example/my path ")).toBe("https://a.example/my path");
    expect(safeOutwardHref("https://a.example/x\ty")).toBe("https://a.example/xy");
    expect(safeOutwardHref("\u0000javascript:alert(1)")).toBeNull();
    expect(safeOutwardHref("java\tscript:alert(1)")).toBeNull();
    expect(safeOutwardHref("java script:alert(1)")).toBeNull();
    expect(isSafeHref("/a path")).toBe(true);
    expect(isSafeHref("/ /evil.example")).toBe(true);
  });

  test("refuses everything else, including relative and fragment links", () => {
    for (const h of ["", "#x", "/x", "//evil.example", "javascript:alert(1)", "java\tscript:alert(1)", "data:text/html,x", "file:///etc/passwd"]) {
      expect(safeOutwardHref(h)).toBeNull();
    }
  });
});

describe("escapeHtml", () => {
  test("escapes the five significant characters once", () => {
    expect(escapeHtml(`<a href="x">'&amp;'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;amp;&#39;&lt;/a&gt;");
  });
});

describe("linkifyEscaped", () => {
  test("wraps a bare http/https url in an anchor to itself", () => {
    const out = linkifyEscaped("see https://janitorai.com/profiles/abc for more");
    expect(out).toContain('<a href="https://janitorai.com/profiles/abc"');
    expect(out).toContain(">https://janitorai.com/profiles/abc</a>");
  });

  test("escapes surrounding text and never interprets it as markup", () => {
    const out = linkifyEscaped("<b>not bold</b> https://x.com");
    expect(out).toContain("&lt;b&gt;not bold&lt;/b&gt;");
    expect(out).not.toContain("<b>");
  });

  test("leaves trailing sentence punctuation outside the link", () => {
    const out = linkifyEscaped("go to https://x.com.");
    expect(out).toContain('href="https://x.com"');
    expect(out).toContain("</a>.");
  });

  test("plain text with no url is just escaped, no anchors", () => {
    expect(linkifyEscaped("just a version 1.2")).toBe("just a version 1.2");
    expect(linkifyEscaped("a & b < c")).toBe("a &amp; b &lt; c");
  });
});

describe("capInput", () => {
  test("passes through content within the cap unchanged", () => {
    const s = "a".repeat(100);
    expect(capInput(s)).toBe(s);
  });

  test("truncates content above the cap to exactly the cap length", () => {
    const s = "a".repeat(RENDER_INPUT_CAP + 500);
    expect(capInput(s).length).toBe(RENDER_INPUT_CAP);
  });
});

describe("sanitizeInlineStyle", () => {
  test("keeps the small presentation allowlist", () => {
    expect(ALLOWED_INLINE_STYLE_PROPS.has("text-align")).toBe(true);
    const out = sanitizeInlineStyle("text-align: center; color: #c00; font-weight: bold");
    expect(out).toContain("text-align: center");
    expect(out).toContain("color: #c00");
    expect(out).toContain("font-weight: bold");
  });

  test("drops remote url() and image-set", () => {
    expect(sanitizeInlineStyle("background: url(https://evil.test/x.png)")).toBe("");
    expect(sanitizeInlineStyle("background-image: image-set(url(https://evil.test/x.png) 1x)")).toBe("");
    expect(isSafeStyleValue("url(https://evil.test/x.png)")).toBe(false);
  });

  test("drops custom-property indirection and case-varied URL forms", () => {
    expect(isSafeStyleValue("var(--x)")).toBe(false);
    expect(isSafeStyleValue(" URL( 'https://evil.test/d.png' ) ")).toBe(false);
    expect(sanitizeInlineStyle("--x:url(https://evil.test/c.png); background: var(--x)")).toBe("");
  });

  test("drops unknown properties even with safe values", () => {
    expect(sanitizeInlineStyle("position: absolute; display: none")).toBe("");
  });
});
