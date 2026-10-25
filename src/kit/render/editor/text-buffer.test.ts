/**
 * A block of text with a cursor in it.
 *
 * Every operation here is an off-by-one waiting to happen, and the ones that bite are all at edges:
 * backspace at the start of a line, up-arrow into a shorter one, home on an empty document. Those
 * are most of the tests.
 */
import { describe, expect, test } from "bun:test";
import {
  backspace, bufferOf, deleteForward, insert, move, newline, textOf, visibleWindow,
} from "./text-buffer";

const at = (text: string, row: number, col: number) => ({ ...bufferOf(text), row, col });
const pos = (b: { row: number; col: number }) => [b.row, b.col];

describe("bufferOf", () => {
  test("it lands the cursor at the end, where typing starts", () => {
    expect(pos(bufferOf("ab\ncde"))).toEqual([1, 3]);
  });

  test("empty text is one empty line, not zero lines", () => {
    // Zero lines has no valid cursor position at all.
    expect(bufferOf("").lines).toEqual([""]);
    expect(pos(bufferOf(""))).toEqual([0, 0]);
  });

  test("it round-trips", () => {
    const text = "one\n\nthree\n";
    expect(textOf(bufferOf(text))).toBe(text);
  });
});

describe("insert", () => {
  test("a character goes in at the cursor, not at the end", () => {
    // The thing the old single-string editor could not do.
    expect(textOf(insert(at("abcd", 0, 2), "X"))).toBe("abXcd");
  });

  test("the cursor follows what was typed", () => {
    expect(pos(insert(at("abcd", 0, 2), "X"))).toEqual([0, 3]);
  });

  test("inserting beside a combining mark does not leave the cursor inside the new grapheme", () => {
    const joined = insert(move(bufferOf("\u0301"), "home"), "a");
    expect(textOf(joined)).toBe("a\u0301");
    expect(pos(joined)).toEqual([0, 2]);
    expect(textOf(backspace(joined))).toBe("");
  });

  test("typing before multiple combining marks leaves the caret after the merged grapheme", () => {
    const typed = insert(move(bufferOf("\u0301\u0302b"), "home"), "a");
    expect(textOf(typed)).toBe("a\u0301\u0302b");
    expect(pos(typed)).toEqual([0, 3]);
    expect(textOf(insert(typed, "x"))).toBe("a\u0301\u0302xb");
  });

  test("it works on the second line", () => {
    expect(textOf(insert(at("ab\ncd", 1, 1), "X"))).toBe("ab\ncXd");
  });
});

describe("newline", () => {
  test("THE KEY THAT USED TO COMMIT now splits the line", () => {
    // Enter was the commit key, so a paragraph break was not a character anybody could type.
    expect(textOf(newline(at("abcd", 0, 2)))).toBe("ab\ncd");
  });

  test("the cursor lands at the start of the new line", () => {
    expect(pos(newline(at("abcd", 0, 2)))).toEqual([1, 0]);
  });

  test("at the end of a line it opens an empty one", () => {
    expect(textOf(newline(at("ab", 0, 2)))).toBe("ab\n");
  });
});

describe("backspace", () => {
  test("it deletes the character before the cursor", () => {
    expect(textOf(backspace(at("abcd", 0, 2)))).toBe("acd");
  });

  test("AT THE START OF A LINE it joins to the one above", () => {
    const joined = backspace(at("ab\ncd", 1, 0));
    expect(textOf(joined)).toBe("abcd");
    // Landing where the join happened, which is where the eye already is.
    expect(pos(joined)).toEqual([0, 2]);
  });

  test("joining lines snaps the caret when the graphemes merge across the newline", () => {
    const joined = backspace(move(bufferOf("a\n\u0301b"), "home"));
    expect(textOf(joined)).toBe("a\u0301b");
    expect(pos(joined)).toEqual([0, 2]);
    expect(textOf(backspace(joined))).toBe("b");
  });

  test("at the very start of the document it does nothing", () => {
    const b = at("abcd", 0, 0);
    expect(backspace(b)).toEqual(b);
  });

  // B30: col is a UTF-16 offset, but a single backspace must delete one whole grapheme cluster,
  // never half of one - half of a surrogate pair, a base character stripped of its combining mark,
  // or one member of a ZWJ family sequence.
  test("deletes a whole astral emoji (a surrogate pair), not half of one", () => {
    const text = "a\u{1F44D}b"; // a + U+1F44D (2 UTF-16 units) + b
    const b = backspace(at(text, 0, 3)); // cursor just after the emoji
    expect(textOf(b)).toBe("ab");
    expect(pos(b)).toEqual([0, 1]);
  });

  test("deletes a base character and its combining mark together", () => {
    const text = "e\u{0301}x"; // "e" + U+0301 COMBINING ACUTE ACCENT + "x"
    const b = backspace(at(text, 0, 2));
    expect(textOf(b)).toBe("x");
    expect(pos(b)).toEqual([0, 0]);
  });

  test("deletes a whole ZWJ family emoji in one press", () => {
    const family = "\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F466}"; // man-ZWJ-woman-ZWJ-boy
    const text = `a${family}b`;
    const b = backspace(at(text, 0, 1 + family.length));
    expect(textOf(b)).toBe("ab");
    expect(pos(b)).toEqual([0, 1]);
  });
});

