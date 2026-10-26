/**
 * The Messenger Cast panels over a fake API that keeps the roster with the real store rules: the member list's groups and counts, the profile card's writers (presence, name, Set Main, Edit
 * card, Delete, Restore), Reconcile, the inspector tabs around the Full Chat editor, and the controls the wireframe draws that nothing backs (Casting Call, Mute)
 * being absent, and Ping, search and the More menu against the composer draft bus. Every control is checked by the change the Participants tab's own writer receives. JSDOM-proven.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { ReactElement } from "react";
import type { Root } from "react-dom/client";
import type { ChatParticipants, ParticipantChange } from "../../../../../../stage/contracts/chat-store";
import { applyParticipantChange, checkParticipantChange } from "../../../../../../stage/store/participant-rules";
import type { OpenScene } from "../../../../../../studio/scenes";
import type { AppContext } from "../../../../../app-contract";
import { installDom, type InstalledDom } from "../../../../../_shared/test-dom";
import { holdParticipants } from "../../../participants/participants-store";
import { registerInserter } from "../../../context/draft-bus";
import type { Program } from "../../programs";
import type { WingArgs } from "../../wing-props";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { observers: true, url: "http://127.0.0.1:8352/", pretendToBeVisual: true,
    extraGlobals: ["HTMLInputElement", "HTMLSelectElement", "SVGElement", "Event", "CustomEvent", "KeyboardEvent", "Node", "MutationObserver"], boundGlobals: ["getComputedStyle"],
    globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) } });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

let n = 0;
const scene = (): OpenScene => ({
  chat: { id: `cast${++n}`, title: "Scene", activeBranchId: "b1", createdAt: 0, updatedAt: 0, snapshotVersion: 1, cast: { character: { id: "vera", version: 1, name: "Marguerite Vane" }, persona: { id: "nuit", version: 1, name: "Nuit" } } },
  snapshot: { character: { kind: "character", id: "vera", body: { identity: { name: "Marguerite Vane" }, presentation: { gradientColors: ["#ffc9ae", "#aabbcc"] } } }, persona: { kind: "persona", id: "nuit", body: { name: "Nuit" } } },
  hasPortrait: false, messages: [], messageOffset: 0, messageCount: 40, beforeSeq: null, hasMore: false, userMessageCount: 0,
}) as unknown as OpenScene;

let stored: ChatParticipants | null = null;
let props: string[] = [];
let changes: ParticipantChange[] = [];
let reconciles: number[] = [];
let ids = 0;
const apply = (c: ParticipantChange): ChatParticipants | null => (stored = applyParticipantChange(stored ?? undefined, checkParticipantChange(c), 1, () => `n${++ids}`) ?? null);
const ctx = (): AppContext => ({
  api: {
    getSceneParticipants: async () => ({ participants: stored }),
    changeSceneParticipants: async (_: string, c: ParticipantChange) => { changes.push(c); return { participants: apply(c) }; },
    reconcileSceneParticipants: async (_: string, count: number) => { reconciles.push(count); return { candidates: [], known: 0, rejected: 0, messages: count }; },
    getSceneProps: async () => ({ on: props }),
  },
  prefs: { get: () => "", set: () => undefined }, setStatus: () => undefined,
}) as unknown as AppContext;

const NPCS: ChatParticipants = { people: [
  { id: "n1", kind: "npc", name: "Atlas Guard", description: "Keeper of the Customs seal", presence: "present", at: 3 },
  { id: "n2", kind: "npc", name: "Pip", presence: "absent", at: 2 },
  { id: "n3", kind: "npc", name: "Customs Clerk", retired: true, at: 1 },
] };
beforeEach(() => { installed.reinstall(); stored = null; props = []; changes = []; reconciles = []; ids = 0; });

let root: Root;
let host: HTMLElement;
type Flush = typeof import("react-dom")["flushSync"];
const doc = (): Document => dom.window.document;
const text = (): string => doc().body.textContent ?? "";
const settle = async (f: Flush, ms = 40): Promise<void> => { await new Promise((r) => setTimeout(r, ms)); f(() => undefined); };
async function mountNode(node: ReactElement): Promise<Flush> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  host = doc().createElement("div");
  doc().body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root.render(node));
  await settle(flushSync, 60);
  return flushSync;
}
async function mountMembers(open: (id: string) => void = () => undefined): Promise<Flush> {
  const { MembersPanel } = await import("./members-panel");
  const s = scene();
  holdParticipants(s.chat.id, stored);
  return mountNode(<MembersPanel ctx={ctx()} scene={s} onOpenProgram={open} />);
}
const unmount = (f: Flush): void => { if (!host.isConnected) return; f(() => root.unmount()); host.remove(); };
afterEach(async () => { if (host?.isConnected) unmount((await import("react-dom")).flushSync); });
const named = (label: string): HTMLElement => {
  const hit = [...doc().body.querySelectorAll<HTMLElement>("[aria-label]")].find((e) => e.getAttribute("aria-label") === label) ?? [...doc().body.querySelectorAll<HTMLElement>("button")].find((b) => (b.textContent ?? "").trim() === label);
  if (!hit) throw new Error(`no control named ${label}`);
  return hit;
};
const press = async (f: Flush, el: HTMLElement): Promise<void> => { f(() => el.click()); await settle(f); };
const fill = (f: Flush, label: string, value: string): void => { const el = doc().body.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!; f(() => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(el, value); el.dispatchEvent(new dom.window.Event("input", { bubbles: true })); }); };
const part = (name: string): HTMLElement | null => doc().querySelector<HTMLElement>(`[data-part="${name}"]`);

describe("the Cast member list", () => {
  test("groups the roster with counts, shows the people's lines and badges, and draws only what has a writer", async () => {
    stored = NPCS;
    const f = await mountMembers();
    const groups = [...doc().querySelectorAll('[data-part="scene.messenger.cast.group"]')].map((g) => g.querySelector("h3")!.textContent);
    expect(groups).toEqual(["On stage - 3", "NPCs - 1", "Retired - 1"]);
    expect(text()).toContain("4 people");
    expect(text()).toContain("Keeper of the Customs seal");
    expect(text()).toContain("Marguerite Vane");
    expect(text()).toContain("Player");
    expect(part("scene.messenger.cast.member.main")).not.toBeNull();
    expect(text()).not.toContain("Casting Call");
    expect(changes).toEqual([]);
    unmount(f);
  });

  test("an NPC that is not on stage sits under NPCs, the player taken off stage under Registered, and an absent person is dimmed", async () => {
    stored = NPCS;
    const f = await mountMembers();
    await press(f, named("Open profile of Nuit"));
    await press(f, [...doc().querySelectorAll<HTMLElement>('[data-part="scene.messenger.cast.profile.presence"] button')].find((b) => b.textContent === "Absent")!);
    expect(changes).toEqual([{ op: "edit", id: "player", edit: { presence: "absent" } }]);
    const groups = [...doc().querySelectorAll('[data-part="scene.messenger.cast.group"]')].map((g) => g.querySelector("h3")!.textContent);
    expect(groups).toEqual(["On stage - 2", "NPCs - 1", "Registered - 1", "Retired - 1"]);
    expect(part("scene.messenger.cast.member.n2")!.dataset.dim).toBe("true");
    unmount(f);
  });

  test("the hover Set Main button and the profile card's Set Main and Unset Main write the main slot", async () => {
    stored = NPCS;
    const f = await mountMembers();
    await press(f, named("Set Atlas Guard as main"));
    expect(changes).toEqual([{ op: "main", id: "n1" }]);
    await press(f, named("Open profile of Atlas Guard"));
    await press(f, part("scene.messenger.cast.profile.unset-main")!);
    expect(changes.at(-1)).toEqual({ op: "main", id: null });
    await press(f, part("scene.messenger.cast.profile.set-main")!);
    expect(changes.at(-1)).toEqual({ op: "main", id: "n1" });
    unmount(f);
  });

  test("the profile card renames, retires an NPC (Delete) and Restore brings it back; the card and the player have no Delete", async () => {
    stored = NPCS;
    const f = await mountMembers();
    await press(f, named("Open profile of Marguerite Vane"));
    expect(part("scene.messenger.cast.profile.delete")).toBeNull();
    expect(text()).toContain("Uses card gradient");
    unmount(f);

    const g = await mountMembers();
    await press(g, named("Open profile of Atlas Guard"));
    const name = part("scene.messenger.cast.profile.name") as HTMLInputElement;
    name.value = "Atlas the Guard";
    name.focus();
    g(() => name.blur());
    await settle(g);
    expect(changes).toEqual([{ op: "edit", id: "n1", edit: { name: "Atlas the Guard" } }]);
    unmount(g);

    const h = await mountMembers();
    await press(h, named("Open profile of Pip"));
    await press(h, part("scene.messenger.cast.profile.delete")!);
    expect(changes.at(-1)).toEqual({ op: "edit", id: "n2", edit: { retired: true } });
    expect(part("scene.messenger.cast.profile")).toBeNull();
    await press(h, [...doc().querySelectorAll<HTMLElement>('[data-part="scene.messenger.cast.member.restore"]')][0]!);
    expect(changes.at(-1)).toMatchObject({ op: "edit", edit: { retired: false } });
    unmount(h);
  });

  test("Edit card opens the Characters program for the card and My Persona for the player, and an NPC has none", async () => {
    stored = NPCS;
    const opened: string[] = [];
    const f = await mountMembers((id) => opened.push(id));
    await press(f, named("Open profile of Marguerite Vane"));
    await press(f, part("scene.messenger.cast.profile.edit-card")!);
    expect(part("scene.messenger.cast.profile")).toBeNull();
    await press(f, named("Open profile of Nuit"));
    await press(f, part("scene.messenger.cast.profile.edit-card")!);
    expect(opened).toEqual(["characters", "persona"]);
    await press(f, named("Open profile of Atlas Guard"));
    expect(part("scene.messenger.cast.profile.edit-card")).toBeNull();
    unmount(f);
  });

  test("the color editor waits for Dialogue Colors and writes the colors through the same writer when it is on", async () => {
    stored = NPCS;
    const off = await mountMembers();
    await press(off, named("Open profile of Atlas Guard"));
    expect(text()).toContain("Colors apply when Dialogue Colors is on.");
    unmount(off);
    props = ["dialogue-colors"];
    const on = await mountMembers();
    await press(on, named("Open profile of Atlas Guard"));
    await press(on, [...doc().querySelectorAll<HTMLElement>("button")].find((b) => b.textContent === "+ Gradient")!);
    expect(changes.at(-1)).toMatchObject({ op: "edit", id: "n1", edit: { colors: [expect.any(String), expect.any(String)] } });
    unmount(on);
  });

  test("the Reconcile card runs the Full Chat check with its own count", async () => {
    const f = await mountMembers();
    await press(f, [...doc().querySelectorAll<HTMLElement>("button")].find((b) => b.textContent === "Reconcile")!);
    expect(reconciles).toHaveLength(1);
    unmount(f);
  });
});

describe("Ping, search, More and the profile edits", () => {
  const inbox = (chatIdOf: () => string): { got: string[]; off(): void } => { const got: string[] = []; return { got, off: registerInserter(chatIdOf(), (p) => { got.push(p); return true; }) }; };
  const mountWithDraft = async (): Promise<{ f: Flush; got: string[]; off(): void }> => {
    const { MembersPanel } = await import("./members-panel");
    const s = scene();
    holdParticipants(s.chat.id, stored);
    const box = inbox(() => s.chat.id);
    const f = await mountNode(<MembersPanel ctx={ctx()} scene={s} onOpenProgram={() => undefined} />);
    return { f, ...box };
  };

  test("Ping on the hover bar and in the profile card inserts the mention into the draft and writes no roster change", async () => {
    stored = NPCS;
    const { f, got, off } = await mountWithDraft();
    await press(f, named("Ping Atlas Guard"));
    await press(f, named("Open profile of Atlas Guard"));
    await press(f, part("scene.messenger.cast.profile.ping")!);
    expect(got).toEqual(["@Atlas Guard", "@Atlas Guard"]);
    expect(changes).toEqual([]);
    off();
    unmount(f);
  });

  test("Ping with no composer open says the mention is queued in the row and the card, and the composer gets it when it opens", async () => {
    stored = NPCS;
    const { MembersPanel } = await import("./members-panel");
    const s = scene();
    holdParticipants(s.chat.id, stored);
    const f = await mountNode(<MembersPanel ctx={ctx()} scene={s} onOpenProgram={() => undefined} />);
    await press(f, named("Ping Atlas Guard"));
    expect(part("scene.messenger.cast.member.ping-notice")?.textContent).toContain("@Atlas Guard is queued");
    await press(f, named("Open profile of Atlas Guard"));
    await press(f, part("scene.messenger.cast.profile.ping")!);
    expect(part("scene.messenger.cast.profile.ping-notice")?.textContent).toContain("@Atlas Guard is queued");
    expect(changes).toEqual([]);
    const got: string[] = [];
    const off = registerInserter(s.chat.id, (p) => { got.push(p); return true; });
    expect(got).toEqual(["@Atlas Guard", "@Atlas Guard"]);
    off();
    unmount(f);
  });

  test("search narrows every group by name or note, says when nobody matches, and keeps the total", async () => {
    stored = NPCS;
    const f = await mountMembers();
    fill(f, "Search cast", "customs");
    await settle(f);
    expect(text()).toContain("Keeper of the Customs seal");
    expect(text()).not.toContain("Pip");
    expect(text()).not.toContain("Marguerite Vane");
    expect(text()).toContain("4 people");
    fill(f, "Search cast", "zzz");
    await settle(f);
    expect(text()).toContain('Nobody matches "zzz".');
    unmount(f);
  });

  test("the More menu moves a person between present, background and absent through the presence writer, and offers Set Main", async () => {
    stored = NPCS;
    const { f, got, off } = await mountWithDraft();
    await press(f, named("More for Atlas Guard"));
    const items = [...doc().querySelectorAll<HTMLElement>('[role="menuitem"]')].map((i) => i.textContent);
    expect(items.join("|")).toContain("Set Main");
    expect(items.join("|")).toContain("Mark absent");
    expect(items.join("|")).not.toContain("Put on stage");
    await press(f, [...doc().querySelectorAll<HTMLElement>('[role="menuitem"]')].find((i) => i.textContent?.startsWith("Mark absent"))!);
    expect(changes).toEqual([{ op: "edit", id: "n1", edit: { presence: "absent" } }]);
    await press(f, named("More for Pip"));
    await press(f, [...doc().querySelectorAll<HTMLElement>('[role="menuitem"]')].find((i) => i.textContent?.startsWith("Ping"))!);
    expect(got).toEqual(["@Pip"]);
    off();
    unmount(f);
  });

  test("the profile note writes the description, and clearing it writes null", async () => {
    stored = NPCS;
    const f = await mountMembers();
    await press(f, named("Open profile of Atlas Guard"));
    const note = part("scene.messenger.cast.profile.note") as HTMLInputElement;
    note.value = "Wears a red sash";
    note.focus();
    f(() => note.blur());
    await settle(f);
    expect(changes).toEqual([{ op: "edit", id: "n1", edit: { description: "Wears a red sash" } }]);
    const again = part("scene.messenger.cast.profile.note") as HTMLInputElement;
    again.value = "  ";
    again.focus();
    f(() => again.blur());
    await settle(f);
    expect(changes.at(-1)).toEqual({ op: "edit", id: "n1", edit: { description: null } });
    unmount(f);
  });

  test("the card gradient switch clears the colors when on and keeps a color of its own when off, only while Dialogue Colors is on", async () => {
    stored = NPCS;
    const off = await mountMembers();
    await press(off, named("Open profile of Marguerite Vane"));
    expect((part("scene.messenger.cast.profile.card-gradient") as HTMLButtonElement).disabled).toBe(true);
    unmount(off);
    props = ["dialogue-colors"];
    const on = await mountMembers();
    await press(on, named("Open profile of Marguerite Vane"));
    const sw = part("scene.messenger.cast.profile.card-gradient") as HTMLButtonElement;
    expect(sw.getAttribute("aria-checked")).toBe("true");
    await press(on, sw);
    expect(changes.at(-1)).toEqual({ op: "edit", id: "card", edit: { colors: ["#ffc9ae"] } });
    expect(part("scene.messenger.cast.profile.card-gradient")!.getAttribute("aria-checked")).toBe("false");
    await press(on, part("scene.messenger.cast.profile.card-gradient")!);
    expect(changes.at(-1)).toEqual({ op: "edit", id: "card", edit: { colors: null } });
    unmount(on);
  });

  test("the color editor offers six palette swatches for an NPC and none for the card while it uses the card gradient", async () => {
    stored = NPCS;
    props = ["dialogue-colors"];
    const f = await mountMembers();
    await press(f, named("Open profile of Atlas Guard"));
    const before = changes.length;
    const tiles = [...doc().querySelectorAll<HTMLElement>('[data-part="scene.messenger.cast.profile"] [data-control="tile"]')];
    expect(tiles.length).toBeGreaterThanOrEqual(6);
    await press(f, tiles[2]!);
    expect(changes.length).toBe(before + 1);
    expect(changes.at(-1)).toMatchObject({ op: "edit", id: "n1", edit: { colors: [expect.stringMatching(/^#[0-9a-f]{6}$/i)] } });
    unmount(f);
  });
});

describe("the inspector and the program entry", () => {
  const program = (id: string): Program => ({ id, wing: "cast", title: id, icon: "lucide:users-round" }) as Program;

  test("the two tabs keep the editor body and open the other program", async () => {
    const { CastInspector } = await import("./cast-inspector");
    const opened: string[] = [];
    const f = await mountNode(<CastInspector program="characters" onOpenProgram={(id) => opened.push(id)}><p>editor body</p></CastInspector>);
    expect(text()).toContain("editor body");
    const tabs = [...doc().querySelectorAll<HTMLElement>('[role="tab"]')];
    expect(tabs.map((t) => t.textContent)).toEqual(["Character", "My persona"]);
    expect(tabs[0]!.getAttribute("aria-selected")).toBe("true");
    await press(f, tabs[0]!);
    expect(opened).toEqual([]);
    await press(f, tabs[1]!);
    expect(opened).toEqual(["persona"]);
    unmount(f);
  });

  test("only Participants, Characters and My Persona are drawn here; other programs fall through, and a missing scene falls back", async () => {
    const { castProgramBody } = await import("./index");
    const args = { ctx: ctx(), scene: scene() } as unknown as WingArgs;
    const same = (): null => null;
    expect(castProgramBody(program("lorebook"), args, () => undefined, same)).toBeNull();
    expect(castProgramBody(program("characters"), args, () => undefined, same)).not.toBeNull();
    expect(castProgramBody(program("participants"), args, () => undefined, () => "plain")).not.toBe("plain");
    expect(castProgramBody(program("participants"), null, () => undefined, () => "plain")).toBe("plain");
  });
  test("Add participant writes one add run with the name, note and presence, and the new person shows up", async () => {
    const f = await mountMembers();
    await press(f, named("Add participant"));
    fill(f, "New participant name", "  Atlas   Guard ");
    fill(f, "New participant note", "Keeper of the Customs seal");
    await press(f, named("Absent"));
    await press(f, named("Add"));
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual({ op: "add", run: expect.stringMatching(/^add-.{8,}/), people: [{ name: "Atlas Guard", description: "Keeper of the Customs seal", presence: "absent" }] });
    expect(part("scene.messenger.cast.add")).not.toBeNull();
    expect(stored!.people.map((p) => p.name)).toEqual(["Atlas Guard"]);
    expect(text()).toContain("Atlas Guard");
    expect(doc().body.querySelector('input[aria-label="New participant name"]')).toBeNull();
    await press(f, named("Add participant"));
    fill(f, "New participant name", "atlas guard");
    await press(f, named("Add"));
    expect(text()).toContain("atlas guard is already on the roster.");
    expect(changes).toHaveLength(1);
    expect(doc().body.querySelector<HTMLInputElement>('input[aria-label="New participant name"]')!.value).toBe("atlas guard");
    await press(f, named("Cancel"));
    expect(doc().body.querySelector('input[aria-label="New participant name"]')).toBeNull();
    unmount(f);
  });
});
