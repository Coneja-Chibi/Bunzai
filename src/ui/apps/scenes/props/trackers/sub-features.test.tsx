/**
 * The sub-feature switches under a tracker's tile (RoleCall StagecraftExtensions.tsx:960-990): one radio for each, kept in the module's own state, so a module
 * switched off keeps them; the Props wing draws them under the tile while it is on and the tile carries one dot for each.
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
  test("shows each switch with its reason, off until chosen; choosing one keeps it in the module's state and keeps the module's entries", async () => {
    r.seed({ entries: [{ id: "a", subject: "S", content: "C", reliability: "certain", category: "fact", learnedAt: 1 }], subs: {} });
    let latest: Chat = r.state.chat;
    const fs = await r.mount(<SubFeatureList ctx={r.ctx()} chat={r.state.chat} onChat={(c) => { latest = c; }} module="knowledge" subs={SUBFEATURES.knowledge!} tone="var(--stage-ok)" />);
    const radio = r.q('button[role="radio"]');
    expect(radio.getAttribute("aria-checked")).toBe("false");
    expect(radio.getAttribute("title")).toBe("Bidirectional secret tracking with concealment");
    await r.press(fs, radio);
    expect(r.lastData<{ entries: unknown[]; subs: Record<string, boolean> }>().subs).toEqual({ secrets: true });
    expect(r.lastData<{ entries: unknown[] }>().entries).toHaveLength(1);
    expect(latest.trackers?.knowledge?.data).toMatchObject({ subs: { secrets: true } });
  });
  test("a module with nothing kept yet starts from its empty state", async () => {
    const fs = await r.mount(<SubFeatureList ctx={r.ctx()} chat={r.state.chat} module="knowledge" subs={SUBFEATURES.knowledge!} tone="var(--stage-ok)" />);
    await r.press(fs, r.q('button[role="radio"]'));
    expect(r.lastData<unknown>()).toEqual({ entries: [], subs: { secrets: true } } as never);
  });
});

describe("the Props wing", () => {
  test("a tile that is on shows its switches and one dot per sub-feature, lit for the ones chosen; off, it shows neither", async () => {
    r.seed({ entries: [], subs: { secrets: true } });
    const wing = (on: string[]) => <PropsWing list={[knowledgeProp]} load={{ state: "ready", on } as never} onToggle={() => undefined} onRetry={() => undefined} host={{ ctx: r.ctx(), chat: r.state.chat }} />;
    await r.mount(wing(["tracker-knowledge"]));
    expect(r.qa('button[role="radio"]')).toHaveLength(1);
    expect(r.qa(".pw-dots i.on")).toHaveLength(1);
    await r.mount(wing([]));
    expect(r.qa(".pw-dots i.up, .pw-dots i.on")).toHaveLength(0);
  });
});