describe("deleteForward", () => {
  test("it deletes the character under the cursor", () => {
    expect(textOf(deleteForward(at("abcd", 0, 1)))).toBe("acd");
  });

  test("at the end of a line it pulls the next one up", () => {
    expect(textOf(deleteForward(at("ab\ncd", 0, 2)))).toBe("abcd");
  });

  test("at the very end it does nothing", () => {
    const b = at("ab", 0, 2);
    expect(deleteForward(b)).toEqual(b);
  });

  // B30: Delete-forward at the cursor must remove one whole grapheme cluster starting there.
  test("deletes a whole astral emoji forward, not half of one", () => {
    const text = "a\u{1F44D}b";
    expect(textOf(deleteForward(at(text, 0, 1)))).toBe("ab");
  });
});

describe("move", () => {
  test("left and right WRAP BETWEEN LINES", () => {
    // A document is one stream to the person reading it; stopping dead at a line end feels broken.
    expect(pos(move(at("ab\ncd", 1, 0), "left"))).toEqual([0, 2]);
    expect(pos(move(at("ab\ncd", 0, 2), "right"))).toEqual([1, 0]);
  });

  test("they stop at the ends of the document rather than wrapping around it", () => {
    expect(pos(move(at("ab", 0, 0), "left"))).toEqual([0, 0]);
    expect(pos(move(at("ab", 0, 2), "right"))).toEqual([0, 2]);
  });

  // B30: left/right must step over a whole grapheme cluster, never land inside a surrogate pair
  // or between a base character and its combining mark.
  test("left steps over a whole astral emoji, landing before it", () => {
    const text = "a\u{1F44D}b";
    expect(pos(move(at(text, 0, 3), "left"))).toEqual([0, 1]);
  });

  test("right steps over a whole astral emoji, landing after it", () => {
    const text = "a\u{1F44D}b";
    expect(pos(move(at(text, 0, 1), "right"))).toEqual([0, 3]);
  });

  test("UP AND DOWN INTO A SHORTER LINE clamp instead of refusing", () => {
    // What every editor does, and what fingers expect.
    expect(pos(move(at("abcdef\nxy", 0, 5), "down"))).toEqual([1, 2]);
    expect(pos(move(at("xy\nabcdef", 1, 5), "up"))).toEqual([0, 2]);
  });

  test("vertical movement snaps an in-cluster UTF-16 column to the nearest grapheme boundary", () => {
    const down = move(at("ab\na\u{1F44D}b", 0, 2), "down");
    // Desired column 2 is midway through the emoji at offsets 1..3; ties choose its trailing edge.
    expect(pos(down)).toEqual([1, 3]);
    const typed = insert(down, "X");
    expect(textOf(typed)).toBe("ab\na\u{1F44D}Xb");
    expect(textOf(backspace(typed))).toBe("ab\na\u{1F44D}b");
  });

  test("up at the top and down at the bottom stay put", () => {
    expect(pos(move(at("ab\ncd", 0, 1), "up"))).toEqual([0, 1]);
    expect(pos(move(at("ab\ncd", 1, 1), "down"))).toEqual([1, 1]);
  });

  test("home, end, top and bottom", () => {
    expect(pos(move(at("abcd\nef", 0, 2), "home"))).toEqual([0, 0]);
    expect(pos(move(at("abcd\nef", 0, 2), "end"))).toEqual([0, 4]);
    expect(pos(move(at("abcd\nef", 1, 1), "top"))).toEqual([0, 0]);
    expect(pos(move(at("abcd\nef", 0, 0), "bottom"))).toEqual([1, 2]);
  });

  test("every move on an empty document is a no-op that stays valid", () => {
    for (const how of ["left", "right", "up", "down", "home", "end", "top", "bottom"] as const) {
      expect(pos(move(bufferOf(""), how))).toEqual([0, 0]);
    }
  });
});

describe("visibleWindow", () => {
  test("a short document is shown whole", () => {
    expect(visibleWindow(bufferOf("a\nb\nc"), 10)).toEqual({ from: 0, to: 3 });
  });

  test("it keeps the cursor on screen, centred", () => {
    const long = Array.from({ length: 100 }, (_, i) => `line ${String(i)}`).join("\n");
    const win = visibleWindow({ ...bufferOf(long), row: 50, col: 0 }, 10);
    expect(win.from).toBeLessThanOrEqual(50);
    expect(win.to).toBeGreaterThan(50);
    expect(win.to - win.from).toBe(10);
  });

  test("it never scrolls past either end", () => {
    const long = Array.from({ length: 20 }, (_, i) => String(i)).join("\n");
    expect(visibleWindow({ ...bufferOf(long), row: 0, col: 0 }, 5).from).toBe(0);
    expect(visibleWindow({ ...bufferOf(long), row: 19, col: 0 }, 5).to).toBe(20);
  });
});
