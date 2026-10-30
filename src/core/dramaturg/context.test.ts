/**
 * The Dramaturg's evidence block (specs/stage/dramaturg.md, "The evidence block"): each section's cap, the 48,000 total, the sacrifice
 * order (lore, then the oldest messages, then preset blocks), the card and persona clipped but never dropped, every cut named at the end
 * with the tool that reaches it, and the hidden messages noted.
 */
import { describe, expect, test } from "bun:test";
import { dramaturgEvidence, EVIDENCE_CAPS, type EvidenceInput } from "./context";

const card = { name: "Vera", description: "Keeps the light.", personality: "Dry.", scenario: "A storm night.", examples: "", postHistory: "Stay terse.", characterPrompt: "" };
const msg = (number: number, text = `line ${number}`) => ({ number, speaker: number % 2 ? "Vera" : "Mira", text });
const base = (over: Partial<EvidenceInput> = {}): EvidenceInput => ({
  card, persona: { name: "Mira", text: "A surveyor." },
  preset: [{ id: "main", name: "Main", content: "Write as Vera." }],
  lore: [{ title: "The Pier", book: "Harbor", content: "Salt and rope.", reason: "key", matched: ["pier"] }, { title: "Bell", book: "Harbor", content: "It rings.", reason: "constant", matched: [] }],
  loreCut: 0, messages: [msg(1), msg(2), msg(4)], hidden: 0, ...over,
});
const big = (n: number, ch = "x") => ch.repeat(n);

