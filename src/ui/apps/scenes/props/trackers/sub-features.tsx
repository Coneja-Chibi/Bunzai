/**
 * The sub-feature switches under a tracker's tile (RoleCall StagecraftExtensions.tsx:960-990): a list of radios in a rail the colour of the module, drawn while the
 * tile is on. Each choice is kept in the module's own state (`subs`, ChatStore rule 43), through the module's `setSubs`, so a module switched off keeps them.
 * The writes join one queue, so two quick clicks never overtake each other.
 */
import { useRef, type CSSProperties, type JSX } from "react";
import type { Chat, JsonValue, TrackerModule } from "../../../../../stage/contracts/chat-store";
import type { SubFeature } from "../../../../../core/trackers/subfeatures";
import { subsOf, withSubs } from "../../../../../core/trackers";
import { Ic, type IconName } from "../../../../_shared/ic";
import type { AppContext } from "../../../../app-contract";

export function SubFeatureList({ ctx, chat, onChat, module, subs, tone }: { ctx: AppContext; chat: Chat; onChat?(chat: Chat): void; module: TrackerModule; subs: readonly SubFeature[]; tone: string }): JSX.Element {
  const queue = useRef(Promise.resolve());
  const on = subsOf(module, chat.trackers?.[module]?.data);
  const toggle = (id: string): void => {
    queue.current = queue.current.then(async () => {
      try {
        const next = await ctx.api.setSceneTracker(chat.id, module, { data: withSubs(module, chat.trackers?.[module]?.data, { ...on, [id]: !on[id] }) as JsonValue });
        onChat?.(next);
      } catch { /* the choice stays as it was; the radio shows what is kept */ }
    });
  };
  return (
    <div className="pw-subs" style={{ "--tone": tone } as CSSProperties}>
      {subs.map((s) => (
        <button key={s.id} type="button" role="radio" aria-checked={on[s.id] === true} title={s.description} aria-label={`${s.label}: ${s.description}`} onClick={() => toggle(s.id)}>
          <i className={on[s.id] ? "on" : ""} /><Ic name={s.icon as IconName} size={12} /><span>{s.label}</span>
        </button>
      ))}
    </div>
  );
}
