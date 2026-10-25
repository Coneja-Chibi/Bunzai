/**
 * ST chat codec: the shapes of real chat files, redacted to invented text. Every mapping
 * decision in chat.ts is pinned here: swipes, `mes` as the showing text, the three time shapes, hidden
 * lines, system notices, group refusal, and tolerance for a damaged line.
 */
import { describe, expect, test } from "bun:test";
import { readChat, looksLikeChat } from "./chat";
import { parseStTime } from "./chat-dates";
import { SceneRefusal } from "../../core/scene-import";

const lines = (...records: unknown[]) => records.map((r) => (typeof r === "string" ? r : JSON.stringify(r))).join("\n") + "\n";
const header = { user_name: "Bee", character_name: "Vera", create_date: "2025-6-24 @12h 43m 31s 310ms", chat_metadata: { integrity: "x", variables: { turn: "3" } } };
const greeting = {
  name: "Vera", is_user: false, is_system: false, send_date: "June 24, 2025 6:22pm", mes: "Welcome back.",
  extra: {}, swipes: ["Hello, traveller.", "Welcome back."], swipe_id: 1,
  swipe_info: [{ send_date: "June 24, 2025 6:22pm", extra: {} }, { send_date: "June 24, 2025 6:25pm", extra: {} }],
};
const user = { name: "Bee", is_user: true, is_system: false, send_date: "June 24, 2025 6:30pm", mes: "Hi.", extra: { isSmallSys: false, token_count: 3, reasoning: "" }, force_avatar: "/thumbnail?type=persona&file=x.png" };
const reply = {
  name: "Vera", is_user: false, is_system: false, send_date: "2025-06-24T22:31:00.000Z", mes: "A reply.", title: "",
  gen_started: "2025-06-24T22:30:50.000Z", gen_finished: "2025-06-24T22:31:00.500Z",
  extra: { api: "makersuite", model: "gemini-2.5-pro", reasoning: "I should greet.", reasoning_signature: "sig", token_count: 4 },
  swipes: ["A reply."], swipe_id: 0, swipe_info: [{ send_date: "2025-06-24T22:31:00.000Z", gen_started: "2025-06-24T22:30:50.000Z", gen_finished: "2025-06-24T22:31:00.500Z", extra: { model: "gemini-2.5-pro", reasoning: "I should greet." } }],
};

describe("the three time shapes", () => {
  test("humanized, ISO and epoch all read; a time in 12 o'clock is not 24", () => {
    expect(parseStTime("June 24, 2025 6:22pm")).toBe(new Date(2025, 5, 24, 18, 22).getTime());
    expect(parseStTime("December 29, 2025 12:05am")).toBe(new Date(2025, 11, 29, 0, 5).getTime());
    expect(parseStTime("July 1, 2025 12:00pm")).toBe(new Date(2025, 6, 1, 12, 0).getTime());
    expect(parseStTime("2025-06-24T22:31:00.000Z")).toBe(Date.UTC(2025, 5, 24, 22, 31));
    expect(parseStTime("1750803770545")).toBe(1750803770545);
    expect(parseStTime(1750803770545)).toBe(1750803770545);
    expect(parseStTime("2025-6-24 @12h 43m 31s 310ms")).toBe(new Date(2025, 5, 24, 12, 43, 31, 310).getTime());
    expect(parseStTime("2025-06-24@13h00m58s")).toBe(new Date(2025, 5, 24, 13, 0, 58).getTime());
  });
  test("anything else is null, never a guess", () => {
    for (const bad of ["", "yesterday", "June 24, 2025 13:22pm", "Smarch 4, 2025 1:00am", null, undefined, -5, 1.5, {}]) expect(parseStTime(bad)).toBeNull();
  });
});

describe("a chat with a header", () => {
  const scene = readChat(lines(header, greeting, user, reply), "Vera - 2025-06-24@18h22m00s.jsonl");
  const [first, second, third] = scene.body.messages;

  test("is a scene carrier, not a library entity, with the source named", () => {
    expect(scene.kind).toBe("scene");
    expect(scene.body.source).toBe("sillytavern-chat");
    expect(scene.id).toBe("chat-vera-2025-06-24-18h22m00s");
  });

  test("roles, speakers and order follow the file", () => {
    expect(scene.body.messages.map((m) => [m.role, m.speaker])).toEqual([["assistant", "Vera"], ["user", "Bee"], ["assistant", "Vera"]]);
  });

  test("swipes keep every alternative, with the showing one current and each its own time", () => {
    expect(first!.swipes.map((s) => s.content)).toEqual(["Hello, traveller.", "Welcome back."]);
    expect(first!.current).toBe(1);
    expect(first!.swipes[1]!.createdAt).toBe(new Date(2025, 5, 24, 18, 25).getTime());
    expect(first!.createdAt).toBe(new Date(2025, 5, 24, 18, 22).getTime());
    expect(second!.swipes).toHaveLength(1);
  });

  test("model, reasoning with its signature, and generation time ride on the reply; a user line has none", () => {
    expect(third!.swipes[0]!.generation).toEqual({ model: "gemini-2.5-pro", generationMs: 10_500, reasoning: { text: "I should greet.", signature: "sig", model: "gemini-2.5-pro" } });
    expect(second!.swipes[0]!.generation).toBeUndefined();
    expect(first!.swipes[1]!.generation).toBeUndefined();
  });

  test("names to look up: the replies' speakers, the header's kept apart as a fallback; the persona's by most recent", () => {
    expect(scene.body.characterNames).toEqual(["Vera"]);
    expect(scene.body.headerCharacter).toBe("Vera");
    expect(scene.body.personaNames).toEqual(["Bee"]);
  });

  test("the scene starts at its first moment (or the header's, if earlier) and ends at its last", () => {
    expect(scene.body.createdAt).toBe(new Date(2025, 5, 24, 12, 43, 31, 310).getTime());
    expect(scene.body.updatedAt).toBe(Date.UTC(2025, 5, 24, 22, 31));
    expect(scene.body.notes).toEqual(["1 message has swipes, all kept.", "1 chat variable comes along as the take's variables."]);
  });
});

