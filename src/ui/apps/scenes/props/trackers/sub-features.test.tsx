/**
 * The sub-feature switches under a tracker's tile (RoleCall StagecraftExtensions.tsx:960-990): one radio for each, kept as a setting of the module on the scene, so a module
 * switched off keeps them and the module's state is never touched; the Props wing draws them under the tile while it is on and the tile carries one dot for each.
 */
import { describe, expect, test } from "bun:test";
import { SUBFEATURES } from "../../../../../core/trackers/subfeatures";
import type { Chat } from "../../../../../stage/contracts/chat-store";
import { panelRig } from "./items/panel-test-rig";
import { PropsWing } from "../props-wing";
import { knowledgeProp } from "./knowledge";
import { SubFeatureList } from "./sub-features";

const r = panelRig("knowledge");

describe("SubFeatureList", () => {
  test("shows each switch with its reason, off until chosen; choosing one keeps it as a setting of the module and writes none of its state", async () => {
    r.seed({ entries: [{ id: "a", subject: "S", content: "C", reliability: "certain", category: "fact", learnedAt: 1 }], subs: {} });
    let latest: Chat = r.state.chat;
    const fs = await r.mount(<SubFeatureList ctx={r.ctx()} chat={r.state.chat} onChat={(c) => { latest = c; }} module="knowledge" subs={SUBFEATURES.knowledge!} tone="var(--stage-ok)" />);
    const radio = r.q('button[role="radio"]');
    expect(radio.getAttribute("aria-checked")).toBe("false");
    expect(radio.getAttribute("title")).toBe("Bidirectional secret tracking with concealment");
    await r.press(fs, radio);
    expect(r.state.writes.at(-1)).toEqual({ module: "knowledge", patch: { subs: { secrets: true } } });
    expect(r.state.calls).toEqual([]);
    expect(latest.trackers?.knowledge?.subs).toEqual({ secrets: true });
  });
  test("a switch is turned off by choosing it again, and the others it sits beside are kept", async () => {
    const chat = { ...r.state.chat, trackers: { spellbook: { subs: { wildMagic: true } } } } as Chat;
    let latest: Chat = chat;
    const fs = await r.mount(<SubFeatureList ctx={r.ctx()} chat={chat} onChat={(c) => { latest = c; }} module="spellbook" subs={SUBFEATURES.spellbook!} tone="var(--stage-ok)" />);
    const [tactical, wild] = r.qa('button[role="radio"]');
    await r.press(fs, tactical!);
    expect(latest.trackers?.spellbook?.subs).toEqual({ wildMagic: true, tacticalMode: true });
    await r.press(fs, wild!);
    expect(r.state.writes.at(-1)!.patch.subs).toEqual({ wildMagic: false });
  });
});

describe("the Props wing", () => {
  test("a tile that is on shows its switches and one dot per sub-feature, lit for the ones chosen; off, it shows neither", async () => {
    const chat = { ...r.state.chat, trackers: { knowledge: { subs: { secrets: true } } } } as Chat;
    const wing = (on: string[]) => <PropsWing list={[knowledgeProp]} load={{ state: "ready", on } as never} onToggle={() => undefined} onRetry={() => undefined} host={{ ctx: r.ctx(), chat }} />;
    await r.mount(wing(["tracker-knowledge"]));
    expect(r.qa('button[role="radio"]')).toHaveLength(1);
    expect(r.qa(".pw-dots i.on")).toHaveLength(1);
    await r.mount(wing([]));
    expect(r.qa(".pw-dots i.up, .pw-dots i.on")).toHaveLength(0);
  });
});