describe("dramaturgEvidence", () => {
  test("a small scene: every section whole, with the scene's own numbers, and nothing left out", () => {
    const { block, trimmed } = dramaturgEvidence(base());
    expect(trimmed).toEqual([]);
    expect(block).not.toContain("WHAT WAS LEFT OUT");
    for (const part of ["THE CHARACTER CARD: Vera", "### Description\nKeeps the light.", "### Post-history instructions\nStay terse.", "THE PERSONA: Mira", "A surveyor.", "### Main [main]\nWrite as Vera.", "### The Pier (Harbor; matched: pier)", "### Bell (Harbor; always on)", "#4 Mira:\nline 4", "#2 Mira:\nline 2"]) expect(block).toContain(part);
    expect(block).not.toContain("### Example dialogue");
    expect(block).not.toContain("HIDDEN");
  });

  test("hidden messages are counted and said to be out of the narrator's prompt too; the narrator's lore cut is counted", () => {
    const { block } = dramaturgEvidence(base({ hidden: 2, loreCut: 3 }));
    expect(block).toMatch(/2 messages of this scene are hidden/);
    expect(block).toContain("left out of the narrator's prompt");
    expect(block).toMatch(/3 more matched but were cut by the narrator's lore budget/);
  });

  test("the card and the persona are clipped to their caps, named, and kept", () => {
    const { block, trimmed } = dramaturgEvidence(base({ card: { ...card, description: big(20_000, "d") }, persona: { name: "Mira", text: big(9_000, "p") } }));
    expect(block).toContain(big(EVIDENCE_CAPS.card - 30, "d"));
    expect(block).not.toContain(big(EVIDENCE_CAPS.card + 1, "d"));
    expect(block).toContain(big(EVIDENCE_CAPS.persona, "p"));
    expect(block).not.toContain(big(EVIDENCE_CAPS.persona + 1, "p"));
    expect(trimmed.some((t) => t.startsWith("The character card, clipped at 12,000 characters"))).toBe(true);
    expect(trimmed.some((t) => t.startsWith("The persona, clipped at 4,000 characters"))).toBe(true);
  });

  test("preset blocks: each clipped at 2,000, 10,000 in all, the rest named with read_preset_block", () => {
    const preset = Array.from({ length: 8 }, (_, i) => ({ id: `b${i}`, name: `Block ${i}`, content: big(2_500, String(i)) }));
    const { block, trimmed } = dramaturgEvidence(base({ preset }));
    expect(block).toContain("### Block 3 [b3]");
    expect(block).not.toContain("### Block 4 [b4]");
    expect(block).not.toContain(big(EVIDENCE_CAPS.block + 1, "0"));
    expect(trimmed).toContainEqual(expect.stringMatching(/^Preset blocks clipped at 2,000 characters: Block 0, Block 1, Block 2, Block 3\. read_preset_block/));
    expect(trimmed).toContainEqual(expect.stringMatching(/^Preset blocks left out: Block 4, Block 5, Block 6, Block 7\. read_preset_block/));
  });

  test("lore: 10,000 in all, the rest named with search_lorebook and read_lorebook_entry", () => {
    const lore = Array.from({ length: 5 }, (_, i) => ({ title: `E${i}`, book: "Harbor", content: big(3_000, String(i)), reason: "constant", matched: [] }));
    const { block, trimmed } = dramaturgEvidence(base({ lore }));
    expect(block).toContain("### E2 (Harbor");
    expect(block).not.toContain("### E3 (Harbor");
    expect(trimmed).toContainEqual(expect.stringMatching(/^Lore entries left out: E3 \(Harbor\), E4 \(Harbor\)\. search_lorebook .* read_lorebook_entry/));
  });

  test("messages: the last 30 visible, each clipped at 3,000, 20,000 in all with the newest kept, earlier ones named", () => {
    const messages = Array.from({ length: 40 }, (_, i) => msg(i + 1, i === 39 ? big(5_000, "z") : `line ${i + 1}`));
    const one = dramaturgEvidence(base({ messages }));
    expect(one.block).toContain("#11 Vera:\nline 11");
    expect(one.block).not.toContain("#10 Mira:");
    expect(one.block).not.toContain(big(EVIDENCE_CAPS.message + 1, "z"));
    expect(one.trimmed).toContainEqual(expect.stringMatching(/^Messages clipped at 3,000 characters: #40\. read_scene_messages/));
    expect(one.trimmed).toContainEqual(expect.stringMatching(/^Messages before #11: .*search_scene_messages.*read_scene_messages/));

    const long = Array.from({ length: 30 }, (_, i) => msg(i + 1, big(2_400, "m")));
    const two = dramaturgEvidence(base({ messages: long }));
    expect(two.block).toContain("#30 Mira:");
    expect(two.block).toContain("#23 Vera:");
    expect(two.block).not.toContain("#22 Mira:");
    expect(two.trimmed).toContainEqual(expect.stringMatching(/^Messages before #23:/));
  });

  test("over the total: lore goes first, while dropping it is enough the messages, preset, card and persona all stay", () => {
    const full = base({
      card: { ...card, description: big(12_000, "d") }, persona: { name: "Mira", text: big(4_000, "p") },
      preset: Array.from({ length: 5 }, (_, i) => ({ id: `b${i}`, name: `Block ${i}`, content: big(1_900, "q") })),
      lore: Array.from({ length: 5 }, (_, i) => ({ title: `E${i}`, book: "Harbor", content: big(1_900, "l"), reason: "constant", matched: [] })),
      messages: Array.from({ length: 30 }, (_, i) => msg(i + 1, big(500, "m"))),
    });
    const { block, trimmed } = dramaturgEvidence(full);
    expect(block.length).toBeLessThanOrEqual(EVIDENCE_CAPS.total);
    expect((block.match(/### E\d \(Harbor/g) ?? []).length).toBeLessThan(5);
    expect(block).toContain("#1 Vera:");
    expect(block).toContain("### Block 4 [b4]");
    expect(block).toContain(big(4_000, "p"));
    expect(trimmed.some((t) => t.startsWith("Lore entries left out: "))).toBe(true);
  });

  test("the sacrifice order holds at any total: lore, then the oldest messages, then preset blocks; never the card or persona", () => {
    const input = base({
      preset: [{ id: "a", name: "A", content: big(900, "a") }, { id: "b", name: "B", content: big(900, "b") }],
      lore: [{ title: "L1", book: "Harbor", content: big(900, "l"), reason: "constant", matched: [] }, { title: "L2", book: "Harbor", content: big(900, "l"), reason: "constant", matched: [] }],
      messages: [msg(1, big(900, "m")), msg(2, big(900, "m")), msg(3, big(900, "m"))],
    });
    let presetWent = false;
    let messageWent = false;
    for (let total = 1_500; total <= 10_000; total += 100) {
      const { block, trimmed } = dramaturgEvidence(input, { ...EVIDENCE_CAPS, total });
      const has = (s: string) => block.includes(s);
      const lore = ["### L1 (", "### L2 ("].filter(has).length;
      const msgs = ["#1 Vera:", "#2 Mira:", "#3 Vera:"].map(has);
      const preset = ["### A [a]", "### B [b]"].filter(has).length;
      expect(has("Keeps the light.") && has("A surveyor.")).toBe(true);
      if (msgs.includes(false)) expect(lore).toBe(0);
      if (preset < 2) expect(msgs.some(Boolean)).toBe(false);
      expect(msgs).toEqual([...msgs].sort((x, y) => Number(x) - Number(y)));
      if (lore > 0 || preset > 0 || msgs.some(Boolean)) expect(block.length).toBeLessThanOrEqual(total);
      if (preset < 2) expect(trimmed).toContainEqual(expect.stringMatching(/^Preset blocks left out: (A, )?B\./));
      presetWent ||= preset < 2;
      messageWent ||= msgs.includes(false);
    }
    expect(presetWent && messageWent).toBe(true);
  });

  test("an empty card, no persona, no preset, no lore and no messages each say so", () => {
    const { block } = dramaturgEvidence({ card: { ...card, description: "", personality: "", scenario: "", postHistory: "" }, preset: [], lore: [], loreCut: 0, messages: [], hidden: 0 });
    expect(block).toContain("the card is empty");
    expect(block).toContain("The scene has no persona");
    expect(block).toContain("No preset block is on");
    expect(block).toContain("No lore entry was in the narrator's prompt");
    expect(block).toContain("has no stored messages yet");
    expect(dramaturgEvidence(base({ messages: [], hidden: 2 })).block).toContain("No visible message is in this block.");
  });
});