describe("mes is what the reader saw", () => {
  test("a swipe list that disagrees with mes loses to mes, and the receipt says so", () => {
    const edited = { ...greeting, mes: "Edited by hand.", swipes: ["Hello, traveller.", "Welcome back."], swipe_id: 0 };
    const [m] = readChat(lines(header, edited), "x.jsonl").body.messages;
    expect(m!.swipes.map((s) => s.content)).toEqual(["Edited by hand.", "Welcome back."]);
    expect(m!.current).toBe(0);
    expect(readChat(lines(header, edited), "x.jsonl").body.notes).toContain("1 message's shown text and swipe list disagreed; the text that was showing is kept.");
  });

  test("a swipe_id out of range falls back to the swipe that equals mes", () => {
    const [m] = readChat(lines(header, { ...greeting, swipe_id: 9, mes: "Welcome back." }), "x.jsonl").body.messages;
    expect([m!.current, m!.swipes.length]).toEqual([1, 2]);
  });

  test("with mes in no swipe at all, it becomes one more swipe and the current one", () => {
    const [m] = readChat(lines(header, { ...greeting, swipe_id: 9, mes: "Nobody wrote this swipe." }), "x.jsonl").body.messages;
    expect(m!.swipes.map((s) => s.content)).toEqual(["Hello, traveller.", "Welcome back.", "Nobody wrote this swipe."]);
    expect(m!.current).toBe(2);
  });

  test("a message with no swipes list is one swipe; one with no swipe_info still reads", () => {
    const [m] = readChat(lines(header, user), "x.jsonl").body.messages;
    expect(m!.swipes).toHaveLength(1);
    const bare = readChat(lines(header, { name: "Vera", is_user: false, send_date: "June 24, 2025 6:22pm", mes: "x", swipes: ["x", "y"], swipe_id: 0 }), "x.jsonl").body.messages[0]!;
    expect(bare.swipes.map((s) => s.createdAt)).toEqual([bare.createdAt, bare.createdAt]);
  });
});

describe("what a scene has no place for is said, not dropped", () => {
  const hidden = { ...reply, is_system: true };
  const notice = { name: "BunnyMoTags", is_user: false, is_system: true, send_date: "June 24, 2025 6:40pm", mes: "[tags]", extra: { type: "bunnymo_system_message" } };

  test("a hidden-from-prompt line, user or reply, is flagged hidden and counted on the receipt", () => {
    const scene = readChat(lines(header, user, hidden, { ...user, is_system: true }), "x.jsonl");
    expect(scene.body.messages.map((m) => [m.role, m.hidden])).toEqual([["user", undefined], ["assistant", true], ["user", true]]);
    expect(scene.body.notes).toContain("2 messages were hidden from the prompt in SillyTavern and stay hidden here.");
  });

  test("a system notice is a system line, and is not counted as hidden", () => {
    const scene = readChat(lines(header, user, notice), "x.jsonl");
    expect(scene.body.messages[1]!.role).toBe("system");
    expect(scene.body.messages[1]!.hidden).toBeUndefined();
    expect(scene.body.notes.join(" ")).not.toContain("hidden");
  });
});

