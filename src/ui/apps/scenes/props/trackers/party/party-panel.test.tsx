/**
 * The Party panel as it mounts (RoleCall PartyWingPanel.tsx): members with their role, lane, HP and level, Make Leader, Add Member and Refresh as proposals the
 * person accepts, Remove with its Undo, and the Formation tab. "Add Member" is there on an empty party, where RoleCall draws it only after the first member.
 */
import { describe, expect, test } from "bun:test";
import type { JSX } from "react";
import { DEFAULT_PARTY, applyParty, type Party } from "../../../../../../core/trackers/party";
import { panelRig } from "../items/panel-test-rig";
import { PartyPanel } from "./party-panel";

const r = panelRig("party");
const made = (over: Record<string, unknown> = {}) => ({ name: "Brann", combatRole: "tank", formationPosition: "front", hp: 80, maxHp: 100, mp: 10, maxMp: 20, level: 3, ...over });
const party = (...names: string[]): Party => names.reduce((p, n, i) => applyParty(p, { kind: "add", member: made({ name: n }) as never, id: `m${i}` }), DEFAULT_PARTY);
const panel = (initial?: Party): JSX.Element => {
  if (initial) r.seed(initial);
  return <PartyPanel ctx={r.ctx()} chat={r.state.chat} id="props.tracker.party" />;
};

describe("what it shows", () => {
  test("an empty party says so and still offers Add Member", async () => {
    await r.mount(panel());
    expect(r.q(".eb").textContent).toBe("Party module");
    expect(r.q("h2").textContent).toBe("Adventuring Party");
    expect(r.text()).toContain("Tracks your adventuring party: members, roles, HP, and formation. The AI coordinates party members in scenes.");
    expect(r.text()).toContain("No party members yet");
    expect(r.text()).toContain("Build your adventuring party as you journey");
    expect(r.by("Add Member")).toBeDefined();
  });
  test("a member card shows name, role, lane, HP and level; the header counts the members; funds show only when there are any", async () => {
    await r.mount(panel({ ...party("Brann", "Ilse"), sharedCurrency: 40 }));
    expect(r.text()).toContain("(2 members)");
    expect(r.text()).toContain("Brann");
    expect(r.q(".pt-who small").textContent).toBe("tank • front");
    expect(r.q(".pt-hp b").textContent).toBe("80/100");
    expect(r.q(".pt-level b").textContent).toBe("3");
    expect(r.text()).toContain("Party Funds");
  });
  test("Make Leader crowns a member, who then has no Make Leader or Remove button", async () => {
    const fs = await r.mount(panel(party("Brann", "Ilse")));
    await r.press(fs, r.by("Make Ilse leader"));
    expect(r.lastData<Party>().leaderId).toBe("m1");
    expect(r.q(".pt-lead").textContent).toBe("LEADER");
    expect(r.by("Make Ilse leader")).toBeUndefined();
    expect(r.qa('button[title="Remove member"]')).toHaveLength(1);
  });
  test("the Formation tab shows the lanes and the tactics", async () => {
    const fs = await r.mount(panel(party("Brann")));
    await r.press(fs, r.by("Formation"));
    expect(r.q(".pt-boxhead em").textContent).toBe("lanes");
    expect(r.qa(".pt-lane")[0]!.textContent).toContain("Brann");
    expect(r.text()).toContain("Conserve Mana");
    expect(r.text()).toContain("balanced");
  });
});

describe("Add Member: the model proposes, the person accepts", () => {
  test("Generate asks with the name and guide and Accept keeps it; the member joins online, in their lane", async () => {
    r.state.answers.push(made({ name: "Ilse", combatRole: "healer", formationPosition: "back" }));
    const fs = await r.mount(panel());
    await r.press(fs, r.by("Add Member"));
    await r.type(fs, r.q('input[aria-label="Member Name"]'), "Ilse");
    await r.type(fs, r.q('input[aria-label="Guide the AI"]'), "a dwarven healer");
    await r.press(fs, r.by("Generate"));
    expect(r.state.asked).toEqual([{ chatId: "c1", module: "party", action: "generate", itemName: "Ilse", userGuide: "a dwarven healer" }]);
    expect(r.text()).toContain("Ilse (healer, back)");
    await r.press(fs, r.by("Accept"));
    const p = r.lastData<Party>();
    expect(p.members[0]).toMatchObject({ name: "Ilse", isOnline: true, isLeader: false });
    expect(p.members[0]!.profileId).toMatch(/^member-/);
    expect(p.formation.lanes.back).toEqual([p.members[0]!.profileId]);
  });
});

describe("a member's card", () => {
  test("Refresh keeps the id and crown; Remove marks the member and leaves an Undo", async () => {
    r.state.answers.push(made({ name: "Brann", hp: 5 }));
    const fs = await r.mount(panel(party("Brann", "Ilse")));
    await r.press(fs, r.qa('button[title="Refresh with AI"]')[1]!);
    await r.press(fs, r.by("Generate"));
    expect(r.state.asked[0]).toMatchObject({ module: "party", action: "refresh", existing: { profileId: "m1", name: "Ilse" } });
    await r.press(fs, r.by("Accept"));
    expect(r.lastData<Party>().members[1]).toMatchObject({ profileId: "m1", name: "Brann", hp: 5 });
    await r.press(fs, r.qa('button[title="Remove member"]')[0]!);
    expect(r.lastData<Party>().members[0]!.removedAt).toBeGreaterThan(0);
    expect(r.text()).toContain("Removed Brann");
    await r.press(fs, r.by("Undo"));
    expect(r.qa(".pt-card")).toHaveLength(2);
  });
});
