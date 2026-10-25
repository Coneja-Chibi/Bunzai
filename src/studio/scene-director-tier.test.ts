/** The Director's two actions are held to the tier the scene table gives them: a table that says anything but write refuses them, and says why. */
import { describe, expect, test } from "bun:test";
import { memoryChatStore } from "../stage/store/chat-store";
import { DIRECTOR_PROP_ID } from "../core/director/settings";
import { SCENE_ACTION_TIERS } from "../kit/tools/safety/scene-tiers";
import { StudioConflictError } from "./atomic-file";
import { editDirector } from "./scene-director-edit";
import { tierRefusal } from "./scene-director-tier";
import { runDirector } from "./scene-director";

const vera = { kind: "character", id: "vera", body: { identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } };
const live = { ...SCENE_ACTION_TIERS };

describe("tierRefusal", () => {
  test("the live table grants both; any other tier refuses and names the action and the tier", () => {
    expect(tierRefusal("director.plan")).toBeNull();
    expect(tierRefusal("director.edit")).toBeNull();
    expect(tierRefusal("director.trackers")).toBeNull();
    for (const tier of ["read", "draft", "delete", "egress", "exec", "unknown"]) {
      expect(tierRefusal("director.plan", { ...live, "director.plan": tier } as never)).toContain(`director.plan is set to the ${tier} tier`);
    }
  });
});

describe("the actions run only at that tier", () => {
  test("an edit is refused when the table moves director.edit off write, and nothing is written", async () => {
    const chats = memoryChatStore(() => 1);
    const chat = await chats.createChat({ title: "t", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
    await chats.appendMessage(chat.activeBranchId, { role: "user", content: "hi" });
    const tiers = { ...live, "director.edit": "egress" } as never;
    const refused = await editDirector({ chats, now: () => 2, tiers }, chat.id, { op: "add-note", content: "x" }, null).then(() => null, (e: unknown) => e);
    expect(refused).toBeInstanceOf(StudioConflictError);
    expect(String((refused as Error).message)).toContain("director.edit is set to the egress tier");
    expect(await chats.getDirector(chat.id, (await chats.readMessages(chat.activeBranchId, { limit: 5 })).messages[0]!.id)).toBeNull();
    expect((await editDirector({ chats, now: () => 2 }, chat.id, { op: "add-note", content: "x" }, null)).state.notes).toHaveLength(1);
  });

  test("a plan fails with that said, and asks no model, when the table moves director.plan off write", async () => {
    const chats = memoryChatStore(() => 1);
    const chat = await chats.createChat({ title: "t", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
    await chats.setProps(chat.id, { on: [DIRECTOR_PROP_ID] });
    let asked = 0;
    const connected = { provider: { id: "p", send: async () => { asked++; throw new Error("no"); } }, kind: "k", tools: true };
    const loaded = { history: [], current: { id: "u", role: "user", content: "hi" }, character: { identity: { name: "Vera" } } };
    const deps = { chats, connect: async () => connected as never, now: () => 5, tiers: { ...live, "director.plan": "read" } as never };
    const run = (await runDirector(deps, (await chats.getChat(chat.id))!, loaded as never, { connected: connected as never, model: "m" }, new AbortController().signal, { kind: "reply", format: undefined }))!;
    expect(run.status).toBe("failed");
    expect(run.reason).toContain("director.plan is set to the read tier");
    expect(run.directive).toBeUndefined();
    expect(asked).toBe(0);
  });
});