describe("a file with no header, an odd line, or no readable time", () => {
  test("a headerless old file reads, taking the character from the replies", () => {
    const scene = readChat(lines(user, reply), "old.jsonl");
    expect(scene.body.characterNames).toEqual(["Vera"]);
    expect(scene.body.personaNames).toEqual(["Bee"]);
  });

  test("a header that says 'unused' names nobody", () => {
    const scene = readChat(lines({ ...header, user_name: "unused", character_name: "unused" }, user, reply), "x.jsonl");
    expect(scene.body.characterNames).toEqual(["Vera"]);
    expect(scene.body.headerCharacter).toBeUndefined();
  });

  test("a damaged line is skipped and counted; the rest imports", () => {
    const scene = readChat(lines(header, user, "{not json", "[1,2]", reply), "x.jsonl");
    expect(scene.body.messages).toHaveLength(2);
    expect(scene.body.notes).toContain("2 unreadable lines were skipped.");
  });

  test("a message with no readable time takes the one before it", () => {
    const scene = readChat(lines(header, user, { ...reply, send_date: "sometime" }), "x.jsonl");
    expect(scene.body.messages[1]!.createdAt).toBe(scene.body.messages[0]!.createdAt);
    expect(scene.body.notes).toContain("1 message has no readable time, so it takes the time of the line before.");
  });

  test("CRLF line endings read the same", () => {
    expect(readChat(lines(header, user, reply).replace(/\n/g, "\r\n"), "x.jsonl").body.messages).toHaveLength(2);
  });
});

describe("what it refuses", () => {
  const refusal = (raw: string) => { try { readChat(raw, "x.jsonl"); return null; } catch (e) { return e; } };

  test("a chat with no messages", () => {
    expect(refusal(lines(header))).toBeInstanceOf(SceneRefusal);
  });

  test("a group chat, by its flag, its present list, or replies from two character avatars, naming who spoke", () => {
    const a = { ...reply, name: "Midas", original_avatar: "Midas.png" };
    const b = { ...reply, name: "Icarus", original_avatar: "Icarus.png" };
    for (const group of [lines(header, { ...user, is_group: true }, a), lines(header, user, { ...a, present: ["Midas.png"] }), lines(user, a, b)]) {
      const e = refusal(group) as SceneRefusal;
      expect(e).toBeInstanceOf(SceneRefusal);
      expect(e.message).toContain("group chat");
      expect(e.message).toContain("Midas");
    }
  });

  test("a card swap in a one-on-one chat (the same avatar, a new name) is not a group", () => {
    const renamed = { ...reply, name: "Vera & Co", original_avatar: "Vera.png" };
    const scene = readChat(lines(header, { ...reply, original_avatar: "Vera.png" }, user, renamed), "x.jsonl");
    expect(scene.body.characterNames).toEqual(["Vera", "Vera & Co"]);
  });
});

describe("detection", () => {
  test("a .jsonl whose first line is a header or a message is a chat; nothing else is", () => {
    expect(looksLikeChat({ filename: "a.jsonl", text: lines(header, user) })).toBe(true);
    expect(looksLikeChat({ filename: "a.jsonl", text: lines(user, reply) })).toBe(true);
    expect(looksLikeChat({ filename: "a.jsonl", text: lines({ role: "user", content: "x" }) })).toBe(false);
    expect(looksLikeChat({ filename: "a.jsonl", text: "not json" })).toBe(false);
    expect(looksLikeChat({ filename: "a.json", text: lines(header, user) })).toBe(false);
    expect(looksLikeChat({ filename: "a.jsonl" })).toBe(false);
  });
});

describe("persona avatars, chat variables, and what the receipt says is not carried", () => {
  test("a user line's force_avatar becomes its avatar stem, from a thumbnail url, a folder path or a bare file", () => {
    const at = (force_avatar: unknown) => readChat(lines(header, { ...user, force_avatar }), "x.jsonl").body.messages[0]!.avatar;
    expect(at("/thumbnail?type=persona&file=1753673581093-Chi.png")).toBe("1753673581093-Chi");
    expect(at("/thumbnail?type=persona&file=My%20Persona.png")).toBe("My Persona");
    expect(at("User Avatars/user-default.png")).toBe("user-default");
    expect(at("x.png")).toBe("x");
    expect(at(undefined)).toBeUndefined();
    expect(readChat(lines(header, { ...reply, force_avatar: "/thumbnail?type=avatar&file=Vera.png" }), "x.jsonl").body.messages[0]!.avatar).toBeUndefined();
  });

  test("chat variables ride along; the author's note, timed world info and scenario are named as not carried", () => {
    const meta = { variables: { mood: "calm", turn: "3" }, note_prompt: "keep it short", timedWorldInfo: { sticky: { a: { start: 1 } }, cooldown: {} }, scenario: "A harbor." };
    const scene = readChat(lines({ ...header, chat_metadata: meta }, user), "x.jsonl");
    expect(scene.body.variables).toEqual({ mood: "calm", turn: "3" });
    expect(scene.body.notes).toContain("2 chat variables come along as the take's variables.");
    expect(scene.body.notes).toContain("Not carried (a scene has no place for them yet): the author's note, timed world info, the scenario. Your .jsonl file keeps them.");
  });

  test("empty metadata says nothing and carries no variables", () => {
    const scene = readChat(lines({ ...header, chat_metadata: { note_prompt: "", timedWorldInfo: { sticky: {} }, variables: {} } }, user), "x.jsonl");
    expect(scene.body.variables).toBeUndefined();
    expect(scene.body.notes.join(" ")).not.toContain("Not carried");
  });
});
